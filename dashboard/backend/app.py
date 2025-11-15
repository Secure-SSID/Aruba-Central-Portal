#!/usr/bin/env python3
"""
Flask backend for Aruba Central Dashboard
Serves as an API proxy to securely handle authentication and API calls
"""

import sys
import json
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import logging
from functools import wraps
import secrets
import time

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from utils import load_config
from central_api_client import CentralAPIClient
from token_manager import TokenManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__, static_folder='../frontend/build', static_url_path='')
CORS(app, origins=['http://localhost:3000', 'http://localhost:1344'])

# Session management (in production, use Redis or database)
active_sessions = {}
SESSION_TIMEOUT = 3600  # 1 hour

# API Rate Limiting Tracking (based on Aruba Central default limits)
# Default limits: 5000 calls/day, 7 calls/second
api_call_tracker = {
    'daily_calls': 0,
    'daily_reset_time': time.time() + 86400,  # Reset after 24 hours
    'second_window': [],  # Track calls in current second
    'all_calls': []  # Track all calls for analytics
}

# Initialize Aruba Client
aruba_client = None
token_manager = None
config = None
credentials_configured = False


def initialize_client():
    """Initialize Aruba Central client."""
    global aruba_client, token_manager, config, credentials_configured

    try:
        config = load_config()
        logger.info("Configuration loaded successfully")

        # Check if credentials are configured
        aruba_config = config.get("aruba_central", {})
        client_id = aruba_config.get("client_id", "")
        client_secret = aruba_config.get("client_secret", "")
        customer_id = aruba_config.get("customer_id", "")

        if not client_id or not client_secret or not customer_id or \
           client_id == "your_client_id_here" or \
           client_secret == "your_client_secret_here" or \
           customer_id == "your_customer_id_here":
            logger.warning("Credentials not configured - setup wizard needed")
            credentials_configured = False
            return False

        # Initialize token manager
        token_manager = TokenManager(
            client_id=client_id,
            client_secret=client_secret
        )

        # Initialize Aruba Central API client
        aruba_client = CentralAPIClient(
            base_url=aruba_config.get("base_url", "https://internal.api.central.arubanetworks.com"),
            token_manager=token_manager
        )

        credentials_configured = True
        logger.info("Aruba Central client initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize Aruba Central client: {e}")
        logger.warning("Server will start but authentication will fail until configured")
        credentials_configured = False
        return False


# Try to initialize on startup
initialize_client()


def track_api_call():
    """Track API call for rate limiting."""
    global api_call_tracker
    current_time = time.time()

    # Reset daily counter if needed
    if current_time > api_call_tracker['daily_reset_time']:
        api_call_tracker['daily_calls'] = 0
        api_call_tracker['daily_reset_time'] = current_time + 86400
        api_call_tracker['all_calls'] = []

    # Track call
    api_call_tracker['daily_calls'] += 1
    api_call_tracker['all_calls'].append({
        'timestamp': current_time,
        'endpoint': request.path,
        'method': request.method
    })

    # Keep only last 1000 calls for analytics
    if len(api_call_tracker['all_calls']) > 1000:
        api_call_tracker['all_calls'] = api_call_tracker['all_calls'][-1000:]

    # Track calls in current second (for rate per second tracking)
    api_call_tracker['second_window'] = [
        t for t in api_call_tracker['second_window']
        if t > current_time - 1
    ]
    api_call_tracker['second_window'].append(current_time)


def require_session(f):
    """Decorator to require valid session."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        session_id = request.headers.get('X-Session-ID')
        if not session_id or session_id not in active_sessions:
            return jsonify({"error": "Invalid or expired session"}), 401

        # Check session expiry
        session = active_sessions[session_id]
        if time.time() > session['expires']:
            del active_sessions[session_id]
            return jsonify({"error": "Session expired"}), 401

        # Refresh session
        session['expires'] = time.time() + SESSION_TIMEOUT

        # Track API call for rate limiting monitoring
        track_api_call()

        return f(*args, **kwargs)
    return decorated_function


def api_proxy(endpoint_builder, method='GET', error_msg="API", fallback_data=None):
    """Create API proxy endpoint with error handling and graceful fallbacks."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            try:
                # Check if aruba_client is initialized
                if not aruba_client:
                    logger.error(f"{error_msg}: Aruba client not initialized")
                    if fallback_data is not None:
                        return jsonify(fallback_data)
                    return jsonify({"error": "Server not configured. Please configure credentials first."}), 500
                
                endpoint = endpoint_builder(*args, **kwargs) if callable(endpoint_builder) else endpoint_builder
                params = request.args.to_dict()

                # Build kwargs based on method type
                api_kwargs = {'params': params}
                if method in ['POST', 'PUT', 'DELETE']:
                    data = request.get_json()
                    if data:
                        api_kwargs['data'] = data

                logger.debug(f"API Proxy: {method} {endpoint} with params: {params}")
                
                # Enhanced logging for sites-health endpoint
                if 'sites-health' in endpoint:
                    logger.info(f"🔍 Sites Health API Request: endpoint={endpoint}, params={params}")
                    if 'fields' in params:
                        logger.info(f"✅ 'fields' parameter found: {params.get('fields')}")
                    else:
                        logger.warning(f"⚠️ 'fields' parameter NOT found in request params")
                
                response = getattr(aruba_client, method.lower())(endpoint, **api_kwargs)
                
                # Enhanced logging for sites-health endpoint to verify devices field in response
                if 'sites-health' in endpoint:
                    logger.info(f"📊 Sites Health API Response: count={response.get('count', 0)}, items={len(response.get('items', []))}")
                    if response.get('items') and len(response.get('items', [])) > 0:
                        first_item = response['items'][0]
                        has_devices = 'devices' in first_item
                        logger.info(f"{'✅' if has_devices else '⚠️'} First site has 'devices' field: {has_devices}")
                        if has_devices:
                            devices_data = first_item.get('devices', {})
                            logger.info(f"✅ Devices structure keys: {list(devices_data.keys()) if isinstance(devices_data, dict) else 'Not a dict'}")
                        else:
                            logger.warning(f"⚠️ Devices field missing. Available keys in first item: {list(first_item.keys())}")
                
                return jsonify(response)
            except Exception as e:
                error_str = str(e)
                logger.error(f"{error_msg}: {error_str}", exc_info=True)
                
                # Try to extract more details from requests.HTTPError
                import requests
                if isinstance(e, requests.HTTPError):
                    try:
                        error_response_text = e.response.text if hasattr(e, 'response') else None
                        error_status_code = e.response.status_code if hasattr(e, 'response') else None
                        logger.error(f"{error_msg}: HTTP {error_status_code} - {error_response_text}")
                        error_str = f"HTTP {error_status_code}: {error_response_text or error_str}"
                    except:
                        pass
                
                # Check for AttributeError (aruba_client method not found)
                if isinstance(e, AttributeError):
                    logger.error(f"{error_msg}: aruba_client method '{method.lower()}' not found")
                    return jsonify({"error": f"API method error: {error_str}"}), 500

                # Return graceful fallback for common errors
                if "404" in error_str or "Not Found" in error_str:
                    # Return empty data for GET requests on 404
                    if method == 'GET':
                        logger.warning(f"{error_msg} endpoint not available: {endpoint}")
                        if fallback_data is not None:
                            return jsonify(fallback_data)
                        # Default empty response
                        return jsonify({"data": [], "count": 0, "total": 0})
                    return jsonify({"error": f"Resource not found: {error_msg}"}), 404
                elif "403" in error_str or "Forbidden" in error_str:
                    return jsonify({"error": f"Access forbidden: {error_msg}"}), 403
                elif "401" in error_str or "Unauthorized" in error_str:
                    return jsonify({"error": "Authentication required"}), 401
                elif "400" in error_str or "Bad Request" in error_str:
                    # For 400 errors, return the actual error message from API
                    logger.error(f"{error_msg}: Bad Request - {error_str}")
                    return jsonify({"error": f"Bad Request: {error_str}", "endpoint": endpoint, "params": params}), 400

                # Default 500 error for other cases - include more details
                error_response = {
                    "error": error_str,
                    "endpoint": endpoint,
                    "method": method,
                    "params": params,
                    "message": f"Failed to call {error_msg} API"
                }
                return jsonify(error_response), 500
        return wrapper
    return decorator


# ============= Authentication Endpoints =============

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Authenticate and create session with Aruba Central."""
    try:
        if not aruba_client and not initialize_client():
            return jsonify({"error": "Server configuration error"}), 500

        token_manager.get_access_token(force_refresh=True)
        token_info = token_manager.get_token_info()

        session_id = secrets.token_urlsafe(32)
        active_sessions[session_id] = {'created': time.time(), 'expires': time.time() + SESSION_TIMEOUT}

        logger.info(f"Session created, token expires in {token_info.get('expires_in_minutes', 0)}m")

        return jsonify({
            "success": True,
            "session_id": session_id,
            "expires_in": SESSION_TIMEOUT,
            "token_info": {"created": True, "expires_at": token_info.get('expires_at'),
                          "expires_in_minutes": token_info.get('expires_in_minutes')}
        })
    except Exception as e:
        logger.error(f"Login: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/auth/logout', methods=['POST'])
@require_session
def logout():
    """Logout and end session."""
    session_id = request.headers.get('X-Session-ID')
    if session_id in active_sessions:
        del active_sessions[session_id]
    return jsonify({"success": True})


@app.route('/api/auth/status', methods=['GET'])
@require_session
def auth_status():
    """Check authentication status."""
    token_info = token_manager.get_token_info() if token_manager else {}
    return jsonify({
        "authenticated": True,
        "customer_id": config["aruba_central"]["customer_id"][:16] + "...",
        "base_url": config["aruba_central"]["base_url"],
        "token": token_info
    })


@app.route('/api/token/info', methods=['GET'])
@require_session
def token_info():
    """Get token information and expiry status."""
    if not token_manager:
        return jsonify({"error": "Token manager not initialized"}), 500

    return jsonify(token_manager.get_token_info())


@app.route('/api/token/refresh', methods=['POST'])
@require_session
def refresh_token():
    """Force refresh the access token."""
    if not token_manager:
        return jsonify({"error": "Token manager not initialized"}), 500

    try:
        new_token = token_manager.get_access_token(force_refresh=True)
        return jsonify({
            "success": True,
            "message": "Token refreshed successfully",
            "token_info": token_manager.get_token_info()
        })
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/rate-limit/status', methods=['GET'])
@require_session
def get_rate_limit_status():
    """Get API rate limit usage stats."""
    t = api_call_tracker
    reset_sec = max(0, t['daily_reset_time'] - time.time())
    daily_lim, sec_lim = 5000, 7
    return jsonify({
        "daily_calls": t['daily_calls'], "daily_limit": daily_lim,
        "daily_percentage": (t['daily_calls'] / daily_lim * 100),
        "calls_remaining": max(0, daily_lim - t['daily_calls']),
        "reset_in_hours": int(reset_sec // 3600), "reset_in_minutes": int((reset_sec % 3600) // 60),
        "current_rate_per_second": len(t['second_window']), "per_second_limit": sec_lim,
        "recent_calls": len(t['all_calls'])
    })


# ============= Device Management Endpoints =============

@app.route('/api/devices', methods=['GET'])
@require_session
@api_proxy('/network-monitoring/v1alpha1/devices', error_msg="Devices")
def get_devices(): pass

@app.route('/api/devices/<serial>', methods=['GET'])
@require_session
def get_device_details(serial):
    """Get device by serial with current CPU, memory, and temperature if available."""
    try:
        # Check if aruba_client is initialized
        if not aruba_client:
            logger.error(f"Aruba client not initialized when fetching device {serial}")
            return jsonify({"error": "Server not configured. Please configure credentials first."}), 500
        
        r = aruba_client.get('/network-monitoring/v1alpha1/devices')
        if 'items' in r:
            for d in r['items']:
                if d.get('serial') == serial or d.get('serialNumber') == serial:
                    device = d.copy()
                    device_type = device.get('deviceType', '').upper()
                    # Also check alternative field names
                    if not device_type:
                        device_type = device.get('type', '').upper()
                    
                    logger.info(f"Fetching device details for {serial}, type: {device_type}, all device keys: {list(device.keys())}")
                    
                    # If it's an AP, try to get current CPU and memory utilization
                    # Check multiple possible device type values
                    is_ap = device_type in ['AP', 'IAP', 'ACCESS_POINT', 'ACCESS POINT'] or \
                            'ap' in device.get('deviceType', '').lower() or \
                            'ap' in device.get('type', '').lower()
                    
                    if is_ap:
                        logger.info(f"Device {serial} identified as AP, fetching utilization metrics")
                        from datetime import datetime, timedelta
                        
                        # Helper function to fetch utilization data
                        def fetch_utilization(endpoint_name, endpoint_path, device_key):
                            fetched = False
                            # Try without filter first (API may return default time range)
                            # Then try with filters if needed
                            attempts = [
                                # Try 1: Without filter (get default/available data)
                                {},
                                # Try 2: With 1-hour filter
                                {'filter': f"timestamp gt '{(datetime.utcnow() - timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%SZ')}'"},
                                # Try 3: With 24-hour filter
                                {'filter': f"timestamp gt '{(datetime.utcnow() - timedelta(hours=24)).strftime('%Y-%m-%dT%H:%M:%SZ')}'"},
                            ]
                            
                            for attempt_num, params in enumerate(attempts, 1):
                                if fetched:
                                    break
                                try:
                                    logger.info(f"Attempt {attempt_num}: Fetching {endpoint_name} for AP {serial} with params: {params}")
                                    response = aruba_client.get(
                                        endpoint_path,
                                        params=params if params else None
                                    )
                                    
                                    logger.debug(f"{endpoint_name} response for {serial}: {list(response.keys())}")
                                    
                                    # Extract latest value
                                    if 'graph' in response and 'samples' in response['graph']:
                                        samples = response['graph']['samples']
                                        logger.info(f"Found {len(samples)} {endpoint_name} samples for {serial}")
                                        if samples:
                                            # Get most recent sample
                                            latest_sample = samples[-1]
                                            logger.debug(f"Latest {endpoint_name} sample: {latest_sample}")
                                            if 'data' in latest_sample and len(latest_sample['data']) > 0:
                                                values = latest_sample['data']
                                                avg_value = round(sum(values) / len(values), 2)
                                                # Store both numeric and formatted versions
                                                # Format based on metric type
                                                if 'power' in device_key.lower():
                                                    # Power is in watts, not percentage
                                                    device[device_key] = f"{avg_value}W"
                                                    device['power_consumption'] = avg_value
                                                    device['power_consumption_watts'] = avg_value
                                                else:
                                                    # CPU and Memory are percentages
                                                    device[device_key] = f"{avg_value}%"
                                                    # Also store in different formats for compatibility
                                                    if 'cpu' in device_key.lower():
                                                        device['cpu_utilization'] = avg_value
                                                        device['cpu_utilization_percent'] = avg_value
                                                    elif 'mem' in device_key.lower():
                                                        device['memory_utilization'] = avg_value
                                                        device['memory_utilization_percent'] = avg_value
                                                        device['memoryUsage'] = f"{avg_value}%"  # Alternative field name
                                                
                                                unit = "W" if 'power' in device_key.lower() else "%"
                                                logger.info(f"Successfully set {endpoint_name} for {serial}: {avg_value}{unit}")
                                                fetched = True
                                                break
                                            else:
                                                logger.warning(f"No data in latest {endpoint_name} sample for {serial}")
                                        else:
                                            logger.warning(f"No {endpoint_name} samples found for {serial} in attempt {attempt_num}")
                                    else:
                                        logger.warning(f"{endpoint_name} response missing graph/samples for {serial} in attempt {attempt_num}: {list(response.keys())}")
                                except Exception as err:
                                    logger.warning(f"Attempt {attempt_num} failed to fetch {endpoint_name} for AP {serial}: {err}")
                                    if attempt_num == len(attempts):
                                        logger.warning(f"All attempts failed to fetch {endpoint_name} for AP {serial}", exc_info=True)
                            
                            return fetched
                        
                        # Fetch CPU utilization
                        fetch_utilization(
                            'CPU utilization',
                            f'/network-monitoring/v1alpha1/aps/{serial}/cpu-utilization-trends',
                            'cpuUtilization'
                        )
                        
                        # Fetch Memory utilization
                        fetch_utilization(
                            'Memory utilization',
                            f'/network-monitoring/v1alpha1/aps/{serial}/memory-utilization-trends',
                            'memUtilization'
                        )
                        
                        # Fetch Power consumption
                        fetch_utilization(
                            'Power consumption',
                            f'/network-monitoring/v1alpha1/aps/{serial}/power-consumption-trends',
                            'powerConsumption'
                        )
                    else:
                        logger.info(f"Device {serial} is not an AP (type: {device_type}), skipping utilization metrics")
                    
                    # Log what fields are being returned
                    logger.info(f"Returning device details for {serial} with keys: {list(device.keys())}")
                    logger.info(f"CPU: {device.get('cpuUtilization', 'NOT SET')}, Memory: {device.get('memUtilization', 'NOT SET')}, Power: {device.get('powerConsumption', 'NOT SET')}")
                    
                    # Ensure fields exist even if not fetched (for frontend compatibility)
                    if 'cpuUtilization' not in device:
                        device['cpuUtilization'] = None
                    if 'memUtilization' not in device:
                        device['memUtilization'] = None
                    if 'powerConsumption' not in device:
                        device['powerConsumption'] = None
                    if 'temperature' not in device:
                        device['temperature'] = None
                    
                    return jsonify(device)
            return jsonify({"error": f"Device {serial} not found"}), 404
        return jsonify({"error": "No devices returned"}), 500
    except Exception as e:
        logger.error(f"Device {serial}: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/api/switches/<serial>/details', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-monitoring/v1alpha1/switch/{serial}', error_msg="Switch details")
def get_switch_details(serial): pass

@app.route('/api/switches/<serial>/hardware', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-monitoring/v1alpha1/switch/{serial}/hardware-categories', error_msg="Switch hardware")
def get_switch_hardware(serial): pass

@app.route('/api/switches/<serial>/lag', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-monitoring/v1alpha1/switch/{serial}/lag', error_msg="Switch LAG")
def get_switch_lag(serial): pass

@app.route('/api/switches/<serial>/interfaces', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-monitoring/v1alpha1/switch/{serial}/interfaces', error_msg="Switch interfaces")
def get_switch_interfaces(serial): pass

@app.route('/api/switches/<serial>/show-command', methods=['POST'])
@require_session
def run_switch_show_command(serial):
    """Run a 'show' command on a CX switch and return task ID.
    
    Reference: https://developer.arubanetworks.com/new-central/reference/runcxshowcommand
    Endpoint: /network-troubleshooting/v1alpha1/cx/{serial-number}/showCommand
    """
    try:
        data = request.get_json()
        command = data.get('command', '')
        
        if not command.startswith('show '):
            return jsonify({"error": "Command must start with 'show '"}), 400
        
        response = aruba_client.post(
            f'/network-troubleshooting/v1alpha1/cx/{serial}/showCommand',
            json={'command': command}
        )
        logger.info(f"Show command response for {serial}: {response}")
        # Handle different response formats - taskId might be in different fields
        if isinstance(response, dict):
            # Check for common task ID field names
            if 'taskId' not in response and 'task_id' not in response:
                # Try to find task ID in nested structures
                if 'data' in response and isinstance(response['data'], dict):
                    task_id = response['data'].get('taskId') or response['data'].get('task_id')
                    if task_id:
                        response['taskId'] = task_id
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error running show command on switch {serial}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/switches/<serial>/show-command/<task_id>', methods=['GET'])
@require_session
def get_switch_show_command_result(serial, task_id):
    """Get the result of a 'show' command execution on a CX switch.
    
    Reference: https://developer.arubanetworks.com/new-central/reference/runcxshowcommand
    Endpoint: /network-troubleshooting/v1alpha1/cx/{serial-number}/showCommand/async-operations/{task-id}
    """
    try:
        response = aruba_client.get(
            f'/network-troubleshooting/v1alpha1/cx/{serial}/showCommand/async-operations/{task_id}'
        )
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error getting show command result for switch {serial}, task {task_id}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/switches/<serial>/vlans', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-monitoring/v1alpha1/switch/{serial}/vlans', error_msg="Switch VLANs")
def get_switch_vlans(serial): pass

@app.route('/api/stacks/<stack_id>/members', methods=['GET'])
@require_session
@api_proxy(lambda stack_id: f'/network-monitoring/v1alpha1/stack/{stack_id}/members', error_msg="Stack members")
def get_stack_members(stack_id): pass

@app.route('/api/device-parameters', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/device-parameters', error_msg="Device parameters")
def get_device_parameters(): pass

@app.route('/api/device-parameters/<platform_model>', methods=['GET'])
@require_session
@api_proxy(lambda platform_model: f'/network-config/v1alpha1/device-parameters/{platform_model}', error_msg="Device parameters by model")
def get_device_parameters_by_model(platform_model): pass

@app.route('/api/aps/<serial>/details', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-monitoring/v1alpha1/aps/{serial}', error_msg="AP details")
def get_ap_details(serial): pass

@app.route('/api/aps/<serial>/power-consumption', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-monitoring/v1alpha1/aps/{serial}/power-consumption-trends', error_msg="AP power consumption")
def get_ap_power_consumption(serial): pass


@app.route('/api/switches', methods=['GET'])
@require_session
def get_switches():
    """Get all switches."""
    try:
        r = aruba_client.get('/network-monitoring/v1alpha1/devices')
        if 'items' in r:
            s = [d for d in r['items'] if d.get('deviceType') == 'SWITCH']
            return jsonify({'count': len(s), 'items': s})
        return jsonify(r)
    except Exception as e:
        logger.error(f"Switches: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/aps', methods=['GET'])
@require_session
@api_proxy('/network-monitoring/v1alpha1/aps', error_msg="APs")
def get_access_points(): pass


# ============= Wireless/WLAN Endpoints =============

@app.route('/api/wlans', methods=['GET'])
@require_session
def get_wlans():
    """Get all WLANs using new v1alpha1 API."""
    try:
        response = aruba_client.get('/network-monitoring/v1alpha1/wlans')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching WLANs: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/wlans/<ssid_name>', methods=['GET'])
@require_session
def get_wlan_details(ssid_name):
    """Get WLAN details by SSID name."""
    try:
        response = aruba_client.get(f'/configuration/v1/wlan/{ssid_name}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching WLAN {ssid_name}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/wlans', methods=['POST'])
@require_session
def create_wlan():
    """Create a new WLAN."""
    try:
        data = request.get_json()
        response = aruba_client.post('/configuration/v1/wlan', json=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating WLAN: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/wlans/<ssid_name>', methods=['DELETE'])
@require_session
def delete_wlan(ssid_name):
    """Delete a WLAN."""
    try:
        response = aruba_client.delete(f'/configuration/v1/wlan/{ssid_name}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting WLAN {ssid_name}: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Client Endpoints =============

@app.route('/api/clients', methods=['GET'])
@require_session
def get_clients():
    """Get connected clients from ALL sites or specific site with pagination handling."""
    try:
        # Check if aruba_client is initialized
        if not aruba_client:
            logger.error("Aruba client not initialized when fetching clients")
            return jsonify({"error": "Server not configured. Please configure credentials first."}), 500
        
        site_id = request.args.get('site_id', request.args.get('site-id'))

        # If site_id is provided, fetch clients for that site with pagination
        if site_id:
            all_items = []
            offset = 0
            limit = 100  # Use reasonable page size

            # Fetch all pages
            while True:
                params = {
                    'site-id': site_id,
                    'limit': limit,
                    'offset': offset
                }
                response = aruba_client.get('/network-monitoring/v1alpha1/clients', params=params)

                items = response.get('items', [])
                all_items.extend(items)

                # Check if there are more items
                total = response.get('total', len(items))
                offset += len(items)

                logger.info(f"Fetched {len(items)} clients (offset: {offset-len(items)}, total so far: {len(all_items)})")

                # Break if no more items or we've reached the total
                if len(items) == 0 or offset >= total:
                    break

                # Safety limit to prevent infinite loops
                if len(all_items) >= 10000:
                    logger.warning("Reached safety limit of 10000 clients")
                    break

            return jsonify({
                'count': len(all_items),
                'items': all_items,
                'total': len(all_items)
            })

        # If no site_id, try to get summary from monitoring endpoint
        # Some Central instances have endpoints that return all clients
        try:
            # Try getting client summary/count from monitoring endpoint
            response = aruba_client.get('/monitoring/v1/clients')
            return jsonify(response)
        except Exception as e:
            logger.warning(f"Monitoring clients endpoint not available: {e}")

            # Return empty result with helpful message
            return jsonify({
                'count': 0,
                'items': [],
                'message': 'Client data requires site-id parameter. Please check Clients page for site-specific data.'
            })

    except Exception as e:
        logger.error(f"Error fetching clients: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/clients/trends', methods=['GET'])
@require_session
def get_client_trends():
    """Get client connection trends, optionally filtered by site."""
    try:
        site_id = request.args.get('site_id', request.args.get('site-id'))
        params = {}
        if site_id:
            params['site-id'] = site_id

        response = aruba_client.get('/network-monitoring/v1alpha1/clients/trends', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching client trends: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/clients/usage/topn', methods=['GET'])
@require_session
def get_top_clients():
    """Get top N clients by usage, optionally filtered by site."""
    try:
        site_id = request.args.get('site_id', request.args.get('site-id'))
        params = {}
        if site_id:
            params['site-id'] = site_id

        response = aruba_client.get('/network-monitoring/v1alpha1/clients/usage/topn', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching top clients: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Site Health Endpoints =============

@app.route('/api/sites/health', methods=['GET'])
@require_session
def get_sites_health():
    """Get sites health with optional fields parameter.
    If fields=devices fails, fallback to request without fields parameter.
    """
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        
        params = request.args.to_dict()
        endpoint = '/network-monitoring/v1alpha1/sites-health'
        
        # Try with fields parameter if provided
        if 'fields' in params:
            try:
                logger.info(f"Attempting sites-health with fields={params.get('fields')}")
                response = aruba_client.get(endpoint, params=params)
                logger.info(f"✅ Sites health response received: type={type(response)}, is None: {response is None}")
                if response is None:
                    logger.warning("⚠️ Aruba Central API returned None/empty response")
                    return jsonify({"count": 0, "items": []})
                logger.info(f"✅ Response keys: {list(response.keys()) if isinstance(response, dict) else 'not a dict'}")
                logger.info(f"✅ Response count: {response.get('count', 'N/A') if isinstance(response, dict) else 'N/A'}")
                return jsonify(response)
            except Exception as e:
                error_str = str(e)
                logger.warning(f"Sites health with fields parameter failed: {error_str}")
                # If fields parameter causes error, try without it
                params_without_fields = {k: v for k, v in params.items() if k != 'fields'}
                logger.info(f"Retrying sites-health without fields parameter")
                try:
                    response = aruba_client.get(endpoint, params=params_without_fields)
                    logger.info(f"✅ Sites health fallback response: type={type(response)}, is None: {response is None}")
                    if response is None:
                        logger.warning("⚠️ Aruba Central API returned None/empty response (fallback)")
                        return jsonify({"count": 0, "items": []})
                    logger.info(f"✅ Fallback response keys: {list(response.keys()) if isinstance(response, dict) else 'not a dict'}")
                    logger.warning(f"Sites health succeeded without fields parameter. The 'fields' parameter may not be supported.")
                    return jsonify(response)
                except Exception as e2:
                    logger.error(f"Sites health failed even without fields: {e2}")
                    raise e  # Raise original error
        else:
            # No fields parameter, proceed normally
            response = aruba_client.get(endpoint, params=params)
            logger.info(f"✅ Sites health response (no fields): type={type(response)}, is None: {response is None}")
            if response is None:
                logger.warning("⚠️ Aruba Central API returned None/empty response")
                return jsonify({"count": 0, "items": []})
            logger.info(f"✅ Response keys: {list(response.keys()) if isinstance(response, dict) else 'not a dict'}")
            return jsonify(response)
    except Exception as e:
        error_str = str(e)
        logger.error(f"Sites health error: {error_str}", exc_info=True)
        
        # Extract HTTP error details if available
        import requests
        if isinstance(e, requests.HTTPError):
            try:
                error_response_text = e.response.text if hasattr(e, 'response') else None
                error_status_code = e.response.status_code if hasattr(e, 'response') else None
                return jsonify({
                    "error": f"HTTP {error_status_code}: {error_response_text or error_str}",
                    "endpoint": endpoint,
                    "params": params
                }), error_status_code or 500
            except:
                pass
        
        return jsonify({"error": error_str, "endpoint": endpoint}), 500

@app.route('/api/sites/device-health', methods=['GET'])
@require_session
@api_proxy('/network-monitoring/v1alpha1/sites-device-health', error_msg="Sites device health")
def get_sites_device_health(): pass

@app.route('/api/tenant/device-health', methods=['GET'])
@require_session
@api_proxy('/network-monitoring/v1alpha1/tenant-device-health', error_msg="Tenant device health")
def get_tenant_device_health(): pass

# ============= Network Config Sites Endpoints =============

@app.route('/api/sites/config', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/sites', error_msg="Sites config")
def get_sites_config(): pass

@app.route('/api/sites/config', methods=['POST'])
@require_session
def create_site_config():
    """Create a new site using network-config API."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        
        data = request.get_json()
        response = aruba_client.post('/network-config/v1alpha1/sites', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating site: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/sites/config', methods=['PUT'])
@require_session
def update_site_config():
    """Update an existing site using network-config API."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        
        data = request.get_json()
        response = aruba_client.put('/network-config/v1alpha1/sites', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating site: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/sites/config', methods=['DELETE'])
@require_session
def delete_site_config():
    """Delete a site using network-config API (deprecated endpoint)."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        
        scope_id = request.args.get('scope-id')
        if not scope_id:
            return jsonify({"error": "scope-id query parameter is required"}), 400
        
        params = {'scope-id': scope_id}
        response = aruba_client.delete('/network-config/v1alpha1/sites', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting site: {e}")
        return jsonify({"error": str(e)}), 500

# ============= Configuration Endpoints =============

@app.route('/api/sites', methods=['GET'])
@require_session
@api_proxy('/central/v2/sites', error_msg="Sites", fallback_data={"sites": [], "count": 0, "total": 0})
def get_sites(): pass

@app.route('/api/sites/<site_id>', methods=['GET'])
@require_session
@api_proxy(lambda site_id: f'/central/v2/sites/{site_id}', error_msg="Site details", fallback_data={})
def get_site_details(site_id): pass

@app.route('/api/sites', methods=['POST'])
@require_session
@api_proxy('/central/v2/sites', method='POST', error_msg="Create site")
def create_site(): pass

@app.route('/api/sites/<site_id>', methods=['DELETE'])
@require_session
@api_proxy(lambda site_id: f'/central/v2/sites/{site_id}', method='DELETE', error_msg="Delete site")
def delete_site(site_id): pass

@app.route('/api/groups', methods=['GET'])
@require_session
@api_proxy('/configuration/v1/groups', error_msg="Groups", fallback_data={"groups": [], "count": 0, "total": 0})
def get_groups(): pass

@app.route('/api/templates', methods=['GET'])
@require_session
@api_proxy('/configuration/v1/templates', error_msg="Templates", fallback_data={"templates": [], "count": 0, "total": 0})
def get_templates(): pass


# ============= User Management Endpoints =============

@app.route('/api/users', methods=['GET'])
@require_session
def get_users():
    """Get all users - Note: Users endpoint not available in new Central API v1alpha1."""
    try:
        # Old endpoint doesn't exist in new Central API
        # Return empty list for now
        return jsonify({
            "count": 0,
            "items": [],
            "message": "Users endpoint not available in new Central API v1alpha1"
        })
    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Network Monitoring Endpoints =============

@app.route('/api/monitoring/network-health', methods=['GET'])
@require_session
def get_network_health():
    """Get network health metrics using v1alpha1 API."""
    try:
        # Aggregate data from multiple endpoints
        health_data = {}

        # Get all devices and calculate counts
        try:
            devices = aruba_client.get('/network-monitoring/v1alpha1/devices')
            health_data['total_devices'] = devices.get('count', 0)

            # Count switches by filtering deviceType
            if 'items' in devices:
                switches_count = sum(1 for d in devices['items'] if d.get('deviceType') == 'SWITCH')
                health_data['switches'] = switches_count
            else:
                health_data['switches'] = 0
        except Exception as e:
            logger.warning(f"Error fetching devices for health: {e}")
            health_data['total_devices'] = 0
            health_data['switches'] = 0

        # Get APs
        try:
            aps = aruba_client.get('/network-monitoring/v1alpha1/aps')
            health_data['access_points'] = aps.get('count', 0)
        except Exception as e:
            logger.warning(f"Error fetching APs for health: {e}")
            health_data['access_points'] = 0

        return jsonify(health_data)
    except Exception as e:
        logger.error(f"Error fetching network health: {e}")
        return jsonify({"error": str(e)}), 500


# ============= API Explorer Endpoint =============

@app.route('/api/explore', methods=['POST'])
@require_session
def api_explorer():
    """
    Generic API explorer endpoint.
    Allows testing any Aruba Central API endpoint.
    """
    try:
        data = request.get_json()
        endpoint = data.get('endpoint', '')
        method = data.get('method', 'GET').upper()
        params = data.get('params', {})
        body = data.get('body', {})

        # Sanitize endpoint
        if not endpoint.startswith('/'):
            endpoint = '/' + endpoint

        # Execute request based on method
        try:
            if method == 'GET':
                response = aruba_client.get(endpoint, params=params)
            elif method == 'POST':
                response = aruba_client.post(endpoint, json=body)
            elif method == 'PUT':
                response = aruba_client.put(endpoint, json=body)
            elif method == 'DELETE':
                response = aruba_client.delete(endpoint)
            else:
                return jsonify({"error": f"Unsupported method: {method}"}), 400

            return jsonify({
                "success": True,
                "data": response
            })
        except Exception as api_err:
            # Return error details to help with debugging
            error_msg = str(api_err)
            status_code = 500

            if "404" in error_msg or "Not Found" in error_msg:
                status_code = 404
                error_msg = f"Endpoint not found: {endpoint}"
            elif "403" in error_msg or "Forbidden" in error_msg:
                status_code = 403
                error_msg = f"Access forbidden: {endpoint}"
            elif "401" in error_msg or "Unauthorized" in error_msg:
                status_code = 401
                error_msg = "Authentication failed"

            return jsonify({
                "success": False,
                "error": error_msg,
                "endpoint": endpoint,
                "method": method
            }), status_code
    except Exception as e:
        logger.error(f"API Explorer error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ============= NAC (Network Access Control) Endpoints =============

@app.route('/api/nac/user-roles', methods=['GET'])
@require_session
@api_proxy('/configuration/v1/user_roles', error_msg="NAC user roles")
def get_nac_user_roles(): pass

@app.route('/api/nac/device-profiles', methods=['GET'])
@require_session
@api_proxy('/configuration/v1/device_profile', error_msg="NAC device profiles")
def get_nac_device_profiles(): pass


@app.route('/api/nac/client-auth', methods=['GET'])
@require_session
def get_nac_client_auth():
    """Get NAC client authentication status."""
    try:
        site_id = request.args.get('site_id', request.args.get('site-id'))

        if not site_id:
            return jsonify({
                "error": "site-id parameter is required",
                "message": "Please provide site-id as a query parameter"
            }), 400

        params = {'site-id': site_id}
        response = aruba_client.get('/network-monitoring/v1alpha1/clients', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching NAC client auth: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/nac/policies', methods=['GET'])
@require_session
@api_proxy('/configuration/v1/auth_policies', error_msg="NAC policies")
def get_nac_policies(): pass

@app.route('/api/nac/certificates', methods=['GET'])
@require_session
@api_proxy('/configuration/v1/certificates', error_msg="NAC certificates")
def get_nac_certificates(): pass

@app.route('/api/nac/radius-profiles', methods=['GET'])
@require_session
@api_proxy('/configuration/v1/radius_server', error_msg="RADIUS profiles")
def get_nac_radius_profiles(): pass

@app.route('/api/nac/onboarding-rules', methods=['GET'])
@require_session
@api_proxy('/configuration/v1/onboarding_rules', error_msg="Onboarding rules")
def get_nac_onboarding_rules(): pass


# ============= Scope Management Endpoints =============

@app.route('/api/scope/labels', methods=['GET'])
@require_session
@api_proxy('/central/v2/labels', error_msg="Labels", fallback_data={"labels": [], "count": 0, "total": 0})
def get_scope_labels(): pass

@app.route('/api/scope/labels', methods=['POST'])
@require_session
@api_proxy('/central/v2/labels', method='POST', error_msg="Create label")
def create_scope_label(): pass

@app.route('/api/scope/labels/<label_id>', methods=['DELETE'])
@require_session
@api_proxy(lambda label_id: f'/central/v2/labels/{label_id}', method='DELETE', error_msg="Delete label")
def delete_scope_label(label_id): pass


@app.route('/api/scope/label-associations', methods=['GET'])
@require_session
def get_label_associations():
    """Get device and site associations for labels."""
    try:
        label_id = request.args.get('label_id')
        if not label_id:
            return jsonify({"error": "label_id parameter required"}), 400

        response = aruba_client.get(f'/central/v2/labels/{label_id}/associations')
        return jsonify(response)
    except Exception as e:
        error_str = str(e)
        logger.error(f"Error fetching label associations: {error_str}")
        # Return empty associations on 404
        if "404" in error_str or "Not Found" in error_str:
            return jsonify({"devices": [], "sites": [], "count": 0})
        return jsonify({"error": error_str}), 500


@app.route('/api/scope/geofences', methods=['GET'])
@require_session
@api_proxy('/central/v2/geofences', error_msg="Geofences", fallback_data={"geofences": [], "count": 0, "total": 0})
def get_geofences(): pass


@app.route('/api/scope/site-hierarchy', methods=['GET'])
@require_session
def get_site_hierarchy():
    """Get site hierarchy and relationships."""
    try:
        # Get all sites first
        sites_response = aruba_client.get('/central/v2/sites')
        sites = sites_response.get('sites', [])

        # Build hierarchy structure
        hierarchy = {
            'sites': sites,
            'total': len(sites),
            'hierarchy': {}
        }

        # Group by any parent/child relationships if available
        for site in sites:
            site_id = site.get('site_id')
            if site_id:
                hierarchy['hierarchy'][site_id] = site

        return jsonify(hierarchy)
    except Exception as e:
        error_str = str(e)
        logger.error(f"Error fetching site hierarchy: {error_str}")
        # Return empty hierarchy on 404
        if "404" in error_str or "Not Found" in error_str:
            return jsonify({"sites": [], "total": 0, "hierarchy": {}})
        return jsonify({"error": error_str}), 500


# ============= Application Experience Endpoints =============

@app.route('/api/appexperience/applications', methods=['GET'])
@require_session
@api_proxy('/monitoring/v1/applications', error_msg="Applications")
def get_applications(): pass

@app.route('/api/appexperience/app-categories', methods=['GET'])
@require_session
@api_proxy('/monitoring/v1/app_categories', error_msg="App categories")
def get_app_categories(): pass


@app.route('/api/appexperience/traffic-analysis', methods=['GET'])
@require_session
def get_traffic_analysis():
    """Get application traffic analysis data."""
    try:
        # Get traffic data with filters
        params = {}
        if request.args.get('app_name'):
            params['app_name'] = request.args.get('app_name')
        if request.args.get('site_id'):
            params['site_id'] = request.args.get('site_id')
        if request.args.get('from_timestamp'):
            params['from_timestamp'] = request.args.get('from_timestamp')
        if request.args.get('to_timestamp'):
            params['to_timestamp'] = request.args.get('to_timestamp')

        response = aruba_client.get('/monitoring/v1/app_analytics', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching traffic analysis: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/appexperience/qos-policies', methods=['GET'])
@require_session
@api_proxy('/configuration/v1/qos', error_msg="QoS policies")
def get_qos_policies(): pass

@app.route('/api/appexperience/dpi-settings', methods=['GET'])
@require_session
@api_proxy('/configuration/v1/dpi', error_msg="DPI settings")
def get_dpi_settings(): pass


@app.route('/api/appexperience/app-visibility', methods=['GET'])
@require_session
def get_app_visibility():
    """Get application visibility settings and stats."""
    try:
        group = request.args.get('group', 'all')
        params = {'group': group} if group != 'all' else {}
        response = aruba_client.get('/monitoring/v1/app_visibility', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching app visibility: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Troubleshooting Endpoints =============

@app.route('/api/troubleshoot/ping', methods=['POST'])
@require_session
def troubleshoot_ping():
    """Execute ping test from device."""
    try:
        data = request.get_json()
        device_serial = data.get('device_serial')
        target = data.get('target')

        if not device_serial or not target:
            return jsonify({"error": "device_serial and target are required"}), 400

        # Use tools API for ping
        response = aruba_client.post(
            f'/device-management/v1/device/{device_serial}/action/ping',
            json={"host": target}
        )
        return jsonify(response)
    except Exception as e:
        logger.error(f"Ping troubleshooting error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/traceroute', methods=['POST'])
@require_session
def troubleshoot_traceroute():
    """Execute traceroute test from device."""
    try:
        data = request.get_json()
        device_serial = data.get('device_serial')
        target = data.get('target')

        if not device_serial or not target:
            return jsonify({"error": "device_serial and target are required"}), 400

        response = aruba_client.post(
            f'/device-management/v1/device/{device_serial}/action/traceroute',
            json={"host": target}
        )
        return jsonify(response)
    except Exception as e:
        logger.error(f"Traceroute troubleshooting error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/device-logs', methods=['GET'])
@require_session
def get_device_logs():
    """Get device logs for troubleshooting."""
    try:
        device_serial = request.args.get('serial')
        if not device_serial:
            return jsonify({"error": "Device serial required"}), 400

        response = aruba_client.get(f'/device-management/v1/device/{device_serial}/logs')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching device logs: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/client-session', methods=['GET'])
@require_session
def get_client_session():
    """Get client session details for troubleshooting."""
    try:
        mac_address = request.args.get('mac')
        if not mac_address:
            return jsonify({"error": "MAC address required"}), 400

        response = aruba_client.get(f'/network-monitoring/v1alpha1/clients/{mac_address}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching client session: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/ap-diagnostics', methods=['GET'])
@require_session
def get_ap_diagnostics():
    """Get AP diagnostics for troubleshooting."""
    try:
        serial = request.args.get('serial')
        if not serial:
            return jsonify({"error": "AP serial required"}), 400

        response = aruba_client.get(f'/network-monitoring/v1alpha1/aps/{serial}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching AP diagnostics: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/ap-radio-stats', methods=['GET'])
@require_session
def get_ap_radio_stats():
    """Get AP radio statistics for troubleshooting wireless issues."""
    try:
        serial = request.args.get('serial')
        if not serial:
            return jsonify({"error": "AP serial required"}), 400

        response = aruba_client.get(f'/network-monitoring/v1alpha1/aps/{serial}/radio-stats')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching AP radio stats: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/ap-interference', methods=['GET'])
@require_session
def get_ap_interference():
    """Get AP interference analysis."""
    try:
        serial = request.args.get('serial')
        if not serial:
            return jsonify({"error": "AP serial required"}), 400

        response = aruba_client.get(f'/network-monitoring/v1alpha1/aps/{serial}/interference')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching AP interference: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/client-connectivity', methods=['POST'])
@require_session
def troubleshoot_client_connectivity():
    """Perform comprehensive client connectivity troubleshooting."""
    try:
        data = request.get_json()
        mac_address = data.get('mac_address')

        if not mac_address:
            return jsonify({"error": "mac_address is required"}), 400

        # Get client details
        client = aruba_client.get(f'/network-monitoring/v1alpha1/clients/{mac_address}')

        # Get associated AP if available
        ap_details = None
        if 'associatedDevice' in client or 'apSerial' in client:
            ap_serial = client.get('associatedDevice') or client.get('apSerial')
            if ap_serial:
                try:
                    ap_details = aruba_client.get(f'/network-monitoring/v1alpha1/aps/{ap_serial}')
                except Exception as e:
                    logger.warning(f"Could not fetch AP details: {e}")

        troubleshooting_data = {
            'client': client,
            'ap': ap_details,
            'timestamp': time.time()
        }

        return jsonify(troubleshooting_data)
    except Exception as e:
        logger.error(f"Error troubleshooting client connectivity: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/bandwidth-test', methods=['POST'])
@require_session
def troubleshoot_bandwidth_test():
    """Execute bandwidth test on device."""
    try:
        data = request.get_json()
        device_serial = data.get('device_serial')

        if not device_serial:
            return jsonify({"error": "device_serial is required"}), 400

        response = aruba_client.post(
            f'/device-management/v1/device/{device_serial}/action/bandwidth-test',
            json=data
        )
        return jsonify(response)
    except Exception as e:
        logger.error(f"Bandwidth test error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/switch-port-status', methods=['GET'])
@require_session
def get_switch_port_status():
    """Get switch port status for troubleshooting connectivity issues."""
    try:
        serial = request.args.get('serial')
        port = request.args.get('port')

        if not serial:
            return jsonify({"error": "Switch serial required"}), 400

        if port:
            # Get specific port details
            response = aruba_client.get(f'/network-monitoring/v1alpha1/switch/{serial}/interfaces/{port}')
        else:
            # Get all interfaces
            response = aruba_client.get(f'/network-monitoring/v1alpha1/switch/{serial}/interfaces')

        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching switch port status: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Alerts and Events Endpoints =============

@app.route('/api/alerts', methods=['GET'])
@require_session
def get_alerts():
    """Get all alerts."""
    try:
        # Get query parameters for filtering
        severity = request.args.get('severity')
        limit = request.args.get('limit', 100)

        params = {'limit': limit}
        if severity:
            params['severity'] = severity

        # Try the network-monitoring API first
        try:
            response = aruba_client.get('/network-monitoring/v1alpha1/alerts', params=params)
            return jsonify(response)
        except Exception as network_err:
            # Fallback: Return empty alerts list if endpoint doesn't exist
            if "404" in str(network_err) or "Not Found" in str(network_err):
                logger.warning(f"Alerts endpoint not available: {network_err}")
                return jsonify({"alerts": [], "count": 0, "total": 0})
            raise network_err
    except Exception as e:
        logger.error(f"Error fetching alerts: {e}")
        # Return empty data instead of 500 error
        return jsonify({"alerts": [], "count": 0, "total": 0, "error": "Alerts API not available"})


@app.route('/api/alerts/<alert_id>', methods=['GET'])
@require_session
def get_alert_details(alert_id):
    """Get alert details by ID."""
    try:
        response = aruba_client.get(f'/network-monitoring/v1alpha1/alerts/{alert_id}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching alert {alert_id}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/alerts/<alert_id>/acknowledge', methods=['POST'])
@require_session
def acknowledge_alert(alert_id):
    """Acknowledge an alert."""
    try:
        response = aruba_client.post(f'/network-monitoring/v1alpha1/alerts/{alert_id}/acknowledge')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error acknowledging alert {alert_id}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/events', methods=['GET'])
@require_session
def get_events():
    """Get system events."""
    try:
        limit = request.args.get('limit', 100)
        event_type = request.args.get('type')

        params = {'limit': limit}
        if event_type:
            params['type'] = event_type

        response = aruba_client.get('/monitoring/v1/events', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching events: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Firmware Management Endpoints =============

@app.route('/api/firmware/versions', methods=['GET'])
@require_session
def get_firmware_versions():
    """Get available firmware versions."""
    try:
        device_type = request.args.get('device_type', 'IAP')
        response = aruba_client.get(f'/firmware/v1/versions/{device_type}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching firmware versions: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/firmware/compliance', methods=['GET'])
@require_session
def get_firmware_compliance():
    """Get firmware compliance status for devices."""
    try:
        # Try different firmware API endpoints
        try:
            response = aruba_client.get('/firmware/v1/status')
            return jsonify(response)
        except Exception as fw_err:
            # Try alternative endpoint
            if "404" in str(fw_err) or "Not Found" in str(fw_err):
                try:
                    response = aruba_client.get('/platform/device_inventory/v1/devices')
                    # Transform to compliance format
                    devices = response.get('devices', [])
                    return jsonify({
                        "compliant": sum(1 for d in devices if d.get('firmware_compliant', False)),
                        "non_compliant": sum(1 for d in devices if not d.get('firmware_compliant', True)),
                        "total": len(devices),
                        "devices": devices
                    })
                except:
                    # Return empty compliance data
                    logger.warning("Firmware compliance endpoint not available")
                    return jsonify({"compliant": 0, "non_compliant": 0, "total": 0, "devices": []})
            raise fw_err
    except Exception as e:
        logger.error(f"Error fetching firmware compliance: {e}")
        return jsonify({"compliant": 0, "non_compliant": 0, "total": 0, "devices": [], "error": "Firmware API not available"})


@app.route('/api/firmware/upgrade', methods=['POST'])
@require_session
def schedule_firmware_upgrade():
    """Schedule firmware upgrade for devices."""
    try:
        data = request.get_json()
        response = aruba_client.post('/firmware/v1/upgrade', json=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error scheduling firmware upgrade: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Analytics and Reports Endpoints =============

@app.route('/api/analytics/bandwidth', methods=['GET'])
@require_session
def get_bandwidth_analytics():
    """Get bandwidth usage analytics."""
    try:
        timeframe = request.args.get('timeframe', '1d')
        response = aruba_client.get(f'/monitoring/v1/networks/bandwidth_usage?timeframe={timeframe}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching bandwidth analytics: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analytics/client-count', methods=['GET'])
@require_session
def get_client_count_analytics():
    """Get client count trends over time."""
    try:
        timeframe = request.args.get('timeframe', '1d')
        response = aruba_client.get(f'/monitoring/v1/clients/count?timeframe={timeframe}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching client count analytics: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analytics/device-uptime', methods=['GET'])
@require_session
def get_device_uptime():
    """Get device uptime statistics."""
    try:
        response = aruba_client.get('/monitoring/v1/devices/uptime')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching device uptime: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analytics/ap-performance', methods=['GET'])
@require_session
def get_ap_performance():
    """Get AP performance metrics."""
    try:
        response = aruba_client.get('/monitoring/v1/aps/performance')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching AP performance: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Bulk Configuration Endpoints =============

@app.route('/api/config/bulk-ap-rename', methods=['POST'])
@require_session
def bulk_ap_rename():
    """Bulk rename access points from CSV data."""
    try:
        data = request.get_json()
        ap_mappings = data.get('mappings', [])  # [{'serial': 'xxx', 'new_name': 'yyy'}, ...]

        if not ap_mappings:
            return jsonify({"error": "No AP mappings provided"}), 400

        results = []
        for mapping in ap_mappings:
            serial = mapping.get('serial')
            new_name = mapping.get('new_name')

            if not serial or not new_name:
                results.append({
                    "serial": serial,
                    "status": "failed",
                    "error": "Missing serial or new_name"
                })
                continue

            try:
                # Update AP name via Central API
                response = aruba_client.post(
                    f'/configuration/v1/ap/{serial}',
                    json={"hostname": new_name}
                )
                results.append({
                    "serial": serial,
                    "new_name": new_name,
                    "status": "success"
                })
            except Exception as e:
                results.append({
                    "serial": serial,
                    "status": "failed",
                    "error": str(e)
                })

        success_count = sum(1 for r in results if r['status'] == 'success')
        return jsonify({
            "total": len(ap_mappings),
            "successful": success_count,
            "failed": len(ap_mappings) - success_count,
            "results": results
        })
    except Exception as e:
        logger.error(f"Bulk AP rename error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/config/bulk-group-assign', methods=['POST'])
@require_session
def bulk_group_assign():
    """Bulk assign devices to groups."""
    try:
        data = request.get_json()
        device_group_mappings = data.get('mappings', [])  # [{'serial': 'xxx', 'group': 'yyy'}, ...]

        results = []
        for mapping in device_group_mappings:
            serial = mapping.get('serial')
            group = mapping.get('group')

            if not serial or not group:
                results.append({
                    "serial": serial,
                    "status": "failed",
                    "error": "Missing serial or group"
                })
                continue

            try:
                response = aruba_client.post(
                    f'/configuration/v2/devices/{serial}/group',
                    json={"group": group}
                )
                results.append({
                    "serial": serial,
                    "group": group,
                    "status": "success"
                })
            except Exception as e:
                results.append({
                    "serial": serial,
                    "status": "failed",
                    "error": str(e)
                })

        success_count = sum(1 for r in results if r['status'] == 'success')
        return jsonify({
            "total": len(device_group_mappings),
            "successful": success_count,
            "failed": len(device_group_mappings) - success_count,
            "results": results
        })
    except Exception as e:
        logger.error(f"Bulk group assign error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/config/bulk-site-assign', methods=['POST'])
@require_session
def bulk_site_assign():
    """Bulk assign devices to sites."""
    try:
        data = request.get_json()
        device_site_mappings = data.get('mappings', [])

        results = []
        for mapping in device_site_mappings:
            serial = mapping.get('serial')
            site_id = mapping.get('site_id')

            if not serial or not site_id:
                results.append({
                    "serial": serial,
                    "status": "failed",
                    "error": "Missing serial or site_id"
                })
                continue

            try:
                response = aruba_client.post(
                    f'/central/v2/sites/associations',
                    json={"device_id": serial, "site_id": site_id}
                )
                results.append({
                    "serial": serial,
                    "site_id": site_id,
                    "status": "success"
                })
            except Exception as e:
                results.append({
                    "serial": serial,
                    "status": "failed",
                    "error": str(e)
                })

        success_count = sum(1 for r in results if r['status'] == 'success')
        return jsonify({
            "total": len(device_site_mappings),
            "successful": success_count,
            "failed": len(device_site_mappings) - success_count,
            "results": results
        })
    except Exception as e:
        logger.error(f"Bulk site assign error: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Device Information Endpoints (Configuration API) =============

@app.route('/api/devices/<serial>/info', methods=['GET'])
@require_session
def get_device_info(serial):
    """Get device information from configuration API (device-info endpoint).
    
    This uses the Aruba Central Configuration API which may include device status,
    hardware information, and potentially temperature/CPU/memory data.
    Reference: https://internal-ui.central.arubanetworks.com/cnxconfig/docs
    """
    try:
        # Try configuration API device-info endpoint
        # Format may vary - trying common patterns
        try:
            response = aruba_client.get(f'/configuration/v1/device-info/{serial}')
            return jsonify(response)
        except Exception as e1:
            # Try alternative path
            try:
                response = aruba_client.get(f'/configuration/v1/devices/{serial}/device-info')
                return jsonify(response)
            except Exception as e2:
                # Try system-info endpoint
                try:
                    response = aruba_client.get(f'/configuration/v1/system-info/{serial}')
                    return jsonify(response)
                except Exception as e3:
                    logger.warning(f"Device info endpoints not found. Tried: device-info/{serial}, devices/{serial}/device-info, system-info/{serial}")
                    return jsonify({
                        "error": "Device info endpoint not found",
                        "message": "Configuration API device-info endpoints not available. Trying device details from monitoring API.",
                        "suggestion": "Use /api/monitoring/aps/{serial} or /api/monitoring/switches/{serial} for device information"
                    }), 404
    except Exception as e:
        logger.error(f"Error fetching device info for {serial}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/devices/upload-image', methods=['POST'])
@require_session
def upload_device_image():
    """Upload and save a device image with background removed."""
    try:
        logger.info(f"Upload request received. Files: {list(request.files.keys())}, Form data: {list(request.form.keys())}")
        
        if 'image' not in request.files:
            logger.error("No 'image' key in request.files")
            return jsonify({"error": "No image file provided"}), 400
        
        file = request.files['image']
        part_number = request.form.get('partNumber')
        
        logger.info(f"File received: {file.filename}, Part number: {part_number}, Content type: {file.content_type}")
        
        if not part_number:
            return jsonify({"error": "Part number is required"}), 400
        
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            logger.warning(f"Invalid content type: {file.content_type}")
            return jsonify({"error": f"File must be an image. Received: {file.content_type}"}), 400
        
        # Create devices directory if it doesn't exist
        # Path resolution: backend/app.py -> backend -> dashboard -> frontend/public/images/devices
        backend_dir = Path(__file__).parent
        devices_dir = backend_dir.parent / 'frontend' / 'public' / 'images' / 'devices'
        
        logger.info(f"Devices directory path: {devices_dir}")
        
        # Create directory if it doesn't exist
        try:
            devices_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"Directory created/verified: {devices_dir}")
        except Exception as dir_error:
            logger.error(f"Error creating directory: {dir_error}")
            return jsonify({"error": f"Failed to create directory: {str(dir_error)}"}), 500
        
        # Determine file extension from uploaded file
        # If it's already PNG, keep it; otherwise convert to PNG
        original_ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else 'png'
        # Always save as PNG for consistency (background removal outputs PNG)
        filename = f"{part_number}.png"
        filepath = devices_dir / filename
        
        logger.info(f"Saving file to: {filepath}")
        
        # Save the file
        try:
            file.save(str(filepath))
            logger.info(f"File saved successfully: {filename}")
        except Exception as save_error:
            logger.error(f"Error saving file: {save_error}")
            return jsonify({"error": f"Failed to save file: {str(save_error)}"}), 500
        
        # Verify file was saved
        if not filepath.exists():
            logger.error(f"File was not saved: {filepath}")
            return jsonify({"error": "File was not saved successfully"}), 500
        
        return jsonify({
            "success": True,
            "message": f"Image uploaded successfully as {filename}",
            "filename": filename
        })
    except Exception as e:
        logger.error(f"Error uploading device image: {e}", exc_info=True)
        return jsonify({"error": str(e), "type": type(e).__name__}), 500


@app.route('/api/devices/<serial>/system-info', methods=['GET'])
@require_session
def get_device_system_info(serial):
    """Get system information from configuration API (system-info endpoint).
    
    Reference: https://internal-ui.central.arubanetworks.com/cnxconfig/docs
    This may include CPU, memory, temperature, and other system metrics.
    """
    try:
        # Try system-info endpoint - format may vary
        try:
            response = aruba_client.get(f'/configuration/v1/system-info/{serial}')
            return jsonify(response)
        except Exception as e1:
            # Try alternative path
            try:
                response = aruba_client.get(f'/configuration/v1/devices/{serial}/system-info')
                return jsonify(response)
            except Exception as e2:
                logger.warning(f"System info endpoint not found for {serial}")
                return jsonify({
                    "error": "System info endpoint not found",
                    "message": "Configuration API system-info endpoint not available for this device.",
                    "suggestion": "Check device type and try device-specific endpoints like /api/monitoring/aps/{serial}/cpu"
                }), 404
    except Exception as e:
        logger.error(f"Error fetching system info for {serial}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/aps/<serial>/system', methods=['GET'])
@require_session
def get_ap_system(serial):
    """Get AP system information from configuration API (ap-system endpoint).
    
    Reference: https://internal-ui.central.arubanetworks.com/cnxconfig/docs
    The ap-system endpoint may include system status, temperature, and hardware info.
    """
    try:
        # Try ap-system endpoint
        try:
            response = aruba_client.get(f'/configuration/v1/ap-system/{serial}')
            return jsonify(response)
        except Exception as e1:
            # Try alternative path
            try:
                response = aruba_client.get(f'/configuration/v1/aps/{serial}/ap-system')
                return jsonify(response)
            except Exception as e2:
                logger.warning(f"AP system endpoint not found for {serial}")
                return jsonify({
                    "error": "AP system endpoint not found",
                    "message": "Configuration API ap-system endpoint not available.",
                    "suggestion": "Try /api/monitoring/aps/{serial} for AP monitoring data"
                }), 404
    except Exception as e:
        logger.error(f"Error fetching AP system info for {serial}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/switches/<serial>/system', methods=['GET'])
@require_session
def get_switch_system(serial):
    """Get switch system information from configuration API (switch-system endpoint).
    
    Reference: https://internal-ui.central.arubanetworks.com/cnxconfig/docs
    The switch-system endpoint may include system status, temperature, CPU, memory, and hardware info.
    """
    try:
        # Try switch-system endpoint
        try:
            response = aruba_client.get(f'/configuration/v1/switch-system/{serial}')
            return jsonify(response)
        except Exception as e1:
            # Try alternative path
            try:
                response = aruba_client.get(f'/configuration/v1/switches/{serial}/switch-system')
                return jsonify(response)
            except Exception as e2:
                logger.warning(f"Switch system endpoint not found for {serial}")
                return jsonify({
                    "error": "Switch system endpoint not found",
                    "message": "Configuration API switch-system endpoint not available.",
                    "suggestion": "Try /api/monitoring/switches/{serial} for switch monitoring data"
                }), 404
    except Exception as e:
        logger.error(f"Error fetching switch system info for {serial}: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Show Commands / Configuration Export Endpoints =============

@app.route('/api/troubleshoot/show-run-config', methods=['GET'])
@require_session
def show_run_config():
    """Get running configuration from a device."""
    try:
        serial = request.args.get('serial')
        if not serial:
            return jsonify({"error": "Device serial required"}), 400

        # Fetch running config
        response = aruba_client.get(f'/configuration/v1/devices/{serial}/configuration')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Show run config error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/show-tech-support', methods=['GET'])
@require_session
def show_tech_support():
    """Get tech support information from a device."""
    try:
        serial = request.args.get('serial')
        if not serial:
            return jsonify({"error": "Device serial required"}), 400

        response = aruba_client.get(f'/troubleshooting/v1/devices/{serial}/tech-support')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Show tech support error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/show-version', methods=['GET'])
@require_session
def show_version():
    """Get device version information."""
    try:
        serial = request.args.get('serial')
        if not serial:
            return jsonify({"error": "Device serial required"}), 400

        # Get device details which includes version
        response = aruba_client.get(f'/network-monitoring/v1alpha1/devices')

        # Filter for the specific device
        if 'items' in response:
            device = next((d for d in response['items'] if d.get('serial') == serial or d.get('serialNumber') == serial), None)
            if device:
                return jsonify({
                    "serial": serial,
                    "firmware_version": device.get('firmwareVersion') or device.get('firmware_version'),
                    "model": device.get('model'),
                    "device_type": device.get('deviceType'),
                    "uptime": device.get('uptime'),
                    "status": device.get('status')
                })

        return jsonify({"error": "Device not found"}), 404
    except Exception as e:
        logger.error(f"Show version error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/show-interfaces', methods=['GET'])
@require_session
def show_interfaces():
    """Get interface information from a switch."""
    try:
        serial = request.args.get('serial')
        if not serial:
            return jsonify({"error": "Device serial required"}), 400

        response = aruba_client.get(f'/network-monitoring/v1alpha1/switch/{serial}/interfaces')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Show interfaces error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/config/export', methods=['GET'])
@require_session
def export_configuration():
    """Export device configuration."""
    try:
        serial = request.args.get('serial')
        if not serial:
            return jsonify({"error": "Device serial required"}), 400

        response = aruba_client.get(f'/configuration/v1/devices/{serial}/configuration')

        # Return as downloadable file
        from flask import make_response
        config_text = response.get('configuration', json.dumps(response, indent=2))

        resp = make_response(config_text)
        resp.headers['Content-Type'] = 'text/plain'
        resp.headers['Content-Disposition'] = f'attachment; filename={serial}_config.txt'
        return resp
    except Exception as e:
        logger.error(f"Config export error: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Setup & Configuration Endpoints =============

@app.route('/api/setup/check', methods=['GET'])
def check_setup():
    """Check if credentials are configured."""
    return jsonify({
        "configured": credentials_configured,
        "needs_setup": not credentials_configured
    })


@app.route('/api/setup/configure', methods=['POST'])
def configure_credentials():
    """Configure Aruba Central credentials via UI."""
    global aruba_client, token_manager, config, credentials_configured

    try:
        data = request.get_json()
        client_id = data.get('client_id', '').strip()
        client_secret = data.get('client_secret', '').strip()
        customer_id = data.get('customer_id', '').strip()
        base_url = data.get('base_url', 'https://internal.api.central.arubanetworks.com').strip()

        # Validate inputs
        if not all([client_id, client_secret, customer_id]):
            return jsonify({"error": "All fields are required"}), 400

        # Write to .env file
        env_path = Path(__file__).parent.parent.parent / '.env'
        env_content = f"""# Aruba Central API Configuration (New Central / HPE GreenLake)
# Generated by Setup Wizard

# Aruba Central API Base URL
ARUBA_BASE_URL={base_url}

# OAuth2 Credentials
ARUBA_CLIENT_ID={client_id}
ARUBA_CLIENT_SECRET={client_secret}
ARUBA_CUSTOMER_ID={customer_id}
"""

        # Try to write to .env file with proper error handling
        import os
        import stat
        env_write_success = False

        try:
            # First try to change permissions if possible
            try:
                os.chmod(env_path, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IWGRP | stat.S_IROTH | stat.S_IWOTH)
            except (OSError, PermissionError):
                pass  # If we can't chmod, try writing anyway

            env_path.write_text(env_content)
            logger.info(f"Credentials saved to {env_path}")
            env_write_success = True
        except (OSError, PermissionError) as e:
            logger.warning(f"Could not write to {env_path}: {e}. Setting environment variables directly.")

        # Set environment variables (either from file or directly)
        if env_write_success:
            # Reload environment variables from file
            from dotenv import load_dotenv
            try:
                load_dotenv(env_path, override=True)
                logger.info("Environment variables reloaded from file")
            except (OSError, PermissionError) as e:
                logger.warning(f"Could not read {env_path}: {e}. Setting directly.")
                env_write_success = False

        if not env_write_success:
            # Fallback: Set environment variables directly in the current process
            os.environ['ARUBA_BASE_URL'] = base_url
            os.environ['ARUBA_CLIENT_ID'] = client_id
            os.environ['ARUBA_CLIENT_SECRET'] = client_secret
            os.environ['ARUBA_CUSTOMER_ID'] = customer_id
            logger.info("Credentials set in environment variables directly")

        # Reinitialize client with new credentials
        if initialize_client():
            # Send SIGHUP to gunicorn master process to reload all workers
            # This ensures all workers pick up the new credentials
            try:
                import signal
                import os
                master_pid = os.getppid()  # Parent process is gunicorn master
                logger.info(f"Sending SIGHUP to gunicorn master (pid: {master_pid}) to reload workers")
                os.kill(master_pid, signal.SIGHUP)
                logger.info("Worker reload signal sent successfully")
            except Exception as e:
                logger.warning(f"Could not reload workers automatically: {e}")
                logger.info("Workers will reload on next container restart")

            # Create a session automatically so user doesn't have to login again
            import secrets
            session_id = secrets.token_urlsafe(32)
            active_sessions[session_id] = {
                'created': time.time(),
                'expires': time.time() + SESSION_TIMEOUT
            }
            logger.info("Session created automatically after credential configuration")

            return jsonify({
                "success": True,
                "message": "Credentials configured successfully! Workers reloading...",
                "configured": True,
                "session_id": session_id,
                "expires_in": SESSION_TIMEOUT
            })
        else:
            return jsonify({
                "error": "Credentials saved but failed to initialize client. Please check your credentials."
            }), 500

    except Exception as e:
        logger.error(f"Error configuring credentials: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Workspace Management Endpoints =============
# ============= Reporting Endpoints =============

@app.route('/api/reporting/top-aps-by-wireless-usage', methods=['GET'])
@require_session
def get_top_aps_by_wireless_usage():
    """Get top access points by wireless bandwidth usage."""
    try:
        site_id = request.args.get('site_id', request.args.get('site-id'))
        count = request.args.get('count', 10)
        from_timestamp = request.args.get('from_timestamp')
        to_timestamp = request.args.get('to_timestamp')

        params = {'count': count}
        if site_id:
            params['site-id'] = site_id
        if from_timestamp:
            params['from_timestamp'] = from_timestamp
        if to_timestamp:
            params['to_timestamp'] = to_timestamp

        response = aruba_client.get('/network-monitoring/v1alpha1/top-aps-by-wireless-usage', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching top APs by wireless usage: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/reporting/top-aps-by-client-count', methods=['GET'])
@require_session
def get_top_aps_by_client_count():
    """Get top access points by connected client count."""
    try:
        site_id = request.args.get('site_id', request.args.get('site-id'))
        count = request.args.get('count', 10)

        params = {'count': count}
        if site_id:
            params['site-id'] = site_id

        response = aruba_client.get('/network-monitoring/v1alpha1/top-aps-by-client-count', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching top APs by client count: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/reporting/network-usage', methods=['GET'])
@require_session
def get_network_usage_report():
    """Get network usage report."""
    try:
        site_id = request.args.get('site_id', request.args.get('site-id'))
        timeframe = request.args.get('timeframe', '1d')

        params = {'timeframe': timeframe}
        if site_id:
            params['site-id'] = site_id

        response = aruba_client.get('/network-monitoring/v1alpha1/network-usage', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching network usage report: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/reporting/device-inventory', methods=['GET'])
@require_session
def get_device_inventory_report():
    """Get device inventory report with detailed statistics."""
    try:
        # Get all devices
        devices_response = aruba_client.get('/network-monitoring/v1alpha1/devices')

        if 'items' not in devices_response:
            return jsonify({"error": "No devices data available"}), 500

        devices = devices_response['items']

        # Aggregate statistics
        inventory = {
            'total_devices': len(devices),
            'by_type': {},
            'by_status': {},
            'by_site': {},
            'by_model': {},
            'devices': devices
        }

        for device in devices:
            device_type = device.get('deviceType', 'Unknown')
            status = device.get('status', 'Unknown')
            site = device.get('siteName', 'Unassigned')
            model = device.get('model', 'Unknown')

            inventory['by_type'][device_type] = inventory['by_type'].get(device_type, 0) + 1
            inventory['by_status'][status] = inventory['by_status'].get(status, 0) + 1
            inventory['by_site'][site] = inventory['by_site'].get(site, 0) + 1
            inventory['by_model'][model] = inventory['by_model'].get(model, 0) + 1

        return jsonify(inventory)
    except Exception as e:
        logger.error(f"Error generating device inventory report: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/reporting/wireless-health', methods=['GET'])
@require_session
def get_wireless_health_report():
    """Get wireless network health report."""
    try:
        site_id = request.args.get('site_id', request.args.get('site-id'))

        params = {}
        if site_id:
            params['site-id'] = site_id

        response = aruba_client.get('/network-monitoring/v1alpha1/wireless-health', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching wireless health report: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/reporting/top-ssids-by-usage', methods=['GET'])
@require_session
def get_top_ssids_by_usage():
    """Get top SSIDs by usage."""
    try:
        site_id = request.args.get('site_id', request.args.get('site-id'))
        count = request.args.get('count', 10)

        params = {'count': count}
        if site_id:
            params['site-id'] = site_id

        response = aruba_client.get('/network-monitoring/v1alpha1/top-ssids-by-usage', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching top SSIDs by usage: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Services Endpoints =============

@app.route('/api/services/health', methods=['GET'])
@require_session
def get_services_health():
    """Get overall service health status."""
    try:
        # Aggregate health from multiple sources
        health_status = {
            'overall_status': 'healthy',
            'services': [],
            'timestamp': time.time()
        }

        # Check device service
        try:
            devices = aruba_client.get('/network-monitoring/v1alpha1/devices')
            device_count = devices.get('count', 0)
            health_status['services'].append({
                'name': 'Device Management',
                'status': 'up',
                'details': f'{device_count} devices monitored'
            })
        except Exception as e:
            health_status['services'].append({
                'name': 'Device Management',
                'status': 'error',
                'details': str(e)
            })
            health_status['overall_status'] = 'degraded'

        # Check wireless service
        try:
            wlans = aruba_client.get('/network-monitoring/v1alpha1/wlans')
            wlan_count = wlans.get('count', 0)
            health_status['services'].append({
                'name': 'Wireless Services',
                'status': 'up',
                'details': f'{wlan_count} WLANs configured'
            })
        except Exception as e:
            health_status['services'].append({
                'name': 'Wireless Services',
                'status': 'error',
                'details': str(e)
            })
            health_status['overall_status'] = 'degraded'

        # Check site service
        try:
            sites = aruba_client.get('/central/v2/sites')
            site_count = sites.get('total', 0)
            health_status['services'].append({
                'name': 'Site Management',
                'status': 'up',
                'details': f'{site_count} sites configured'
            })
        except Exception as e:
            health_status['services'].append({
                'name': 'Site Management',
                'status': 'error',
                'details': str(e)
            })
            health_status['overall_status'] = 'degraded'

        return jsonify(health_status)
    except Exception as e:
        logger.error(f"Error fetching services health: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/services/subscriptions', methods=['GET'])
@require_session
def get_service_subscriptions():
    """Get service subscriptions and licenses."""
    try:
        response = aruba_client.get('/platform/licensing/v1/subscriptions')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching service subscriptions: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/services/audit-logs', methods=['GET'])
@require_session
def get_service_audit_logs():
    """Get service audit logs."""
    try:
        limit = request.args.get('limit', 100)
        offset = request.args.get('offset', 0)

        params = {
            'limit': limit,
            'offset': offset
        }

        response = aruba_client.get('/platform/auditlogs/v1/logs', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching audit logs: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/services/capacity', methods=['GET'])
@require_session
def get_service_capacity():
    """Get service capacity and usage metrics."""
    try:
        # Get device counts and calculate capacity
        devices = aruba_client.get('/network-monitoring/v1alpha1/devices')

        capacity = {
            'devices': {
                'total': devices.get('count', 0),
                'limit': 10000,  # Default limit, adjust based on subscription
                'percentage': 0
            },
            'timestamp': time.time()
        }

        if capacity['devices']['limit'] > 0:
            capacity['devices']['percentage'] = (capacity['devices']['total'] / capacity['devices']['limit']) * 100

        return jsonify(capacity)
    except Exception as e:
        logger.error(f"Error fetching service capacity: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Workspace Management Endpoints =============

@app.route('/api/workspace/switch', methods=['POST'])
@require_session
def switch_workspace():
    """Switch to a different workspace with new credentials."""
    global aruba_client, token_manager, config

    try:
        data = request.get_json()
        new_client_id = data.get('client_id')
        new_client_secret = data.get('client_secret')
        new_customer_id = data.get('customer_id')
        base_url = data.get('base_url', config["aruba_central"]["base_url"])

        if not all([new_client_id, new_client_secret, new_customer_id]):
            return jsonify({"error": "client_id, client_secret, and customer_id are required"}), 400

        # Update configuration
        config["aruba_central"]["client_id"] = new_client_id
        config["aruba_central"]["client_secret"] = new_client_secret
        config["aruba_central"]["customer_id"] = new_customer_id
        config["aruba_central"]["base_url"] = base_url

        # Reinitialize token manager and client
        token_manager = TokenManager(
            client_id=new_client_id,
            client_secret=new_client_secret
        )

        aruba_client = CentralAPIClient(
            base_url=base_url,
            token_manager=token_manager
        )

        logger.info(f"Workspace switched to customer_id: {new_customer_id[:16]}...")

        return jsonify({
            "success": True,
            "message": "Workspace switched successfully",
            "customer_id": new_customer_id[:16] + "...",
            "base_url": base_url
        })
    except Exception as e:
        logger.error(f"Workspace switch error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/workspace/info', methods=['GET'])
@require_session
def get_workspace_info():
    """Get current workspace information."""
    try:
        return jsonify({
            "customer_id": config["aruba_central"]["customer_id"][:16] + "..." if config else "Unknown",
            "base_url": config["aruba_central"]["base_url"] if config else "Unknown",
            "region": config["aruba_central"].get("region", "Unknown") if config else "Unknown"
        })
    except Exception as e:
        logger.error(f"Error getting workspace info: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/cluster/info', methods=['GET'])
def get_cluster_info():
    """Get information about Aruba Central regional clusters and base URLs."""
    return jsonify({
        "current_base_url": config["aruba_central"]["base_url"] if config else "Not configured",
        "available_clusters": [
            {
                "name": "United States",
                "region": "us-west",
                "base_url": "https://internal-apigw.central.arubanetworks.com",
                "description": "US West region (default for most US customers)"
            },
            {
                "name": "United States - New HPE GreenLake",
                "region": "us-hpe-gl",
                "base_url": "https://internal.api.central.arubanetworks.com",
                "description": "New HPE GreenLake platform (check your Central dashboard URL)"
            },
            {
                "name": "Europe",
                "region": "eu-central",
                "base_url": "https://internal-apigw.central.arubanetworks.com",
                "description": "Europe Central region"
            },
            {
                "name": "Asia Pacific",
                "region": "apac",
                "base_url": "https://internal-apigw.apac.central.arubanetworks.com",
                "description": "Asia Pacific region"
            },
            {
                "name": "Canada",
                "region": "ca",
                "base_url": "https://internal-apigw.central.arubanetworks.com",
                "description": "Canada region"
            },
            {
                "name": "China",
                "region": "cn",
                "base_url": "https://internal-apigw.arubanetworks.com.cn",
                "description": "China region"
            }
        ],
        "how_to_find": {
            "step1": "Log into your Aruba Central dashboard",
            "step2": "Check the URL in your browser",
            "step3": "Match the domain to the cluster list above",
            "step4": "Use the corresponding base_url for API calls",
            "note": "Using the wrong cluster URL will result in authentication failures"
        },
        "documentation": "https://developer.arubanetworks.com/aruba-central/docs/api-getting-started"
    })
# ============= Advanced Monitoring Endpoints =============

# Site Health - Individual Site
@app.route('/api/sites/<site_id>/health', methods=['GET'])
@require_session
def get_site_health(site_id):
    """Get detailed health metrics for a specific site."""
    try:
        response = aruba_client.get(f'/network-monitoring/v1alpha1/site-health/{site_id}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching health for site {site_id}: {e}")
        return jsonify({"error": str(e)}), 500


# Access Points Monitoring
@app.route('/api/monitoring/aps/top-bandwidth', methods=['GET'])
@require_session
def get_top_aps_bandwidth():
    """Get Access Points with highest wireless bandwidth usage."""
    try:
        params = {}
        if request.args.get('limit'):
            params['limit'] = request.args.get('limit')
        if request.args.get('site_id'):
            params['site_id'] = request.args.get('site_id')

        response = aruba_client.get('/network-monitoring/v1alpha1/aps/bandwidth/top', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching top APs by bandwidth: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/monitoring/aps', methods=['GET'])
@require_session
def get_aps_monitoring():
    """Get list of Access Points with monitoring data."""
    try:
        params = {}
        if request.args.get('site_id'):
            params['site_id'] = request.args.get('site_id')
        if request.args.get('limit'):
            params['limit'] = request.args.get('limit')
        if request.args.get('offset'):
            params['offset'] = request.args.get('offset')

        response = aruba_client.get('/network-monitoring/v1alpha1/aps', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching APs monitoring: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/monitoring/aps/<serial>', methods=['GET'])
@require_session
def get_ap_monitoring_details(serial):
    """Get detailed monitoring information for a specific Access Point."""
    try:
        response = aruba_client.get(f'/network-monitoring/v1alpha1/aps/{serial}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching AP monitoring details for {serial}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/monitoring/aps/<serial>/cpu', methods=['GET'])
@require_session
def get_ap_cpu_utilization(serial):
    """Get CPU utilization information for an Access Point.
    
    Endpoint: /network-monitoring/v1alpha1/aps/{serial-number}/cpu-utilization-trends
    Base URL is configured through the setup wizard.
    
    Query Parameters:
    - filter: OData v4.0 filter string for timestamp range (e.g., "timestamp gt '2025-11-13T01:00:00Z' and timestamp lt '2025-11-13T04:00:00Z'")
    - site-id: ID of the Site for which access point information is requested
    
    Response includes CPU utilization data averaged over 5-minute intervals.
    """
    try:
        params = {}
        
        # Support OData filter for timestamp range
        if request.args.get('filter'):
            params['filter'] = request.args.get('filter')
        
        # Support site-id parameter
        if request.args.get('site-id'):
            params['site-id'] = request.args.get('site-id')
        elif request.args.get('site_id'):  # Also support underscore variant
            params['site-id'] = request.args.get('site_id')
        
        # Legacy support for interval/duration (may not be used by API but kept for compatibility)
        if request.args.get('interval'):
            params['interval'] = request.args.get('interval')
        if request.args.get('duration'):
            params['duration'] = request.args.get('duration')

        # Construct the endpoint path - using serial-number as per API spec
        endpoint = f'/network-monitoring/v1alpha1/aps/{serial}/cpu-utilization-trends'
        logger.info(f"Fetching AP CPU utilization: {endpoint} for serial: {serial} with params: {params}")
        
        response = aruba_client.get(endpoint, params=params)
        
        # Process response to ensure 5-minute averages
        # The API returns samples at 5-minute intervals, but we'll ensure data is properly averaged
        if 'graph' in response and 'samples' in response['graph']:
            samples = response['graph']['samples']
            processed_samples = []
            
            for sample in samples:
                if 'data' in sample and len(sample['data']) > 0:
                    # Calculate average if multiple values in data array
                    values = sample['data']
                    avg_value = sum(values) / len(values) if values else 0
                    
                    processed_samples.append({
                        'timestamp': sample.get('timestamp'),
                        'data': [round(avg_value, 2)],  # Single averaged value per 5-minute interval
                        'cpu_utilization': round(avg_value, 2)  # Also include as named field for convenience
                    })
                else:
                    processed_samples.append(sample)
            
            # Update response with processed samples
            response['graph']['samples'] = processed_samples
            response['processed'] = True
            response['interval'] = '5 minutes'
        
        return jsonify(response)
    except Exception as e:
        error_str = str(e)
        logger.error(f"Error fetching CPU utilization for AP {serial}: {error_str}")
        
        # Provide more detailed error information
        error_response = {
            "error": "Failed to fetch CPU utilization",
            "message": error_str,
            "endpoint": f'/network-monitoring/v1alpha1/aps/{serial}/cpu-utilization-trends',
            "base_url": config["aruba_central"]["base_url"] if config else "Not configured"
        }
        
        # Check for specific error types
        if "404" in error_str or "Not Found" in error_str:
            error_response["suggestion"] = "Verify the serial number and that the AP exists in your Central account"
            return jsonify(error_response), 404
        elif "401" in error_str or "Unauthorized" in error_str:
            error_response["suggestion"] = "Authentication failed. Please check your credentials and token."
            return jsonify(error_response), 401
        elif "403" in error_str or "Forbidden" in error_str:
            error_response["suggestion"] = "Access forbidden. Check API permissions."
            return jsonify(error_response), 403
        
        return jsonify(error_response), 500


@app.route('/api/monitoring/aps/<serial>/memory', methods=['GET'])
@require_session
def get_ap_memory_utilization(serial):
    """Get memory utilization information for an Access Point.
    
    Endpoint: /network-monitoring/v1alpha1/aps/{serial-number}/memory-utilization-trends
    Base URL is configured through the setup wizard.
    
    Query Parameters:
    - filter: OData v4.0 filter string for timestamp range (e.g., "timestamp gt '2025-11-13T01:00:00Z' and timestamp lt '2025-11-13T04:00:00Z'")
    - site-id: ID of the Site for which access point information is requested
    
    Response includes memory utilization data averaged over 5-minute intervals.
    """
    try:
        params = {}
        
        # Support OData filter for timestamp range
        if request.args.get('filter'):
            params['filter'] = request.args.get('filter')
        
        # Support site-id parameter
        if request.args.get('site-id'):
            params['site-id'] = request.args.get('site-id')
        elif request.args.get('site_id'):  # Also support underscore variant
            params['site-id'] = request.args.get('site_id')
        
        # Legacy support for interval/duration (may not be used by API but kept for compatibility)
        if request.args.get('interval'):
            params['interval'] = request.args.get('interval')
        if request.args.get('duration'):
            params['duration'] = request.args.get('duration')

        # Construct the endpoint path - using serial-number as per API spec
        endpoint = f'/network-monitoring/v1alpha1/aps/{serial}/memory-utilization-trends'
        logger.info(f"Fetching AP memory utilization: {endpoint} for serial: {serial} with params: {params}")
        
        response = aruba_client.get(endpoint, params=params)
        
        # Process response to ensure 5-minute averages
        # The API returns samples at 5-minute intervals, but we'll ensure data is properly averaged
        if 'graph' in response and 'samples' in response['graph']:
            samples = response['graph']['samples']
            processed_samples = []
            
            for sample in samples:
                if 'data' in sample and len(sample['data']) > 0:
                    # Calculate average if multiple values in data array
                    values = sample['data']
                    avg_value = sum(values) / len(values) if values else 0
                    
                    processed_samples.append({
                        'timestamp': sample.get('timestamp'),
                        'data': [round(avg_value, 2)],  # Single averaged value per 5-minute interval
                        'memory_utilization': round(avg_value, 2)  # Also include as named field for convenience
                    })
                else:
                    processed_samples.append(sample)
            
            # Update response with processed samples
            response['graph']['samples'] = processed_samples
            response['processed'] = True
            response['interval'] = '5 minutes'
        
        return jsonify(response)
    except Exception as e:
        error_str = str(e)
        logger.error(f"Error fetching memory utilization for AP {serial}: {error_str}")
        
        # Provide more detailed error information
        error_response = {
            "error": "Failed to fetch memory utilization",
            "message": error_str,
            "endpoint": f'/network-monitoring/v1alpha1/aps/{serial}/memory-utilization-trends',
            "base_url": config["aruba_central"]["base_url"] if config else "Not configured"
        }
        
        # Check for specific error types
        if "404" in error_str or "Not Found" in error_str:
            error_response["suggestion"] = "Verify the serial number and that the AP exists in your Central account"
            return jsonify(error_response), 404
        elif "401" in error_str or "Unauthorized" in error_str:
            error_response["suggestion"] = "Authentication failed. Please check your credentials and token."
            return jsonify(error_response), 401
        elif "403" in error_str or "Forbidden" in error_str:
            error_response["suggestion"] = "Access forbidden. Check API permissions."
            return jsonify(error_response), 403
        
        return jsonify(error_response), 500


@app.route('/api/monitoring/aps/<serial>/temperature', methods=['GET'])
@require_session
def get_ap_temperature(serial):
    """Get hardware temperature information for an Access Point.
    
    NOTE: This endpoint path is inferred from existing patterns (cpu-utilization-trends, memory-utilization-trends).
    The actual Aruba Central API endpoint may differ. If this returns 404, the endpoint may not be available
    or may use a different path. Please verify with Aruba Central API documentation or test via API Explorer.
    """
    try:
        params = {}
        if request.args.get('interval'):
            params['interval'] = request.args.get('interval')
        if request.args.get('duration'):
            params['duration'] = request.args.get('duration')

        # Try the inferred endpoint path
        response = aruba_client.get(f'/network-monitoring/v1alpha1/aps/{serial}/hardware-temperature-trends', params=params)
        return jsonify(response)
    except Exception as e:
        error_str = str(e)
        logger.error(f"Error fetching temperature for AP {serial}: {error_str}")
        # Return helpful error message if endpoint doesn't exist
        if "404" in error_str or "Not Found" in error_str:
            return jsonify({
                "error": "Temperature endpoint not found",
                "message": "The hardware-temperature-trends endpoint may not be available in the Aruba Central API. Please verify the correct endpoint path.",
                "suggestion": "Try using the API Explorer to test available endpoints, or check the device details endpoint which may include temperature data."
            }), 404
        return jsonify({"error": error_str}), 500



@app.route('/api/monitoring/aps/<serial>/throughput', methods=['GET'])
@require_session
def get_ap_throughput_trend(serial):
    """Get throughput trend for an Access Point."""
    try:
        params = {}
        if request.args.get('interval'):
            params['interval'] = request.args.get('interval')
        if request.args.get('duration'):
            params['duration'] = request.args.get('duration')

        response = aruba_client.get(f'/network-monitoring/v1alpha1/aps/{serial}/throughput', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching throughput for AP {serial}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/monitoring/aps/<serial>/radios', methods=['GET'])
@require_session
def get_ap_radios(serial):
    """Get list of radios for an Access Point."""
    try:
        response = aruba_client.get(f'/network-monitoring/v1alpha1/aps/{serial}/radios')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching radios for AP {serial}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/monitoring/aps/<serial>/radios/<radio_id>/channel-util', methods=['GET'])
@require_session
def get_radio_channel_utilization(serial, radio_id):
    """Get channel utilization information for an AP radio."""
    try:
        params = {}
        if request.args.get('interval'):
            params['interval'] = request.args.get('interval')
        if request.args.get('duration'):
            params['duration'] = request.args.get('duration')

        response = aruba_client.get(
            f'/network-monitoring/v1alpha1/aps/{serial}/radios/{radio_id}/channel-utilization',
            params=params
        )
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching channel utilization for radio {radio_id}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/monitoring/aps/<serial>/ports', methods=['GET'])
@require_session
def get_ap_ports(serial):
    """Get list of ports for an Access Point."""
    try:
        response = aruba_client.get(f'/network-monitoring/v1alpha1/aps/{serial}/ports')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching ports for AP {serial}: {e}")
        return jsonify({"error": str(e)}), 500


# WLANs Monitoring
@app.route('/api/monitoring/wlans', methods=['GET'])
@require_session
def get_wlans_monitoring():
    """Get list of WLANs with monitoring data."""
    try:
        params = {}
        if request.args.get('site_id'):
            params['site_id'] = request.args.get('site_id')

        response = aruba_client.get('/network-monitoring/v1alpha1/wlans', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching WLANs monitoring: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/monitoring/wlans/<wlan_name>/throughput', methods=['GET'])
@require_session
def get_wlan_throughput(wlan_name):
    """Get throughput trend for a WLAN."""
    try:
        params = {}
        if request.args.get('interval'):
            params['interval'] = request.args.get('interval')
        if request.args.get('duration'):
            params['duration'] = request.args.get('duration')

        response = aruba_client.get(
            f'/network-monitoring/v1alpha1/wlans/{wlan_name}/throughput',
            params=params
        )
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching throughput for WLAN {wlan_name}: {e}")
        return jsonify({"error": str(e)}), 500


# Switch Monitoring
@app.route('/api/monitoring/switches', methods=['GET'])
@require_session
def get_switches_monitoring():
    """Get list of switches with monitoring data."""
    try:
        params = {}
        if request.args.get('site_id'):
            params['site_id'] = request.args.get('site_id')
        if request.args.get('limit'):
            params['limit'] = request.args.get('limit')

        response = aruba_client.get('/network-monitoring/v1alpha1/switches', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching switches monitoring: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/monitoring/switches/<serial>', methods=['GET'])
@require_session
def get_switch_monitoring_details(serial):
    """Get detailed monitoring information for a specific switch."""
    try:
        response = aruba_client.get(f'/network-monitoring/v1alpha1/switches/{serial}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching switch monitoring details for {serial}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/monitoring/switches/<serial>/cpu', methods=['GET'])
@require_session
def get_switch_cpu_utilization(serial):
    """Get CPU utilization information for a Switch.
    
    Endpoint: /network-monitoring/v1alpha1/switch/{serial-number}/cpu-utilization-trends
    Base URL is configured through the setup wizard.
    
    Query Parameters:
    - filter: OData v4.0 filter string for timestamp range (e.g., "timestamp gt '2025-11-13T01:00:00Z' and timestamp lt '2025-11-13T04:00:00Z'")
    - site-id: ID of the Site for which switch information is requested
    
    Response includes CPU utilization data averaged over 5-minute intervals.
    """
    try:
        params = {}
        
        # Support OData filter for timestamp range
        if request.args.get('filter'):
            params['filter'] = request.args.get('filter')
        
        # Support site-id parameter
        if request.args.get('site-id'):
            params['site-id'] = request.args.get('site-id')
        elif request.args.get('site_id'):  # Also support underscore variant
            params['site-id'] = request.args.get('site_id')
        
        # Legacy support for interval/duration (may not be used by API but kept for compatibility)
        if request.args.get('interval'):
            params['interval'] = request.args.get('interval')
        if request.args.get('duration'):
            params['duration'] = request.args.get('duration')

        # Construct the endpoint path - using serial-number as per API spec
        endpoint = f'/network-monitoring/v1alpha1/switch/{serial}/cpu-utilization-trends'
        logger.info(f"Fetching Switch CPU utilization: {endpoint} for serial: {serial} with params: {params}")
        
        response = aruba_client.get(endpoint, params=params)
        
        # Process response to ensure 5-minute averages
        # The API returns samples at 5-minute intervals, but we'll ensure data is properly averaged
        if 'graph' in response and 'samples' in response['graph']:
            samples = response['graph']['samples']
            processed_samples = []
            
            for sample in samples:
                if 'data' in sample and len(sample['data']) > 0:
                    # Calculate average if multiple values in data array
                    values = sample['data']
                    avg_value = sum(values) / len(values) if values else 0
                    
                    processed_samples.append({
                        'timestamp': sample.get('timestamp'),
                        'data': [round(avg_value, 2)],  # Single averaged value per 5-minute interval
                        'cpu_utilization': round(avg_value, 2)  # Also include as named field for convenience
                    })
                else:
                    processed_samples.append(sample)
            
            # Update response with processed samples
            response['graph']['samples'] = processed_samples
            response['processed'] = True
            response['interval'] = '5 minutes'
        
        return jsonify(response)
    except Exception as e:
        error_str = str(e)
        logger.error(f"Error fetching CPU utilization for switch {serial}: {error_str}")
        
        # Provide more detailed error information
        error_response = {
            "error": "Failed to fetch CPU utilization",
            "message": error_str,
            "endpoint": f'/network-monitoring/v1alpha1/switch/{serial}/cpu-utilization-trends',
            "base_url": config["aruba_central"]["base_url"] if config else "Not configured"
        }
        
        # Check for specific error types
        if "404" in error_str or "Not Found" in error_str:
            error_response["suggestion"] = "Verify the serial number and that the switch exists in your Central account"
            return jsonify(error_response), 404
        elif "401" in error_str or "Unauthorized" in error_str:
            error_response["suggestion"] = "Authentication failed. Please check your credentials and token."
            return jsonify(error_response), 401
        elif "403" in error_str or "Forbidden" in error_str:
            error_response["suggestion"] = "Access forbidden. Check API permissions."
            return jsonify(error_response), 403
        
        return jsonify(error_response), 500


# Replace the commented-out memory endpoint (around line 2755)
@app.route('/api/monitoring/switches/<serial>/memory', methods=['GET'])
@require_session
def get_switch_memory_utilization(serial):
    """Get memory utilization information for a Switch.
    
    Endpoint: /network-monitoring/v1alpha1/switch/{serial-number}/memory-utilization-trends
    Base URL is configured through the setup wizard.
    
    Query Parameters:
    - filter: OData v4.0 filter string for timestamp range (e.g., "timestamp gt '2025-11-13T01:00:00Z' and timestamp lt '2025-11-13T04:00:00Z'")
    - site-id: ID of the Site for which switch information is requested
    
    Response includes memory utilization data averaged over 5-minute intervals.
    """
    try:
        params = {}
        
        # Support OData filter for timestamp range
        if request.args.get('filter'):
            params['filter'] = request.args.get('filter')
        
        # Support site-id parameter
        if request.args.get('site-id'):
            params['site-id'] = request.args.get('site-id')
        elif request.args.get('site_id'):  # Also support underscore variant
            params['site-id'] = request.args.get('site_id')
        
        # Legacy support for interval/duration (may not be used by API but kept for compatibility)
        if request.args.get('interval'):
            params['interval'] = request.args.get('interval')
        if request.args.get('duration'):
            params['duration'] = request.args.get('duration')

        # Construct the endpoint path - using serial-number as per API spec
        endpoint = f'/network-monitoring/v1alpha1/switch/{serial}/memory-utilization-trends'
        logger.info(f"Fetching Switch memory utilization: {endpoint} for serial: {serial} with params: {params}")
        
        response = aruba_client.get(endpoint, params=params)
        
        # Process response to ensure 5-minute averages
        # The API returns samples at 5-minute intervals, but we'll ensure data is properly averaged
        if 'graph' in response and 'samples' in response['graph']:
            samples = response['graph']['samples']
            processed_samples = []
            
            for sample in samples:
                if 'data' in sample and len(sample['data']) > 0:
                    # Calculate average if multiple values in data array
                    values = sample['data']
                    avg_value = sum(values) / len(values) if values else 0
                    
                    processed_samples.append({
                        'timestamp': sample.get('timestamp'),
                        'data': [round(avg_value, 2)],  # Single averaged value per 5-minute interval
                        'memory_utilization': round(avg_value, 2)  # Also include as named field for convenience
                    })
                else:
                    processed_samples.append(sample)
            
            # Update response with processed samples
            response['graph']['samples'] = processed_samples
            response['processed'] = True
            response['interval'] = '5 minutes'
        
        return jsonify(response)
    except Exception as e:
        error_str = str(e)
        logger.error(f"Error fetching memory utilization for switch {serial}: {error_str}")
        
        # Provide more detailed error information
        error_response = {
            "error": "Failed to fetch memory utilization",
            "message": error_str,
            "endpoint": f'/network-monitoring/v1alpha1/switch/{serial}/memory-utilization-trends',
            "base_url": config["aruba_central"]["base_url"] if config else "Not configured"
        }
        
        # Check for specific error types
        if "404" in error_str or "Not Found" in error_str:
            error_response["suggestion"] = "Verify the serial number and that the switch exists in your Central account"
            return jsonify(error_response), 404
        elif "401" in error_str or "Unauthorized" in error_str:
            error_response["suggestion"] = "Authentication failed. Please check your credentials and token."
            return jsonify(error_response), 401
        elif "403" in error_str or "Forbidden" in error_str:
            error_response["suggestion"] = "Access forbidden. Check API permissions."
            return jsonify(error_response), 403
        
        return jsonify(error_response), 500


# Add new power consumption endpoint after the memory endpoint
@app.route('/api/monitoring/switches/<serial>/power', methods=['GET'])
@require_session
def get_switch_power_consumption(serial):
    """Get power consumption information for a Switch.
    
    Endpoint: /network-monitoring/v1alpha1/switch/{serial-number}/power-consumption-trends
    Base URL is configured through the setup wizard.
    
    Query Parameters:
    - filter: OData v4.0 filter string for timestamp range (e.g., "timestamp gt '2025-11-13T01:00:00Z' and timestamp lt '2025-11-13T04:00:00Z'")
    - site-id: ID of the Site for which switch information is requested
    
    Response includes power consumption data averaged over 5-minute intervals (in watts).
    """
    try:
        params = {}
        
        # Support OData filter for timestamp range
        if request.args.get('filter'):
            params['filter'] = request.args.get('filter')
        
        # Support site-id parameter
        if request.args.get('site-id'):
            params['site-id'] = request.args.get('site-id')
        elif request.args.get('site_id'):  # Also support underscore variant
            params['site-id'] = request.args.get('site_id')
        
        # Legacy support for interval/duration (may not be used by API but kept for compatibility)
        if request.args.get('interval'):
            params['interval'] = request.args.get('interval')
        if request.args.get('duration'):
            params['duration'] = request.args.get('duration')

        # Construct the endpoint path - using serial-number as per API spec
        endpoint = f'/network-monitoring/v1alpha1/switch/{serial}/power-consumption-trends'
        logger.info(f"Fetching Switch power consumption: {endpoint} for serial: {serial} with params: {params}")
        
        response = aruba_client.get(endpoint, params=params)
        
        # Process response to ensure 5-minute averages
        # The API returns samples at 5-minute intervals, but we'll ensure data is properly averaged
        # Power is in watts, not percentage
        if 'graph' in response and 'samples' in response['graph']:
            samples = response['graph']['samples']
            processed_samples = []
            
            for sample in samples:
                if 'data' in sample and len(sample['data']) > 0:
                    # Calculate average if multiple values in data array
                    values = sample['data']
                    avg_value = sum(values) / len(values) if values else 0
                    
                    processed_samples.append({
                        'timestamp': sample.get('timestamp'),
                        'data': [round(avg_value, 2)],  # Single averaged value per 5-minute interval
                        'power_consumption': round(avg_value, 2),  # Also include as named field for convenience
                        'power_consumption_watts': round(avg_value, 2)  # Explicit watts unit
                    })
                else:
                    processed_samples.append(sample)
            
            # Update response with processed samples
            response['graph']['samples'] = processed_samples
            response['processed'] = True
            response['interval'] = '5 minutes'
            response['unit'] = 'watts'
        
        return jsonify(response)
    except Exception as e:
        error_str = str(e)
        logger.error(f"Error fetching power consumption for switch {serial}: {error_str}")
        
        # Provide more detailed error information
        error_response = {
            "error": "Failed to fetch power consumption",
            "message": error_str,
            "endpoint": f'/network-monitoring/v1alpha1/switch/{serial}/power-consumption-trends',
            "base_url": config["aruba_central"]["base_url"] if config else "Not configured"
        }
        
        # Check for specific error types
        if "404" in error_str or "Not Found" in error_str:
            error_response["suggestion"] = "Verify the serial number and that the switch exists in your Central account"
            return jsonify(error_response), 404
        elif "401" in error_str or "Unauthorized" in error_str:
            error_response["suggestion"] = "Authentication failed. Please check your credentials and token."
            return jsonify(error_response), 401
        elif "403" in error_str or "Forbidden" in error_str:
            error_response["suggestion"] = "Access forbidden. Check API permissions."
            return jsonify(error_response), 403
        
        return jsonify(error_response), 500


# NOTE: Switch memory utilization endpoint is not available in Aruba Central API
# The API does not provide a memory-utilization-trends endpoint for switches
# Commenting out this endpoint to prevent 404 errors
#
# @app.route('/api/monitoring/switches/<serial>/memory', methods=['GET'])
# @require_session
# def get_switch_memory_utilization(serial):
#     """Get memory utilization for a switch."""
#     try:
#         params = {}
#         if request.args.get('interval'):
#             params['interval'] = request.args.get('interval')
#         if request.args.get('duration'):
#             params['duration'] = request.args.get('duration')
#
#         response = aruba_client.get(f'/network-monitoring/v1alpha1/switches/{serial}/memory', params=params)
#         return jsonify(response)
#     except Exception as e:
#         logger.error(f"Error fetching memory utilization for switch {serial}: {e}")
#         return jsonify({"error": str(e)}), 500


@app.route('/api/monitoring/switches/<serial>/temperature', methods=['GET'])
@require_session
def get_switch_temperature(serial):
    """Get hardware temperature information for a switch.
    
    NOTE: This endpoint path is inferred from existing patterns. The actual Aruba Central API endpoint may differ.
    If this returns 404, the endpoint may not be available or may use a different path. Temperature data may also
    be available in the switch details endpoint.
    """
    try:
        params = {}
        if request.args.get('interval'):
            params['interval'] = request.args.get('interval')
        if request.args.get('duration'):
            params['duration'] = request.args.get('duration')

        # Try the inferred endpoint path
        response = aruba_client.get(f'/network-monitoring/v1alpha1/switches/{serial}/hardware-temperature-trends', params=params)
        return jsonify(response)
    except Exception as e:
        error_str = str(e)
        logger.error(f"Error fetching temperature for switch {serial}: {error_str}")
        # Return helpful error message if endpoint doesn't exist
        if "404" in error_str or "Not Found" in error_str:
            return jsonify({
                "error": "Temperature endpoint not found",
                "message": "The hardware-temperature-trends endpoint may not be available for switches. Temperature data may be included in the switch details endpoint.",
                "suggestion": "Try GET /api/monitoring/switches/{serial} which may include temperature in the response."
            }), 404
        return jsonify({"error": error_str}), 500


@app.route('/api/monitoring/switches/<serial>/ports', methods=['GET'])
@require_session
def get_switch_ports_monitoring(serial):
    """Get monitoring data for switch ports."""
    try:
        response = aruba_client.get(f'/network-monitoring/v1alpha1/switches/{serial}/ports')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching ports for switch {serial}: {e}")
        return jsonify({"error": str(e)}), 500


# Gateway Monitoring
@app.route('/api/monitoring/gateways', methods=['GET'])
@require_session
def get_gateways_monitoring():
    """Get list of gateways with monitoring data."""
    try:
        params = {}
        if request.args.get('site_id'):
            params['site_id'] = request.args.get('site_id')

        response = aruba_client.get('/network-monitoring/v1alpha1/gateways', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching gateways monitoring: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/monitoring/gateways/<serial>', methods=['GET'])
@require_session
def get_gateway_monitoring_details(serial):
    """Get detailed monitoring information for a specific gateway."""
    try:
        response = aruba_client.get(f'/network-monitoring/v1alpha1/gateways/{serial}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching gateway monitoring details for {serial}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/monitoring/gateways/<serial>/tunnels', methods=['GET'])
@require_session
def get_gateway_tunnels(serial):
    """Get tunnel information for a gateway."""
    try:
        response = aruba_client.get(f'/network-monitoring/v1alpha1/gateways/{serial}/tunnels')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching tunnels for gateway {serial}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/monitoring/gateways/<serial>/temperature', methods=['GET'])
@require_session
def get_gateway_temperature(serial):
    """Get hardware temperature information for a gateway.
    
    NOTE: This endpoint path is inferred from existing patterns. The actual Aruba Central API endpoint may differ.
    According to some documentation, gateways may have hardware-temperature-trends endpoints, but this needs verification.
    """
    try:
        params = {}
        if request.args.get('interval'):
            params['interval'] = request.args.get('interval')
        if request.args.get('duration'):
            params['duration'] = request.args.get('duration')

        # Try the inferred endpoint path
        response = aruba_client.get(f'/network-monitoring/v1alpha1/gateways/{serial}/hardware-temperature-trends', params=params)
        return jsonify(response)
    except Exception as e:
        error_str = str(e)
        logger.error(f"Error fetching temperature for gateway {serial}: {error_str}")
        # Return helpful error message if endpoint doesn't exist
        if "404" in error_str or "Not Found" in error_str:
            return jsonify({
                "error": "Temperature endpoint not found",
                "message": "The hardware-temperature-trends endpoint may not be available for gateways, or may use a different path.",
                "suggestion": "Check the gateway details endpoint or verify the correct endpoint path in Aruba Central API documentation."
            }), 404
        return jsonify({"error": error_str}), 500


# Device Monitoring (Generic)
@app.route('/api/monitoring/devices', methods=['GET'])
@require_session
def get_devices_monitoring():
    """Get monitoring data for all devices."""
    try:
        params = {}
        if request.args.get('site_id'):
            params['site_id'] = request.args.get('site_id')
        if request.args.get('device_type'):
            params['device_type'] = request.args.get('device_type')

        response = aruba_client.get('/network-monitoring/v1alpha1/devices', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching devices monitoring: {e}")
        return jsonify({"error": str(e)}), 500


# Client Monitoring
@app.route('/api/monitoring/clients/<mac>/session', methods=['GET'])
@require_session
def get_client_session_details(mac):
    """Get detailed session information for a client."""
    try:
        response = aruba_client.get(f'/network-monitoring/v1alpha1/clients/{mac}/session')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching session for client {mac}: {e}")
        return jsonify({"error": str(e)}), 500


# Firewall Sessions
@app.route('/api/monitoring/firewall/sessions', methods=['GET'])
@require_session
def get_firewall_sessions():
    """Get firewall session information."""
    try:
        params = {}
        if request.args.get('gateway_serial'):
            params['gateway_serial'] = request.args.get('gateway_serial')
        if request.args.get('limit'):
            params['limit'] = request.args.get('limit')

        response = aruba_client.get('/network-monitoring/v1alpha1/firewall/sessions', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching firewall sessions: {e}")
        return jsonify({"error": str(e)}), 500


# IDPS (Intrusion Detection/Prevention)
@app.route('/api/monitoring/idps/events', methods=['GET'])
@require_session
def get_idps_events():
    """Get IDPS (Intrusion Detection/Prevention System) events."""
    try:
        params = {}
        if request.args.get('gateway_serial'):
            params['gateway_serial'] = request.args.get('gateway_serial')
        if request.args.get('severity'):
            params['severity'] = request.args.get('severity')
        if request.args.get('limit'):
            params['limit'] = request.args.get('limit')

        response = aruba_client.get('/network-monitoring/v1alpha1/idps/events', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching IDPS events: {e}")
        return jsonify({"error": str(e)}), 500


# Application Visibility
@app.route('/api/monitoring/applications', methods=['GET'])
@require_session
def get_applications_monitoring():
    """Get application visibility data from network monitoring API."""
    try:
        params = {}
        if request.args.get('site_id'):
            params['site_id'] = request.args.get('site_id')
        if request.args.get('limit'):
            params['limit'] = request.args.get('limit')

        response = aruba_client.get('/network-monitoring/v1alpha1/applications', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching application visibility: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/monitoring/applications/top', methods=['GET'])
@require_session
def get_top_applications():
    """Get top applications by bandwidth usage."""
    try:
        params = {}
        if request.args.get('site_id'):
            params['site_id'] = request.args.get('site_id')
        if request.args.get('limit'):
            params['limit'] = request.args.get('limit', 10)

        response = aruba_client.get('/network-monitoring/v1alpha1/applications/top', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching top applications: {e}")
        return jsonify({"error": str(e)}), 500


# Swarms (AP Groups)
@app.route('/api/monitoring/swarms', methods=['GET'])
@require_session
def get_swarms():
    """Get list of swarms (AP groups)."""
    try:
        params = {}
        if request.args.get('site_id'):
            params['site_id'] = request.args.get('site_id')

        response = aruba_client.get('/network-monitoring/v1alpha1/swarms', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching swarms: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/monitoring/swarms/<swarm_id>', methods=['GET'])
@require_session
def get_swarm_details(swarm_id):
    """Get detailed information for a specific swarm."""
    try:
        response = aruba_client.get(f'/network-monitoring/v1alpha1/swarms/{swarm_id}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error fetching swarm details for {swarm_id}: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Health Check Endpoint =============

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "version": "2.0.0",
        "aruba_client_initialized": aruba_client is not None
    })


# ============= Static Files (React App) =============

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react_app(path):
    """Serve React application for all non-API routes."""
    # Don't intercept API routes (they're handled by specific route handlers above)
    if path.startswith('api/'):
        return jsonify({"error": "Endpoint not found"}), 404

    # If the path exists as a static file, serve it directly
    if path and app.static_folder:
        file_path = Path(app.static_folder) / path
        if file_path.exists() and file_path.is_file():
            return send_from_directory(app.static_folder, path)

    # For all other paths (including React routes), serve index.html
    # This allows React Router to handle the routing
    if app.static_folder:
        index_path = Path(app.static_folder) / 'index.html'
        if index_path.exists():
            return send_from_directory(app.static_folder, 'index.html')

    # Fallback if static folder doesn't exist
    logger.error(f"Static folder not found or index.html missing: {app.static_folder}")
    return jsonify({"error": "Frontend not built"}), 500


# ============= Error Handlers =============

@app.errorhandler(404)
def not_found(e):
    """Handle 404 errors."""
    # For API routes, return JSON error
    if request.path.startswith('/api/'):
        return jsonify({
            "error": "Endpoint not found",
            "documentation": "https://developer.arubanetworks.com/aruba-central/docs"
        }), 404

    # For all other routes (React Router paths), serve index.html
    if app.static_folder:
        index_path = Path(app.static_folder) / 'index.html'
        if index_path.exists():
            return send_from_directory(app.static_folder, 'index.html')

    # Fallback if frontend not built
    return jsonify({"error": "Frontend not built"}), 500


@app.errorhandler(500)
def internal_error(e):
    """Handle 500 errors."""
    logger.error(f"Internal server error: {e}")
    return jsonify({
        "error": "Internal server error",
        "documentation": "https://developer.arubanetworks.com/aruba-central/docs"
    }), 500


# Enhanced error handler for Aruba Central API errors
def handle_central_api_error(error):
    """Enhanced error handling for Aruba Central API calls with helpful messages."""
    status_code = getattr(error, 'status_code', 500)
    error_message = str(error)

    error_responses = {
        401: {
            "error": "Authentication failed",
            "message": "Your access token is invalid or expired. Please refresh your token.",
            "action": "Try refreshing the page or logging out and back in.",
            "documentation": "https://developer.arubanetworks.com/aruba-central/docs/api-getting-started#authentication"
        },
        403: {
            "error": "Authorization failed",
            "message": "You don't have permission to access this resource.",
            "action": "Verify your API credentials have the required scopes.",
            "documentation": "https://developer.arubanetworks.com/aruba-central/docs/api-oauth-access-token"
        },
        404: {
            "error": "Resource not found",
            "message": "The requested resource doesn't exist or the endpoint URL is incorrect.",
            "action": "Verify the resource ID and endpoint path. Check that you're using the correct regional cluster base URL.",
            "documentation": "https://developer.arubanetworks.com/aruba-central/docs/api-reference-guide"
        },
        429: {
            "error": "Rate limit exceeded",
            "message": "You've exceeded the API rate limit.",
            "action": "Default limits are 5000 calls/day and 7 calls/second. Wait before making more requests.",
            "documentation": "https://developer.arubanetworks.com/aruba-central/docs/api-getting-started#rate-limiting"
        },
        500: {
            "error": "Aruba Central server error",
            "message": "The Aruba Central API encountered an internal error.",
            "action": "This is a temporary issue with Aruba Central. Try again later.",
            "documentation": "https://developer.arubanetworks.com/aruba-central/docs"
        },
        503: {
            "error": "Service unavailable",
            "message": "The Aruba Central API is temporarily unavailable.",
            "action": "The service may be under maintenance. Try again in a few minutes.",
            "documentation": "https://developer.arubanetworks.com/aruba-central/docs"
        }
    }

    response = error_responses.get(status_code, {
        "error": "API request failed",
        "message": error_message,
        "action": "Check the error details and try again.",
        "documentation": "https://developer.arubanetworks.com/aruba-central/docs"
    })

    response["status_code"] = status_code
    response["details"] = error_message

    return response


# ============= Main =============

if __name__ == '__main__':
    # Run Flask app
    app.run(host='0.0.0.0', port=1344, debug=True)
