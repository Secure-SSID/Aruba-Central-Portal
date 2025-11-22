#!/usr/bin/env python3
"""
Flask backend for Aruba Central Dashboard
Serves as an API proxy to securely handle authentication and API calls
"""

import sys
import os
import json
import re
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_compress import Compress
import logging
from functools import wraps
import secrets
import time
import hashlib
from datetime import datetime, timedelta

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
CORS(app, origins=['http://localhost:1344', 'http://localhost:5000'])

# Enable compression (gzip and brotli)
Compress(app)

# Cache control helper functions
def add_cache_headers(response, cache_max_age=3600, is_static=False):
    """Add cache-control headers to response."""
    if is_static:
        # Static assets: long-term caching (1 year) with hash-based filenames
        response.cache_control.max_age = 31536000  # 1 year
        response.cache_control.public = True
        response.cache_control.immutable = True
    else:
        # API responses: shorter caching (default 1 hour)
        response.cache_control.max_age = cache_max_age
        response.cache_control.private = True
        response.cache_control.must_revalidate = True
    return response

def add_etag_header(response, content):
    """Add ETag header based on content hash."""
    if isinstance(content, str):
        content_bytes = content.encode('utf-8')
    else:
        content_bytes = content
    etag = hashlib.md5(content_bytes).hexdigest()
    response.set_etag(etag)
    return response

@app.after_request
def set_cache_headers(response):
    """Set appropriate cache headers for all responses."""
    # Don't cache API responses by default (they're dynamic)
    if request.path.startswith('/api/'):
        # API responses: no cache or short cache
        response.cache_control.no_cache = True
        response.cache_control.no_store = True
        response.cache_control.must_revalidate = True
    elif request.path.startswith('/static/') or request.path.endswith(('.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.ico')):
        # Static assets: long-term caching
        response = add_cache_headers(response, is_static=True)
    elif request.path == '/' or request.path.endswith('.html'):
        # HTML files: no cache (they may change)
        response.cache_control.no_cache = True
        response.cache_control.must_revalidate = True
    
    return response

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


SESSION_STORE_FILE = Path(os.environ.get('TOKEN_CACHE_DIR', '/app/data')) / 'sessions.json'

def _load_sessions_from_disk():
    try:
        if SESSION_STORE_FILE.exists():
            data = json.loads(SESSION_STORE_FILE.read_text() or '{}')
            # Merge into active_sessions without overwriting newer entries
            for sid, sess in data.items():
                if sid not in active_sessions:
                    active_sessions[sid] = sess
    except Exception as e:
        logger.debug(f"Could not load sessions from disk: {e}")

def _save_sessions_to_disk():
    try:
        SESSION_STORE_FILE.parent.mkdir(parents=True, exist_ok=True)
        SESSION_STORE_FILE.write_text(json.dumps(active_sessions))
    except Exception as e:
        logger.debug(f"Could not save sessions to disk: {e}")

def require_session(f):
    """Decorator to require valid session."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        session_id = request.headers.get('X-Session-ID')
        if not session_id or session_id not in active_sessions:
            # Try to load from disk in case another worker created the session
            _load_sessions_from_disk()
        if not session_id or session_id not in active_sessions:
            return jsonify({"error": "Invalid or expired session"}), 401

        # Check session expiry
        session = active_sessions[session_id]
        if time.time() > session['expires']:
            del active_sessions[session_id]
            return jsonify({"error": "Session expired"}), 401

        # Refresh session
        session['expires'] = time.time() + SESSION_TIMEOUT
        # Persist refresh time for cross-worker visibility
        _save_sessions_to_disk()

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
        _save_sessions_to_disk()

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
        response = aruba_client.post('/configuration/v1/wlan', data=data)
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
@api_proxy('/network-config/v1alpha1/sites', error_msg="Sites config", fallback_data=[])
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
                # Log params for debugging filter issues
                if 'filter' in params:
                    logger.info(f"🔍 API Explorer: Filter parameter: {params.get('filter')}")
                logger.info(f"🔍 API Explorer: Endpoint={endpoint}, Params={params}")
                response = aruba_client.get(endpoint, params=params)
            elif method == 'POST':
                response = aruba_client.post(endpoint, data=body, params=params)
            elif method == 'PUT':
                response = aruba_client.put(endpoint, data=body, params=params)
            elif method == 'DELETE':
                response = aruba_client.delete(endpoint, params=params)
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
        # Normalize site id
        site_id = request.args.get('site_id', request.args.get('site-id'))
        if site_id:
            params['site-id'] = site_id
        # Time range
        if request.args.get('from_timestamp'):
            params['from_timestamp'] = request.args.get('from_timestamp')
        if request.args.get('to_timestamp'):
            params['to_timestamp'] = request.args.get('to_timestamp')
        if request.args.get('timeframe'):
            params['timeframe'] = request.args.get('timeframe')

        response = aruba_client.get('/monitoring/v1/app_analytics', params=params)
        return jsonify(response)
    except Exception as e:
        # Gracefully handle 400/404 as empty series (broad match to be robust)
        err_text = str(e)
        if '404' in err_text or '400' in err_text or 'Not Found' in err_text or 'Bad Request' in err_text:
            logger.warning(f"Traffic analysis error treated as empty: {err_text[:200]}")
            return jsonify({"items": [], "count": 0})
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
        # Gracefully handle 400/404 as empty (broad match to be robust)
        err_text = str(e)
        if '404' in err_text or '400' in err_text or 'Not Found' in err_text or 'Bad Request' in err_text:
            logger.warning(f"App visibility error treated as empty: {err_text[:200]}")
            return jsonify({"items": [], "count": 0})
        logger.error(f"Error fetching app visibility: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Troubleshooting Endpoints =============

@app.route('/api/troubleshoot/ping', methods=['POST'])
@require_session
def troubleshoot_ping():
    """Execute ping test from device using async API.
    
    Reference: https://developer.arubanetworks.com/new-central/reference/ping
    Endpoint: /network-troubleshooting/v1alpha1/cx/{serial-number}/ping
    """
    
    try:
        data = request.get_json()
        device_serial = data.get('device_serial')
        target = data.get('target')

        if not device_serial or not target:
            return jsonify({"error": "device_serial and target are required"}), 400

        try:
            # Step 1: Initiate ping request
            response = aruba_client.post(
                f'/network-troubleshooting/v1alpha1/cx/{device_serial}/ping',
                data={"destination": target}
            )
            
            # Step 2: Extract task ID from location URL
            location = response.get('location', '')
            task_id_match = re.search(r'/async-operations/([a-f0-9\-]+)', location)
            if not task_id_match:
                # If no location, check if response already contains the result
                if response.get('status') == 'COMPLETED' and 'output' in response:
                    return jsonify(response)
                return jsonify({"error": "Could not extract task ID from response", "response": response}), 500
            
            task_id = task_id_match.group(1)
            
            # Step 3: Poll async operation until completion
            max_attempts = 30  # Maximum polling attempts
            poll_interval = 1  # Wait 1 second between polls
            max_wait_time = 30  # Maximum total wait time (30 seconds to match frontend timeout)
            
            start_time = time.time()
            for attempt in range(max_attempts):
                # Check if we've exceeded max wait time
                if time.time() - start_time > max_wait_time:
                    return jsonify({
                        "error": "Ping operation timed out",
                        "status": "TIMEOUT",
                        "task_id": task_id
                    }), 504
                
                # Poll the async operation
                async_response = aruba_client.get(
                    f'/network-troubleshooting/v1alpha1/cx/{device_serial}/ping/async-operations/{task_id}'
                )
                
                status = async_response.get('status', 'UNKNOWN')
                
                if status == 'COMPLETED':
                    # Success! Return the completed result
                    return jsonify(async_response)
                elif status == 'FAILED':
                    # Operation failed
                    fail_reason = async_response.get('failReason', 'Unknown error')
                    return jsonify({
                        "error": f"Ping operation failed: {fail_reason}",
                        "status": "FAILED",
                        "task_id": task_id,
                        "response": async_response
                    }), 500
                elif status in ['INITIATED', 'IN_PROGRESS']:
                    # Still processing, wait and poll again
                    time.sleep(poll_interval)
                    continue
                else:
                    # Unknown status
                    logger.warning(f"Unknown ping status: {status}, response: {async_response}")
                    time.sleep(poll_interval)
                    continue
            
            # If we've exhausted all attempts
            return jsonify({
                "error": "Ping operation did not complete within expected time",
                "status": "TIMEOUT",
                "task_id": task_id,
                "last_response": async_response if 'async_response' in locals() else None
            }), 504
            
        except Exception as terr:
            if '400' in str(terr) or '404' in str(terr) or 'Not Found' in str(terr) or 'Bad Request' in str(terr):
                return jsonify({"status": "unavailable", "result": None})
            raise terr
    except Exception as e:
        logger.error(f"Ping troubleshooting error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/traceroute', methods=['POST'])
@require_session
def troubleshoot_traceroute():
    """Execute traceroute test from CX switch using async API.
    
    Reference: https://developer.arubanetworks.com/new-central/reference/initiatecxtraceroute
    Endpoint: /network-troubleshooting/v1alpha1/cx/{serial-number}/traceroute
    """
    try:
        data = request.get_json()
        device_serial = data.get('device_serial')
        target = data.get('target')

        if not device_serial or not target:
            return jsonify({"error": "device_serial and target are required"}), 400

        try:
            # Step 1: Initiate traceroute request
            response = aruba_client.post(
                f'/network-troubleshooting/v1alpha1/cx/{device_serial}/traceroute',
                data={"destination": target}
            )
            
            # Step 2: Extract task ID from location URL
            location = response.get('location', '')
            task_id_match = re.search(r'/async-operations/([a-f0-9\-]+)', location)
            if not task_id_match:
                if response.get('status') == 'COMPLETED' and 'output' in response:
                    return jsonify(response)
                return jsonify({"error": "Could not extract task ID from response", "response": response}), 500
            
            task_id = task_id_match.group(1)
            
            # Step 3: Poll async operation until completion
            max_attempts = 60  # Maximum polling attempts
            poll_interval = 1  # Wait 1 second between polls
            max_wait_time = 60  # Maximum total wait time (60 seconds)
            
            start_time = time.time()
            for attempt in range(max_attempts):
                if time.time() - start_time > max_wait_time:
                    return jsonify({
                        "error": "Traceroute operation timed out",
                        "status": "TIMEOUT",
                        "task_id": task_id
                    }), 504
                
                async_response = aruba_client.get(
                    f'/network-troubleshooting/v1alpha1/cx/{device_serial}/traceroute/async-operations/{task_id}'
                )
                
                status = async_response.get('status', 'UNKNOWN')
                
                if status == 'COMPLETED':
                    return jsonify(async_response)
                elif status == 'FAILED':
                    fail_reason = async_response.get('failReason', 'Unknown error')
                    return jsonify({
                        "error": f"Traceroute operation failed: {fail_reason}",
                        "status": "FAILED",
                        "task_id": task_id,
                        "response": async_response
                    }), 500
                elif status in ['INITIATED', 'IN_PROGRESS']:
                    time.sleep(poll_interval)
                    continue
                else:
                    logger.warning(f"Unknown traceroute status: {status}, response: {async_response}")
                    time.sleep(poll_interval)
                    continue
            
            return jsonify({
                "error": "Traceroute operation did not complete within expected time",
                "status": "TIMEOUT",
                "task_id": task_id
            }), 504
            
        except Exception as terr:
            if '400' in str(terr) or '404' in str(terr) or 'Not Found' in str(terr) or 'Bad Request' in str(terr):
                return jsonify({"status": "unavailable", "result": None})
            raise terr
    except Exception as e:
        logger.error(f"Traceroute troubleshooting error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/cx/poe-bounce', methods=['POST'])
@require_session
def troubleshoot_cx_poe_bounce():
    """Execute POE bounce test on CX switch using async API.
    
    Reference: https://developer.arubanetworks.com/new-central/reference/initiatecxpoebounce
    Endpoint: /network-troubleshooting/v1alpha1/cx/{serial-number}/poeBounce
    """
    try:
        data = request.get_json()
        device_serial = data.get('device_serial')
        port = data.get('port')

        if not device_serial or not port:
            return jsonify({"error": "device_serial and port are required"}), 400

        try:
            response = aruba_client.post(
                f'/network-troubleshooting/v1alpha1/cx/{device_serial}/poeBounce',
                data={"port": port}
            )
            
            location = response.get('location', '')
            task_id_match = re.search(r'/async-operations/([a-f0-9\-]+)', location)
            if not task_id_match:
                if response.get('status') == 'COMPLETED':
                    return jsonify(response)
                return jsonify({"error": "Could not extract task ID from response"}), 500
            
            task_id = task_id_match.group(1)
            
            # Poll for completion
            max_attempts = 30
            poll_interval = 1
            max_wait_time = 30
            
            start_time = time.time()
            for attempt in range(max_attempts):
                if time.time() - start_time > max_wait_time:
                    return jsonify({
                        "error": "POE bounce operation timed out",
                        "status": "TIMEOUT",
                        "task_id": task_id
                    }), 504
                
                async_response = aruba_client.get(
                    f'/network-troubleshooting/v1alpha1/cx/{device_serial}/poeBounce/async-operations/{task_id}'
                )
                
                status = async_response.get('status', 'UNKNOWN')
                
                if status == 'COMPLETED':
                    return jsonify(async_response)
                elif status == 'FAILED':
                    fail_reason = async_response.get('failReason', 'Unknown error')
                    return jsonify({
                        "error": f"POE bounce operation failed: {fail_reason}",
                        "status": "FAILED",
                        "task_id": task_id
                    }), 500
                elif status in ['INITIATED', 'IN_PROGRESS']:
                    time.sleep(poll_interval)
                    continue
                else:
                    time.sleep(poll_interval)
                    continue
            
            return jsonify({
                "error": "POE bounce operation did not complete within expected time",
                "status": "TIMEOUT",
                "task_id": task_id
            }), 504
            
        except Exception as terr:
            # Properly handle HTTP errors from requests library
            import requests
            if isinstance(terr, requests.HTTPError):
                status_code = terr.response.status_code if hasattr(terr, 'response') and terr.response else None
                error_text = terr.response.text if hasattr(terr, 'response') and terr.response else str(terr)
                
                logger.error(
                    f"POE bounce API error: HTTP {status_code} - {error_text[:500] if error_text else 'Unknown error'}"
                )
                
                # Return more informative error message
                if status_code in (400, 404):
                    error_msg = error_text if error_text and len(error_text) < 200 else "POE bounce operation is not available for this device or port"
                    return jsonify({
                        "status": "unavailable",
                        "result": None,
                        "error": error_msg,
                        "status_code": status_code
                    }), status_code
                else:
                    # For other HTTP errors, return the actual error
                    return jsonify({
                        "status": "error",
                        "error": error_text[:200] if error_text else str(terr),
                        "status_code": status_code
                    }), status_code if status_code else 500
            elif '400' in str(terr) or '404' in str(terr):
                # Fallback for string-based checks
                logger.warning(f"POE bounce error (string check): {terr}")
                return jsonify({
                    "status": "unavailable",
                    "result": None,
                    "error": "POE bounce operation is not available. This may indicate the device or port does not support this operation."
                }), 404
            raise terr
    except Exception as e:
        logger.error(f"POE bounce troubleshooting error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/cx/port-bounce', methods=['POST'])
@require_session
def troubleshoot_cx_port_bounce():
    """Execute port bounce test on switch using async API.
    
    Tries CX endpoint first, falls back to AOS-S endpoint if CX fails.
    
    CX Reference: https://developer.arubanetworks.com/new-central/reference/initiatecxportbounce
    CX Endpoint: /network-troubleshooting/v1alpha1/cx/{serial-number}/port-bounce
    AOS-S Endpoint: /troubleshooting/v1alpha1/switches/{serial}/port-bounce
    """
    try:
        data = request.get_json()
        device_serial = data.get('device_serial')
        port = data.get('port')

        if not device_serial or not port:
            return jsonify({"error": "device_serial and port are required"}), 400

        # Try CX endpoint first
        cx_failed = False
        try:
            response = aruba_client.post(
                f'/network-troubleshooting/v1alpha1/cx/{device_serial}/portBounce',
                data={"ports": [port]}  # API expects array of ports
            )
            
            location = response.get('location', '')
            task_id_match = re.search(r'/async-operations/([a-f0-9\-]+)', location)
            if not task_id_match:
                if response.get('status') == 'COMPLETED':
                    return jsonify(response)
                return jsonify({"error": "Could not extract task ID from response"}), 500
            
            task_id = task_id_match.group(1)
            
            # Poll for completion
            max_attempts = 60  # Increased to allow up to 60 seconds
            poll_interval = 1
            max_wait_time = 60  # Increased timeout to 60 seconds
            
            start_time = time.time()
            for attempt in range(max_attempts):
                if time.time() - start_time > max_wait_time:
                    return jsonify({
                        "error": "Port bounce operation timed out",
                        "status": "TIMEOUT",
                        "task_id": task_id
                    }), 504
                
                async_response = aruba_client.get(
                    f'/network-troubleshooting/v1alpha1/cx/{device_serial}/portBounce/async-operations/{task_id}'
                )
                
                status = async_response.get('status', 'UNKNOWN')
                
                if status == 'COMPLETED':
                    # "Timed Out" in failReason is a valid completion when port has nothing connected
                    fail_reason = async_response.get('failReason', '')
                    
                    # Check port status after bounce completes (wait 2 seconds for port to stabilize)
                    port_status = None
                    try:
                        time.sleep(2)  # Wait for port to stabilize after bounce
                        # Try to get port status
                        try:
                            # Parse port identifier (e.g., "1/1/13" -> need to URL encode)
                            import urllib.parse
                            encoded_port = urllib.parse.quote(port, safe='')
                            port_status_response = aruba_client.get(
                                f'/network-monitoring/v1alpha1/switch/{device_serial}/interfaces/{encoded_port}'
                            )
                            if port_status_response:
                                port_status = {
                                    "operStatus": port_status_response.get('operStatus', 'Unknown'),
                                    "adminStatus": port_status_response.get('adminStatus', 'Unknown'),
                                    "id": port_status_response.get('id', port),
                                    "name": port_status_response.get('name', port),
                                }
                        except Exception as port_check_err:
                            logger.warning(f"Could not check port status after bounce: {port_check_err}")
                            port_status = {"error": "Could not retrieve port status", "note": "Port may still be recovering"}
                    
                    except Exception as e:
                        logger.warning(f"Error checking port status: {e}")
                    
                    result = {**async_response}
                    if port_status:
                        result["portStatus"] = port_status
                    
                    if fail_reason == 'Timed Out':
                        # This is expected when port has no device connected - return as success
                        result["message"] = "Port bounce completed. Note: Port may have no device connected (Timed Out)."
                    else:
                        result["message"] = "Port bounce completed successfully."
                        if port_status and port_status.get('operStatus') == 'Down':
                            result["warning"] = "Port is currently Down. It may take a few seconds to come back up if a device is connected."
                    
                    return jsonify(result)
                elif status == 'FAILED':
                    fail_reason = async_response.get('failReason', 'Unknown error')
                    # "Timed Out" is not a failure - it's expected when port has nothing connected
                    if fail_reason == 'Timed Out':
                        # Check port status
                        port_status = None
                        try:
                            time.sleep(2)
                            try:
                                import urllib.parse
                                encoded_port = urllib.parse.quote(port, safe='')
                                port_status_response = aruba_client.get(
                                    f'/network-monitoring/v1alpha1/switch/{device_serial}/interfaces/{encoded_port}'
                                )
                                if port_status_response:
                                    port_status = {
                                        "operStatus": port_status_response.get('operStatus', 'Unknown'),
                                        "adminStatus": port_status_response.get('adminStatus', 'Unknown'),
                                        "id": port_status_response.get('id', port),
                                        "name": port_status_response.get('name', port),
                                    }
                            except Exception as port_check_err:
                                logger.warning(f"Could not check port status after bounce: {port_check_err}")
                        except Exception as e:
                            logger.warning(f"Error checking port status: {e}")
                        
                        result = {
                            **async_response,
                            "status": "COMPLETED",
                            "message": "Port bounce completed. Note: Port may have no device connected (Timed Out)."
                        }
                        if port_status:
                            result["portStatus"] = port_status
                        return jsonify(result)
                    
                    # For actual failures, still try to check port status
                    port_status = None
                    try:
                        time.sleep(2)
                        try:
                            import urllib.parse
                            encoded_port = urllib.parse.quote(port, safe='')
                            port_status_response = aruba_client.get(
                                f'/network-monitoring/v1alpha1/switch/{device_serial}/interfaces/{encoded_port}'
                            )
                            if port_status_response:
                                port_status = {
                                    "operStatus": port_status_response.get('operStatus', 'Unknown'),
                                    "adminStatus": port_status_response.get('adminStatus', 'Unknown'),
                                    "id": port_status_response.get('id', port),
                                    "name": port_status_response.get('name', port),
                                }
                        except Exception:
                            pass
                    except Exception:
                        pass
                    
                    error_response = {
                        "error": f"Port bounce operation failed: {fail_reason}",
                        "status": "FAILED",
                        "task_id": task_id
                    }
                    if port_status:
                        error_response["portStatus"] = port_status
                    return jsonify(error_response), 500
                elif status in ['INITIATED', 'IN_PROGRESS']:
                    time.sleep(poll_interval)
                    continue
                else:
                    time.sleep(poll_interval)
                    continue
            
            return jsonify({
                "error": "Port bounce operation did not complete within expected time",
                "status": "TIMEOUT",
                "task_id": task_id
            }), 504
            
        except Exception as terr:
            # Properly handle HTTP errors from requests library
            import requests
            if isinstance(terr, requests.HTTPError):
                status_code = terr.response.status_code if hasattr(terr, 'response') and terr.response else None
                error_text = terr.response.text if hasattr(terr, 'response') and terr.response else str(terr)
                
                # If CX endpoint fails with 404, try AOS-S switch endpoint
                if status_code == 404:
                    logger.info(f"CX port bounce endpoint not available for {device_serial}, trying AOS-S endpoint")
                    try:
                        # Try AOS-S switch endpoint
                        response = aruba_client.post(
                            f'/troubleshooting/v1alpha1/switches/{device_serial}/port-bounce',
                            data={"port": port}
                        )
                        
                        # AOS-S endpoint returns test_id instead of location
                        test_id = response.get('test_id')
                        if not test_id:
                            return jsonify({"error": "Could not extract test ID from AOS-S response"}), 500
                        
                        # Poll for completion with AOS-S endpoint
                        max_attempts = 30
                        poll_interval = 1
                        max_wait_time = 30
                        
                        start_time = time.time()
                        for attempt in range(max_attempts):
                            if time.time() - start_time > max_wait_time:
                                return jsonify({
                                    "error": "Port bounce operation timed out",
                                    "status": "TIMEOUT",
                                    "test_id": test_id
                                }), 504
                            
                            async_response = aruba_client.get(
                                f'/troubleshooting/v1alpha1/switches/{device_serial}/port-bounce/{test_id}'
                            )
                            
                            status = async_response.get('status', 'UNKNOWN')
                            
                            if status in ['COMPLETED', 'SUCCESS']:
                                return jsonify(async_response)
                            elif status == 'FAILED':
                                fail_reason = async_response.get('reason', 'Unknown error')
                                return jsonify({
                                    "error": f"Port bounce operation failed: {fail_reason}",
                                    "status": "FAILED",
                                    "test_id": test_id
                                }), 500
                            elif status in ['INITIATED', 'IN_PROGRESS', 'RUNNING']:
                                time.sleep(poll_interval)
                                continue
                            else:
                                time.sleep(poll_interval)
                                continue
                        
                        return jsonify({
                            "error": "Port bounce operation did not complete within expected time",
                            "status": "TIMEOUT",
                            "test_id": test_id
                        }), 504
                        
                    except Exception as aos_err:
                        logger.error(f"AOS-S port bounce also failed: {aos_err}")
                        # Both endpoints failed, return informative error
                        return jsonify({
                            "status": "unavailable",
                            "result": None,
                            "error": "Port bounce operation is not available for this device. Neither CX nor AOS-S endpoints are supported.",
                            "cx_error": error_text[:100] if error_text else str(terr),
                            "aos_error": str(aos_err)[:100]
                        }), 404
                
                # For non-404 errors, return informative error message
                logger.error(
                    f"Port bounce API error: HTTP {status_code} - {error_text[:500] if error_text else 'Unknown error'}"
                )
                
                if status_code == 400:
                    error_msg = error_text if error_text and len(error_text) < 200 else "Port bounce operation is not available for this device or port"
                    return jsonify({
                        "status": "unavailable",
                        "result": None,
                        "error": error_msg,
                        "status_code": status_code
                    }), status_code
                else:
                    # For other HTTP errors, return the actual error
                    return jsonify({
                        "status": "error",
                        "error": error_text[:200] if error_text else str(terr),
                        "status_code": status_code
                    }), status_code if status_code else 500
            elif '400' in str(terr) or '404' in str(terr):
                # Fallback for string-based checks
                logger.warning(f"Port bounce error (string check): {terr}")
                return jsonify({
                    "status": "unavailable",
                    "result": None,
                    "error": "Port bounce operation is not available. This may indicate the device or port does not support this operation."
                }), 404
            raise terr
    except Exception as e:
        logger.error(f"Port bounce troubleshooting error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/cx/cable-test', methods=['POST'])
@require_session
def troubleshoot_cx_cable_test():
    """Execute cable test on CX switch using async API.
    
    Reference: https://developer.arubanetworks.com/new-central/reference/initiatecxcabletest
    Endpoint: /network-troubleshooting/v1alpha1/cx/{serial-number}/cableTest
    """
    try:
        data = request.get_json()
        device_serial = data.get('device_serial')
        port = data.get('port')

        if not device_serial or not port:
            return jsonify({"error": "device_serial and port are required"}), 400

        try:
            response = aruba_client.post(
                f'/network-troubleshooting/v1alpha1/cx/{device_serial}/cableTest',
                data={"port": port}
            )
            
            location = response.get('location', '')
            task_id_match = re.search(r'/async-operations/([a-f0-9\-]+)', location)
            if not task_id_match:
                if response.get('status') == 'COMPLETED':
                    return jsonify(response)
                return jsonify({"error": "Could not extract task ID from response"}), 500
            
            task_id = task_id_match.group(1)
            
            # Poll for completion
            max_attempts = 60
            poll_interval = 2
            max_wait_time = 120  # Cable tests can take longer
            
            start_time = time.time()
            for attempt in range(max_attempts):
                if time.time() - start_time > max_wait_time:
                    return jsonify({
                        "error": "Cable test operation timed out",
                        "status": "TIMEOUT",
                        "task_id": task_id
                    }), 504
                
                async_response = aruba_client.get(
                    f'/network-troubleshooting/v1alpha1/cx/{device_serial}/cableTest/async-operations/{task_id}'
                )
                
                status = async_response.get('status', 'UNKNOWN')
                
                if status == 'COMPLETED':
                    return jsonify(async_response)
                elif status == 'FAILED':
                    fail_reason = async_response.get('failReason', 'Unknown error')
                    return jsonify({
                        "error": f"Cable test operation failed: {fail_reason}",
                        "status": "FAILED",
                        "task_id": task_id
                    }), 500
                elif status in ['INITIATED', 'IN_PROGRESS']:
                    time.sleep(poll_interval)
                    continue
                else:
                    time.sleep(poll_interval)
                    continue
            
            return jsonify({
                "error": "Cable test operation did not complete within expected time",
                "status": "TIMEOUT",
                "task_id": task_id
            }), 504
            
        except Exception as terr:
            if '400' in str(terr) or '404' in str(terr):
                return jsonify({"status": "unavailable", "result": None})
            raise terr
    except Exception as e:
        logger.error(f"Cable test troubleshooting error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/cx/http-test', methods=['POST'])
@require_session
def troubleshoot_cx_http_test():
    """Execute HTTP test on CX switch using async API.
    
    Reference: https://developer.arubanetworks.com/new-central/reference/initiatecxhttp
    Endpoint: /network-troubleshooting/v1alpha1/cx/{serial-number}/httpTest
    """
    try:
        data = request.get_json()
        device_serial = data.get('device_serial')
        url = data.get('url')

        if not device_serial or not url:
            return jsonify({"error": "device_serial and url are required"}), 400

        try:
            response = aruba_client.post(
                f'/network-troubleshooting/v1alpha1/cx/{device_serial}/httpTest',
                data={"url": url}
            )
            
            location = response.get('location', '')
            task_id_match = re.search(r'/async-operations/([a-f0-9\-]+)', location)
            if not task_id_match:
                if response.get('status') == 'COMPLETED':
                    return jsonify(response)
                return jsonify({"error": "Could not extract task ID from response"}), 500
            
            task_id = task_id_match.group(1)
            
            # Poll for completion
            max_attempts = 30
            poll_interval = 1
            max_wait_time = 30
            
            start_time = time.time()
            for attempt in range(max_attempts):
                if time.time() - start_time > max_wait_time:
                    return jsonify({
                        "error": "HTTP test operation timed out",
                        "status": "TIMEOUT",
                        "task_id": task_id
                    }), 504
                
                async_response = aruba_client.get(
                    f'/network-troubleshooting/v1alpha1/cx/{device_serial}/httpTest/async-operations/{task_id}'
                )
                
                status = async_response.get('status', 'UNKNOWN')
                
                if status == 'COMPLETED':
                    return jsonify(async_response)
                elif status == 'FAILED':
                    fail_reason = async_response.get('failReason', 'Unknown error')
                    return jsonify({
                        "error": f"HTTP test operation failed: {fail_reason}",
                        "status": "FAILED",
                        "task_id": task_id
                    }), 500
                elif status in ['INITIATED', 'IN_PROGRESS']:
                    time.sleep(poll_interval)
                    continue
                else:
                    time.sleep(poll_interval)
                    continue
            
            return jsonify({
                "error": "HTTP test operation did not complete within expected time",
                "status": "TIMEOUT",
                "task_id": task_id
            }), 504
            
        except Exception as terr:
            if '400' in str(terr) or '404' in str(terr):
                return jsonify({"status": "unavailable", "result": None})
            raise terr
    except Exception as e:
        logger.error(f"HTTP test troubleshooting error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/cx/aaa-test', methods=['POST'])
@require_session
def troubleshoot_cx_aaa_test():
    """Execute AAA test on CX switch using async API.
    
    Reference: https://developer.arubanetworks.com/new-central/reference/initiatecxaaa
    Endpoint: /network-troubleshooting/v1alpha1/cx/{serial-number}/aaaTest
    """
    try:
        data = request.get_json()
        device_serial = data.get('device_serial')
        username = data.get('username')
        password = data.get('password')

        if not device_serial or not username or not password:
            return jsonify({"error": "device_serial, username, and password are required"}), 400

        try:
            response = aruba_client.post(
                f'/network-troubleshooting/v1alpha1/cx/{device_serial}/aaaTest',
                data={"username": username, "password": password}
            )
            
            location = response.get('location', '')
            task_id_match = re.search(r'/async-operations/([a-f0-9\-]+)', location)
            if not task_id_match:
                if response.get('status') == 'COMPLETED':
                    return jsonify(response)
                return jsonify({"error": "Could not extract task ID from response"}), 500
            
            task_id = task_id_match.group(1)
            
            # Poll for completion
            max_attempts = 30
            poll_interval = 1
            max_wait_time = 30
            
            start_time = time.time()
            for attempt in range(max_attempts):
                if time.time() - start_time > max_wait_time:
                    return jsonify({
                        "error": "AAA test operation timed out",
                        "status": "TIMEOUT",
                        "task_id": task_id
                    }), 504
                
                async_response = aruba_client.get(
                    f'/network-troubleshooting/v1alpha1/cx/{device_serial}/aaaTest/async-operations/{task_id}'
                )
                
                status = async_response.get('status', 'UNKNOWN')
                
                if status == 'COMPLETED':
                    return jsonify(async_response)
                elif status == 'FAILED':
                    fail_reason = async_response.get('failReason', 'Unknown error')
                    return jsonify({
                        "error": f"AAA test operation failed: {fail_reason}",
                        "status": "FAILED",
                        "task_id": task_id
                    }), 500
                elif status in ['INITIATED', 'IN_PROGRESS']:
                    time.sleep(poll_interval)
                    continue
                else:
                    time.sleep(poll_interval)
                    continue
            
            return jsonify({
                "error": "AAA test operation did not complete within expected time",
                "status": "TIMEOUT",
                "task_id": task_id
            }), 504
            
        except Exception as terr:
            if '400' in str(terr) or '404' in str(terr):
                return jsonify({"status": "unavailable", "result": None})
            raise terr
    except Exception as e:
        logger.error(f"AAA test troubleshooting error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/cx/show-commands', methods=['GET'])
@require_session
def troubleshoot_cx_list_show_commands():
    """List available show commands for CX switch.
    
    Reference: https://developer.arubanetworks.com/new-central/reference/listcxshowcommands
    Endpoint: /network-troubleshooting/v1alpha1/cx/{serial-number}/showCommand
    """
    try:
        device_serial = request.args.get('device_serial')
        if not device_serial:
            return jsonify({"error": "device_serial is required"}), 400

        try:
            response = aruba_client.get(
                f'/network-troubleshooting/v1alpha1/cx/{device_serial}/showCommand'
            )
            
            # Transform response: combine all commands from all categories into one object
            if isinstance(response, list):
                all_commands = []
                for category in response:
                    if isinstance(category, dict) and 'commands' in category:
                        for cmd_obj in category.get('commands', []):
                            if isinstance(cmd_obj, dict) and 'command' in cmd_obj:
                                # Include category name with each command
                                all_commands.append({
                                    "command": cmd_obj['command'],
                                    "category": category.get('categoryName', 'Unknown')
                                })
                
                # Return as single object with all commands
                return jsonify({
                    "commands": all_commands,
                    "count": len(all_commands)
                })
            
            return jsonify(response)
        except Exception as terr:
            if '400' in str(terr) or '404' in str(terr):
                return jsonify({"status": "unavailable", "result": None})
            raise terr
    except Exception as e:
        logger.error(f"List show commands error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/cx/show-command', methods=['POST'])
@require_session
def troubleshoot_cx_run_show_command():
    """Run a show command on CX switch using async API.
    
    Reference: https://developer.arubanetworks.com/new-central/reference/runcxshowcommand
    Endpoint: /network-troubleshooting/v1alpha1/cx/{serial-number}/showCommand
    """
    try:
        data = request.get_json()
        device_serial = data.get('device_serial')
        command = data.get('command')

        if not device_serial or not command:
            return jsonify({"error": "device_serial and command are required"}), 400

        try:
            response = aruba_client.post(
                f'/network-troubleshooting/v1alpha1/cx/{device_serial}/showCommand',
                data={"command": command}
            )
            
            location = response.get('location', '')
            task_id_match = re.search(r'/async-operations/([a-f0-9\-]+)', location)
            if not task_id_match:
                if response.get('status') == 'COMPLETED':
                    return jsonify(response)
                return jsonify({"error": "Could not extract task ID from response"}), 500
            
            task_id = task_id_match.group(1)
            
            # Poll for completion
            max_attempts = 30
            poll_interval = 1
            max_wait_time = 30
            
            start_time = time.time()
            for attempt in range(max_attempts):
                if time.time() - start_time > max_wait_time:
                    return jsonify({
                        "error": "Show command operation timed out",
                        "status": "TIMEOUT",
                        "task_id": task_id
                    }), 504
                
                async_response = aruba_client.get(
                    f'/network-troubleshooting/v1alpha1/cx/{device_serial}/showCommand/async-operations/{task_id}'
                )
                
                status = async_response.get('status', 'UNKNOWN')
                
                if status == 'COMPLETED':
                    return jsonify(async_response)
                elif status == 'FAILED':
                    fail_reason = async_response.get('failReason', 'Unknown error')
                    return jsonify({
                        "error": f"Show command operation failed: {fail_reason}",
                        "status": "FAILED",
                        "task_id": task_id
                    }), 500
                elif status in ['INITIATED', 'IN_PROGRESS']:
                    time.sleep(poll_interval)
                    continue
                else:
                    time.sleep(poll_interval)
                    continue
            
            return jsonify({
                "error": "Show command operation did not complete within expected time",
                "status": "TIMEOUT",
                "task_id": task_id
            }), 504
            
        except Exception as terr:
            if '400' in str(terr) or '404' in str(terr):
                return jsonify({"status": "unavailable", "result": None})
            raise terr
    except Exception as e:
        logger.error(f"Run show command error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/cx/locate', methods=['POST'])
@require_session
def troubleshoot_cx_locate():
    """Locate a CX switch (flash LEDs).
    
    Reference: https://developer.arubanetworks.com/new-central/reference/locatecxswitch
    Endpoint: /network-troubleshooting/v1alpha1/cx/{serial-number}/locate
    """
    try:
        data = request.get_json()
        device_serial = data.get('device_serial')
        enable = data.get('enable', True)

        if not device_serial:
            return jsonify({"error": "device_serial is required"}), 400

        try:
            response = aruba_client.post(
                f'/network-troubleshooting/v1alpha1/cx/{device_serial}/locate',
                data={"enable": enable}
            )
            return jsonify(response)
        except Exception as terr:
            if '400' in str(terr) or '404' in str(terr):
                return jsonify({"status": "unavailable", "result": None})
            raise terr
    except Exception as e:
        logger.error(f"Locate switch error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/cx/reboot', methods=['POST'])
@require_session
def troubleshoot_cx_reboot():
    """Reboot a CX switch.
    
    Reference: https://developer.arubanetworks.com/new-central/reference/rebootcxswitch
    Endpoint: /network-troubleshooting/v1alpha1/cx/{serial-number}/reboot
    """
    try:
        data = request.get_json()
        device_serial = data.get('device_serial')

        if not device_serial:
            return jsonify({"error": "device_serial is required"}), 400

        try:
            response = aruba_client.post(
                f'/network-troubleshooting/v1alpha1/cx/{device_serial}/reboot',
                data={}
            )
            return jsonify(response)
        except Exception as terr:
            if '400' in str(terr) or '404' in str(terr):
                return jsonify({"status": "unavailable", "result": None})
            raise terr
    except Exception as e:
        logger.error(f"Reboot switch error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/troubleshoot/device-logs', methods=['GET'])
@require_session
def get_device_logs():
    """Get device logs for troubleshooting."""
    try:
        device_serial = request.args.get('serial')
        if not device_serial:
            return jsonify({"error": "Device serial required"}), 400
        try:
            response = aruba_client.get(f'/device-management/v1/device/{device_serial}/logs')
            return jsonify(response)
        except Exception:
            return jsonify({"items": [], "count": 0})
    except Exception as e:
        logger.error(f"Error fetching device logs: {e}")
        return jsonify({"items": [], "count": 0})


@app.route('/api/troubleshoot/client-session', methods=['GET'])
@require_session
def get_client_session():
    """Get client session details for troubleshooting."""
    try:
        mac_address = request.args.get('mac')
        if not mac_address:
            return jsonify({"error": "MAC address required"}), 400
        try:
            response = aruba_client.get(f'/network-monitoring/v1alpha1/clients/{mac_address}')
            return jsonify(response)
        except Exception:
            return jsonify({"session": None})
    except Exception as e:
        logger.error(f"Error fetching client session: {e}")
        return jsonify({"session": None})


@app.route('/api/troubleshoot/ap-diagnostics', methods=['GET'])
@require_session
def get_ap_diagnostics():
    """Get AP diagnostics for troubleshooting."""
    try:
        serial = request.args.get('serial')
        if not serial:
            return jsonify({"error": "AP serial required"}), 400
        try:
            response = aruba_client.get(f'/network-monitoring/v1alpha1/aps/{serial}')
            return jsonify(response)
        except Exception:
            return jsonify({"items": [], "count": 0})
    except Exception as e:
        logger.error(f"Error fetching AP diagnostics: {e}")
        return jsonify({"items": [], "count": 0})


@app.route('/api/troubleshoot/ap-radio-stats', methods=['GET'])
@require_session
def get_ap_radio_stats():
    """Get AP radio statistics for troubleshooting wireless issues."""
    try:
        serial = request.args.get('serial')
        if not serial:
            return jsonify({"error": "AP serial required"}), 400
        try:
            response = aruba_client.get(f'/network-monitoring/v1alpha1/aps/{serial}/radio-stats')
            return jsonify(response)
        except Exception:
            return jsonify({"items": [], "count": 0})
    except Exception as e:
        logger.error(f"Error fetching AP radio stats: {e}")
        return jsonify({"items": [], "count": 0})


@app.route('/api/troubleshoot/ap-interference', methods=['GET'])
@require_session
def get_ap_interference():
    """Get AP interference analysis."""
    try:
        serial = request.args.get('serial')
        if not serial:
            return jsonify({"error": "AP serial required"}), 400
        try:
            response = aruba_client.get(f'/network-monitoring/v1alpha1/aps/{serial}/interference')
            return jsonify(response)
        except Exception:
            return jsonify({"items": [], "count": 0})
    except Exception as e:
        logger.error(f"Error fetching AP interference: {e}")
        return jsonify({"items": [], "count": 0})


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

        try:
            if port:
                response = aruba_client.get(f'/network-monitoring/v1alpha1/switch/{serial}/interfaces/{port}')
            else:
                response = aruba_client.get(f'/network-monitoring/v1alpha1/switch/{serial}/interfaces')
            return jsonify(response)
        except Exception:
            return jsonify({"interfaces": []})
    except Exception as e:
        logger.error(f"Error fetching switch port status: {e}")
        return jsonify({"interfaces": []})


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
        # Graceful empty on 400/404
        err = str(e)
        if '404' in err or '400' in err or 'Not Found' in err or 'Bad Request' in err:
            logger.warning(f"Events endpoint returned client error; returning empty list: {err[:200]}")
            return jsonify({"items": [], "count": 0})
        logger.error(f"Error fetching events: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Firmware Management Endpoints =============

@app.route('/api/firmware/versions', methods=['GET'])
@require_session
def get_firmware_versions():
    """Get available firmware versions."""
    try:
        device_type = request.args.get('device_type', 'IAP')
        try:
            response = aruba_client.get(f'/firmware/v1/versions/{device_type}')
            return jsonify(response)
        except Exception as fw_err:
            # Fallback to new Central inventory-based versions (if available) or return empty
            if '404' in str(fw_err) or 'Not Found' in str(fw_err):
                logger.warning("Firmware versions API not found; returning empty list")
                return jsonify({"versions": [], "count": 0})
            raise fw_err
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
        response = aruba_client.post('/firmware/v1/upgrade', data=data)
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
        params = {'timeframe': timeframe}
        try:
            response = aruba_client.get('/monitoring/v1/networks/bandwidth_usage', params=params)
            return jsonify(response)
        except Exception as aerr:
            if '404' in str(aerr) or '400' in str(aerr) or 'Not Found' in str(aerr) or 'Bad Request' in str(aerr):
                logger.warning("Bandwidth analytics not available; returning empty result")
                return jsonify({"series": [], "count": 0})
            raise aerr
    except Exception as e:
        logger.error(f"Error fetching bandwidth analytics: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analytics/client-count', methods=['GET'])
@require_session
def get_client_count_analytics():
    """Get client count trends over time."""
    try:
        timeframe = request.args.get('timeframe', '1d')
        params = {'timeframe': timeframe}
        try:
            response = aruba_client.get('/monitoring/v1/clients/count', params=params)
            return jsonify(response)
        except Exception as aerr:
            if '404' in str(aerr) or '400' in str(aerr) or 'Not Found' in str(aerr) or 'Bad Request' in str(aerr):
                logger.warning("Client-count analytics not available; returning empty result")
                return jsonify({"series": [], "count": 0})
            raise aerr
    except Exception as e:
        logger.error(f"Error fetching client count analytics: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analytics/device-uptime', methods=['GET'])
@require_session
def get_device_uptime():
    """Get device uptime statistics."""
    try:
        try:
            response = aruba_client.get('/monitoring/v1/devices/uptime')
            return jsonify(response)
        except Exception as aerr:
            if '404' in str(aerr) or '400' in str(aerr) or 'Not Found' in str(aerr) or 'Bad Request' in str(aerr):
                logger.warning("Device uptime not available; returning empty list")
                return jsonify({"items": [], "count": 0})
            raise aerr
    except Exception as e:
        logger.error(f"Error fetching device uptime: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analytics/ap-performance', methods=['GET'])
@require_session
def get_ap_performance():
    """Get AP performance metrics."""
    try:
        try:
            response = aruba_client.get('/monitoring/v1/aps/performance')
            return jsonify(response)
        except Exception as aerr:
            if '404' in str(aerr) or '400' in str(aerr) or 'Not Found' in str(aerr) or 'Bad Request' in str(aerr):
                logger.warning("AP performance not available; returning empty list")
                return jsonify({"items": [], "count": 0})
            raise aerr
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
        try:
            response = aruba_client.get(f'/configuration/v1/devices/{serial}/configuration')
            # Check if response has configuration field
            if 'configuration' in response and response['configuration']:
                return jsonify(response)
            elif 'configuration' in response:
                return jsonify({"configuration": "", "error": "Configuration is empty. This endpoint may not be supported for this device type."}), 404
            return jsonify(response)
        except Exception as e:
            # Return proper error messages
            err = str(e)
            if '404' in err or 'Not Found' in err:
                return jsonify({"error": "Configuration endpoint not found. This device type may not support show run-config."}), 404
            elif '400' in err or 'Bad Request' in err:
                return jsonify({"error": "Bad request. The device may not support this command."}), 400
            else:
                logger.error(f"Show run config error for {serial}: {e}")
                return jsonify({"error": f"Failed to fetch configuration: {err}"}), 500
    except Exception as e:
        logger.error(f"Show run config error: {e}")
        return jsonify({"error": f"Internal error: {str(e)}"}), 500


@app.route('/api/troubleshoot/show-tech-support', methods=['GET'])
@require_session
def show_tech_support():
    """Get tech support information from a device."""
    try:
        serial = request.args.get('serial')
        if not serial:
            return jsonify({"error": "Device serial required"}), 400

        try:
            response = aruba_client.get(f'/troubleshooting/v1/devices/{serial}/tech-support')
            # Check if response has items
            if 'items' in response:
                if not response['items'] or len(response['items']) == 0:
                    return jsonify({"items": [], "count": 0, "error": "Tech support data is empty. This device may not support this command."}), 404
            return jsonify(response)
        except Exception as e:
            err = str(e)
            if '404' in err or 'Not Found' in err:
                return jsonify({"error": "Tech support endpoint not found. This device type may not support this command."}), 404
            elif '400' in err or 'Bad Request' in err:
                return jsonify({"error": "Bad request. The device may not support this command."}), 400
            else:
                logger.error(f"Show tech support error for {serial}: {e}")
                return jsonify({"error": f"Failed to fetch tech support: {err}"}), 500
    except Exception as e:
        logger.error(f"Show tech support error: {e}")
        return jsonify({"error": f"Internal error: {str(e)}"}), 500


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

        try:
            response = aruba_client.get(f'/network-monitoring/v1alpha1/switch/{serial}/interfaces')
            # Check if response has interfaces
            if 'interfaces' in response:
                if not response['interfaces'] or len(response['interfaces']) == 0:
                    return jsonify({"interfaces": [], "count": 0, "error": "No interfaces found. This command is typically only available for switches."}), 404
            return jsonify(response)
        except Exception as e:
            err = str(e)
            if '404' in err or 'Not Found' in err:
                return jsonify({"error": "Interfaces endpoint not found. This command is typically only available for switches."}), 404
            elif '400' in err or 'Bad Request' in err:
                return jsonify({"error": "Bad request. The device may not be a switch or may not support this command."}), 400
            else:
                logger.error(f"Show interfaces error for {serial}: {e}")
                return jsonify({"error": f"Failed to fetch interfaces: {err}"}), 500
    except Exception as e:
        logger.error(f"Show interfaces error: {e}")
        return jsonify({"error": f"Internal error: {str(e)}"}), 500


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
        # Optional GreenLake RBAC details
        rbac = data.get('rbac') or None
        rbac_client_id = ''
        rbac_client_secret = ''
        gl_api_base = ''
        if isinstance(rbac, dict):
            rbac_client_id = (rbac.get('client_id') or '').strip()
            rbac_client_secret = (rbac.get('client_secret') or '').strip()
            gl_api_base = (rbac.get('api_base') or 'https://global.api.greenlake.hpe.com').strip()

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
#
# Optional HPE GreenLake Platform RBAC credentials (used for MSP/tenant management)
GL_RBAC_CLIENT_ID={rbac_client_id}
GL_RBAC_CLIENT_SECRET={rbac_client_secret}
GL_API_BASE={gl_api_base}
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
            # Optional RBAC values
            os.environ['GL_RBAC_CLIENT_ID'] = rbac_client_id
            os.environ['GL_RBAC_CLIENT_SECRET'] = rbac_client_secret
            os.environ['GL_API_BASE'] = gl_api_base or 'https://global.api.greenlake.hpe.com'
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
            _save_sessions_to_disk()

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

# ============= GreenLake Identity (RBAC) Proxy Endpoints =============

def _get_greenlake_client():
    """Create a CentralAPIClient pointing to GreenLake Identity base with RBAC token manager."""
    try:
        gl_client_id = os.environ.get('GL_RBAC_CLIENT_ID', '').strip()
        gl_client_secret = os.environ.get('GL_RBAC_CLIENT_SECRET', '').strip()
        gl_api_base = (os.environ.get('GL_API_BASE') or 'https://global.api.greenlake.hpe.com').strip()
        if not gl_client_id or not gl_client_secret:
            raise ValueError("GreenLake RBAC credentials not configured")
        gl_tm = TokenManager(
            client_id=gl_client_id,
            client_secret=gl_client_secret,
            cache_file=".token_cache_greenlake.json",
        )
        return CentralAPIClient(base_url=gl_api_base, token_manager=gl_tm)
    except Exception as e:
        logger.error(f"Failed to initialize GreenLake client: {e}")
        return None


@app.route('/api/greenlake/users', methods=['GET'])
@require_session
def greenlake_list_users():
    """List users from HPE GreenLake Identity service."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        # Map query params
        params = {}
        filter_str = request.args.get('filter')
        if filter_str:
            params['filter'] = filter_str
        offset = request.args.get('offset')
        limit = request.args.get('limit')
        if offset is not None:
            params['offset'] = offset
        if limit is not None:
            params['limit'] = limit
        data = client.get('/identity/v1/users', params=params)
        return jsonify(data)
    except Exception as e:
        logger.error(f"GreenLake users fetch error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/greenlake/users/invite', methods=['POST'])
@require_session
def greenlake_invite_user():
    """Invite a user to the GreenLake workspace."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        data = request.get_json() or {}
        payload = {
            "email": data.get("email"),
            "sendWelcomeEmail": bool(data.get("sendWelcomeEmail", True)),
        }
        resp = client.post('/identity/v1/users', data=payload)
        return jsonify(resp), 201
    except Exception as e:
        logger.error(f"GreenLake invite user error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/greenlake/users/<user_id>', methods=['GET', 'PUT', 'DELETE'])
@require_session
def greenlake_user_detail(user_id):
    """Get, update, or delete a GreenLake user."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        if request.method == 'GET':
            data = client.get(f'/identity/v1/users/{user_id}')
            return jsonify(data)
        if request.method == 'PUT':
            payload = request.get_json() or {}
            # Accept language and idleTimeout per API doc
            body = {}
            if 'language' in payload:
                body['language'] = payload['language']
            if 'idleTimeout' in payload:
                body['idleTimeout'] = payload['idleTimeout']
            data = client.put(f'/identity/v1/users/{user_id}', data=body)
            return jsonify(data)
        if request.method == 'DELETE':
            data = client.delete(f'/identity/v1/users/{user_id}')
            return jsonify(data), 204
    except Exception as e:
        logger.error(f"GreenLake user detail error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/greenlake/devices', methods=['GET'])
@require_session
def greenlake_list_devices():
    """List devices from HPE GreenLake Device Management."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        params = {}
        # pagination
        offset = request.args.get('offset')
        limit = request.args.get('limit')
        if offset is not None:
            params['offset'] = offset
        if limit is not None:
            params['limit'] = limit
        # v1 devices list
        data = client.get('/devices/v1/devices', params=params)
        return jsonify(data)
    except Exception as e:
        logger.error(f"GreenLake devices fetch error: {e}")
        return jsonify({"error": str(e)}), 500
@app.route('/api/greenlake/devices', methods=['POST', 'PATCH'])
@require_session
def greenlake_modify_devices():
    """Create or update devices via GreenLake Device Management."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        payload = request.get_json() or {}
        if request.method == 'POST':
            data = client.post('/devices/v1/devices', data=payload)
            return jsonify(data), 201
        if request.method == 'PATCH':
            data = client.put('/devices/v1/devices', data=payload) if False else client.post('/devices/v1/devices', data=payload)  # placeholder if API expects PATCH; central client supports put/post
            return jsonify(data)
    except Exception as e:
        logger.error(f"GreenLake devices modify error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/greenlake/tags', methods=['GET'])
@require_session
def greenlake_list_tags():
    """List tags from HPE GreenLake Tags service."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        params = {}
        data = client.get('/tags/v1/tags', params=params)
        return jsonify(data)
    except Exception as e:
        logger.error(f"GreenLake tags fetch error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/greenlake/tags', methods=['POST'])
@require_session
def greenlake_create_tag():
    """Create a tag (if supported by Tags v1)."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        payload = request.get_json() or {}
        data = client.post('/tags/v1/tags', data=payload)
        return jsonify(data), 201
    except Exception as e:
        logger.error(f"GreenLake create tag error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/greenlake/tags/<tag_id>', methods=['PATCH'])
@require_session
def greenlake_update_tag(tag_id):
    """Update a tag (if supported by Tags v1)."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        payload = request.get_json() or {}
        data = client.put(f'/tags/v1/tags/{tag_id}', data=payload)
        return jsonify(data)
    except Exception as e:
        logger.error(f"GreenLake update tag error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/greenlake/subscriptions', methods=['GET'])
@require_session
def greenlake_list_subscriptions():
    """List subscriptions from HPE GreenLake Subscription Management."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        params = {}
        offset = request.args.get('offset')
        limit = request.args.get('limit')
        if offset is not None:
            params['offset'] = offset
        if limit is not None:
            params['limit'] = limit
        data = client.get('/subscriptions/v1/subscriptions', params=params)
        return jsonify(data)
    except Exception as e:
        logger.error(f"GreenLake subscriptions fetch error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/greenlake/subscriptions', methods=['POST'])
@require_session
def greenlake_create_subscription():
    """Create subscription (if supported by Subscriptions v1)."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        payload = request.get_json() or {}
        data = client.post('/subscriptions/v1/subscriptions', data=payload)
        return jsonify(data), 201
    except Exception as e:
        logger.error(f"GreenLake create subscription error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/greenlake/subscriptions/<sub_id>', methods=['PATCH'])
@require_session
def greenlake_update_subscription(sub_id):
    """Update subscription (if supported by Subscriptions v1)."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        payload = request.get_json() or {}
        data = client.put(f'/subscriptions/v1/subscriptions/{sub_id}', data=payload)
        return jsonify(data)
    except Exception as e:
        logger.error(f"GreenLake update subscription error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/greenlake/workspaces', methods=['GET'])
@require_session
def greenlake_list_workspaces():
    """List MSP tenants/workspaces from HPE GreenLake Workspaces."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        params = {}
        try:
            data = client.get('/workspaces/v1/msp-tenants', params=params)
            return jsonify(data)
        except Exception as e:
            err = str(e)
            if '404' in err or 'Not Found' in err or '400' in err or 'Bad Request' in err or '403' in err or 'Unauthorized' in err:
                return jsonify({"items": [], "count": 0, "error": "GreenLake Workspaces not available"}), 404
            return jsonify({"items": [], "count": 0})
    except Exception as e:
        logger.error(f"GreenLake workspaces fetch error: {e}")
        return jsonify({"items": [], "count": 0})

@app.route('/api/greenlake/locations', methods=['GET'])
@require_session
def greenlake_list_locations():
    """List locations from HPE GreenLake Locations service."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        params = {}
        offset = request.args.get('offset')
        limit = request.args.get('limit')
        if offset is not None:
            params['offset'] = offset
        if limit is not None:
            params['limit'] = limit
        try:
            data = client.get('/locations/v1/locations', params=params)
            return jsonify(data)
        except Exception as e:
            err = str(e)
            if '404' in err or 'Not Found' in err or '400' in err or 'Bad Request' in err or '403' in err or 'Unauthorized' in err:
                return jsonify({"items": [], "count": 0, "error": "GreenLake Locations not available"}), 404
            return jsonify({"items": [], "count": 0})
    except Exception as e:
        logger.error(f"GreenLake locations fetch error: {e}")
        return jsonify({"items": [], "count": 0})
@app.route('/api/greenlake/locations', methods=['POST'])
@require_session
def greenlake_create_location():
    """Create a location (GreenLake Locations)."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        payload = request.get_json() or {}
        data = client.post('/locations/v1/locations', data=payload)
        return jsonify(data), 201
    except Exception as e:
        logger.error(f"GreenLake create location error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/greenlake/locations/<location_id>', methods=['PATCH', 'DELETE'])
@require_session
def greenlake_update_delete_location(location_id):
    """Update or delete a location."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        if request.method == 'PATCH':
            payload = request.get_json() or {}
            data = client.put(f'/locations/v1/locations/{location_id}', data=payload)
            return jsonify(data)
        if request.method == 'DELETE':
            data = client.delete(f'/locations/v1/locations/{location_id}')
            return jsonify(data), 204
    except Exception as e:
        logger.error(f"GreenLake update/delete location error: {e}")
        return jsonify({"error": str(e)}), 500

# ============= GreenLake SCIM (Users/Groups) =============

@app.route('/api/greenlake/scim/users', methods=['GET', 'POST'])
@require_session
def greenlake_scim_users():
    """List or create SCIM users."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        if request.method == 'GET':
            params = request.args.to_dict()
            try:
                data = client.get('/identity/v2beta1/scim/v2/Users', params=params)
                return jsonify(data)
            except Exception as e:
                err = str(e)
                if '404' in err or 'Not Found' in err or '400' in err or 'Bad Request' in err or '403' in err or 'Unauthorized' in err:
                    return jsonify({"Resources": [], "totalResults": 0, "error": "SCIM Users not available"}), 404
                return jsonify({"Resources": [], "totalResults": 0})
        if request.method == 'POST':
            payload = request.get_json() or {}
            data = client.post('/identity/v2beta1/scim/v2/Users', data=payload)
            return jsonify(data), 201
    except Exception as e:
        logger.error(f"GreenLake SCIM users error: {e}")
        return jsonify({"Resources": [], "totalResults": 0})


@app.route('/api/greenlake/scim/users/<user_id>', methods=['GET', 'PATCH', 'DELETE'])
@require_session
def greenlake_scim_user_detail(user_id):
    """Get, update, or delete a SCIM user."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        if request.method == 'GET':
            data = client.get(f'/identity/v2beta1/scim/v2/Users/{user_id}')
            return jsonify(data)
        if request.method == 'PATCH':
            payload = request.get_json() or {}
            data = client.put(f'/identity/v2beta1/scim/v2/Users/{user_id}', data=payload)
            return jsonify(data)
        if request.method == 'DELETE':
            data = client.delete(f'/identity/v2beta1/scim/v2/Users/{user_id}')
            return jsonify(data), 204
    except Exception as e:
        logger.error(f"GreenLake SCIM user detail error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/greenlake/scim/groups', methods=['GET', 'POST'])
@require_session
def greenlake_scim_groups():
    """List or create SCIM groups."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        if request.method == 'GET':
            params = request.args.to_dict()
            try:
                data = client.get('/identity/v2beta1/scim/v2/Groups', params=params)
                return jsonify(data)
            except Exception as e:
                err = str(e)
                if '404' in err or 'Not Found' in err or '400' in err or 'Bad Request' in err or '403' in err or 'Unauthorized' in err:
                    return jsonify({"Resources": [], "totalResults": 0, "error": "SCIM Groups not available"}), 404
                return jsonify({"Resources": [], "totalResults": 0})
        if request.method == 'POST':
            payload = request.get_json() or {}
            data = client.post('/identity/v2beta1/scim/v2/Groups', data=payload)
            return jsonify(data), 201
    except Exception as e:
        logger.error(f"GreenLake SCIM groups error: {e}")
        return jsonify({"Resources": [], "totalResults": 0})


@app.route('/api/greenlake/scim/groups/<group_id>', methods=['GET', 'PATCH', 'DELETE'])
@require_session
def greenlake_scim_group_detail(group_id):
    """Get, update, or delete a SCIM group."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        if request.method == 'GET':
            data = client.get(f'/identity/v2beta1/scim/v2/Groups/{group_id}')
            return jsonify(data)
        if request.method == 'PATCH':
            payload = request.get_json() or {}
            data = client.put(f'/identity/v2beta1/scim/v2/Groups/{group_id}', data=payload)
            return jsonify(data)
        if request.method == 'DELETE':
            data = client.delete(f'/identity/v2beta1/scim/v2/Groups/{group_id}')
            return jsonify(data), 204
    except Exception as e:
        logger.error(f"GreenLake SCIM group detail error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/greenlake/scim/users/<user_id>/groups', methods=['GET'])
@require_session
def greenlake_scim_user_groups(user_id):
    """List groups for a user (SCIM extensions)."""
    try:
        client = _get_greenlake_client()
        if not client:
            return jsonify({"error": "GreenLake RBAC not configured"}), 400
        data = client.get(f'/identity/v2beta1/scim/v2/extensions/Users/{user_id}/groups')
        return jsonify(data)
    except Exception as e:
        logger.error(f"GreenLake SCIM user groups error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/reporting/top-aps-by-wireless-usage', methods=['GET'])
@require_session
def get_top_aps_by_wireless_usage():
    """Get top access points by wireless bandwidth usage."""
    try:
        site_id = request.args.get('site_id', request.args.get('site-id'))
        count = request.args.get('count', 10)
        from_timestamp = request.args.get('from_timestamp')
        to_timestamp = request.args.get('to_timestamp')
        timeframe = request.args.get('timeframe', '1d')

        # Auto-select first site if not provided
        if not site_id:
            try:
                sites = aruba_client.get('/central/v2/sites')
                if isinstance(sites, dict) and sites.get('sites'):
                    site_id = sites['sites'][0].get('site_id') or sites['sites'][0].get('id')
            except Exception as _:
                pass

        params = {'count': count, 'timeframe': timeframe}
        if site_id:
            params['site-id'] = site_id
        if from_timestamp:
            params['from_timestamp'] = from_timestamp
        if to_timestamp:
            params['to_timestamp'] = to_timestamp

        try:
            response = aruba_client.get('/network-monitoring/v1alpha1/top-aps-by-wireless-usage', params=params)
            return jsonify(response)
        except Exception:
            try:
                response = aruba_client.get('/reporting/v1/top-aps-by-wireless-usage', params=params)
                return jsonify(response)
            except Exception:
                return jsonify({"items": [], "count": 0})
    except Exception as e:
        logger.error(f"Error fetching top APs by wireless usage: {e}")
        return jsonify({"items": [], "count": 0})


@app.route('/api/reporting/top-aps-by-client-count', methods=['GET'])
@require_session
def get_top_aps_by_client_count():
    """Get top access points by connected client count."""
    try:
        site_id = request.args.get('site_id', request.args.get('site-id'))
        count = request.args.get('count', 10)
        timeframe = request.args.get('timeframe', '1d')

        # Auto-select first site if not provided
        if not site_id:
            try:
                sites = aruba_client.get('/central/v2/sites')
                if isinstance(sites, dict) and sites.get('sites'):
                    site_id = sites['sites'][0].get('site_id') or sites['sites'][0].get('id')
            except Exception as _:
                pass

        params = {'count': count, 'timeframe': timeframe}
        if site_id:
            params['site-id'] = site_id

        try:
            response = aruba_client.get('/network-monitoring/v1alpha1/top-aps-by-client-count', params=params)
            return jsonify(response)
        except Exception:
            try:
                response = aruba_client.get('/reporting/v1/top-aps-by-client-count', params=params)
                return jsonify(response)
            except Exception:
                return jsonify({"items": [], "count": 0})
    except Exception as e:
        logger.error(f"Error fetching top APs by client count: {e}")
        return jsonify({"items": [], "count": 0})


@app.route('/api/reporting/network-usage', methods=['GET'])
@require_session
def get_network_usage_report():
    """Get network usage report."""
    try:
        site_id = request.args.get('site_id', request.args.get('site-id'))
        timeframe = request.args.get('timeframe', '1d')

        # Auto-select first site if not provided
        if not site_id:
            try:
                sites = aruba_client.get('/central/v2/sites')
                if isinstance(sites, dict) and sites.get('sites'):
                    site_id = sites['sites'][0].get('site_id') or sites['sites'][0].get('id')
            except Exception as _:
                pass

        params = {'timeframe': timeframe}
        if site_id:
            params['site-id'] = site_id

        try:
            response = aruba_client.get('/network-monitoring/v1alpha1/network-usage', params=params)
            return jsonify(response)
        except Exception:
            try:
                response = aruba_client.get('/reporting/v1/network-usage', params=params)
                return jsonify(response)
            except Exception:
                return jsonify({"series": [], "count": 0})
    except Exception as e:
        logger.error(f"Error fetching network usage report: {e}")
        return jsonify({"series": [], "count": 0})


@app.route('/api/reporting/device-inventory', methods=['GET'])
@require_session
def get_device_inventory_report():
    """Get device inventory report with detailed statistics."""
    try:
        # Get all devices
        try:
            devices_response = aruba_client.get('/network-monitoring/v1alpha1/devices')
        except Exception:
            try:
                devices_response = aruba_client.get('/reporting/v1/device-inventory')
            except Exception:
                return jsonify({"devices": [], "count": 0})

        if 'items' not in devices_response:
            return jsonify({"devices": [], "count": 0})

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
        return jsonify({"devices": [], "count": 0})


@app.route('/api/reporting/wireless-health', methods=['GET'])
@require_session
def get_wireless_health_report():
    """Get wireless network health report."""
    try:
        site_id = request.args.get('site_id', request.args.get('site-id'))

        params = {}
        if site_id:
            params['site-id'] = site_id

        try:
            response = aruba_client.get('/network-monitoring/v1alpha1/wireless-health', params=params)
            return jsonify(response)
        except Exception:
            try:
                response = aruba_client.get('/reporting/v1/wireless-health', params=params)
                return jsonify(response)
            except Exception:
                return jsonify({"items": [], "count": 0})
    except Exception as e:
        logger.error(f"Error fetching wireless health report: {e}")
        return jsonify({"items": [], "count": 0})


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

        try:
            response = aruba_client.get('/network-monitoring/v1alpha1/top-ssids-by-usage', params=params)
            return jsonify(response)
        except Exception:
            try:
                response = aruba_client.get('/reporting/v1/top-ssids-by-usage', params=params)
                return jsonify(response)
            except Exception:
                return jsonify({"items": [], "count": 0})
    except Exception as e:
        logger.error(f"Error fetching top SSIDs by usage: {e}")
        return jsonify({"items": [], "count": 0})


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


@app.route('/api/health', methods=['GET'])
def get_health():
    """Lightweight unauthenticated health endpoint for frontend checks."""
    return jsonify({"status": "ok"}), 200


@app.route('/api/services/subscriptions', methods=['GET'])
@require_session
def get_service_subscriptions():
    """Get service subscriptions and licenses."""
    try:
        try:
            response = aruba_client.get('/platform/licensing/v1/subscriptions')
            return jsonify(response)
        except Exception as serr:
            if '404' in str(serr) or '400' in str(serr) or 'Not Found' in str(serr) or 'Bad Request' in str(serr):
                logger.warning("Service subscriptions not available; returning empty list")
                return jsonify({"subscriptions": [], "count": 0})
            raise serr
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

        try:
            response = aruba_client.get('/platform/auditlogs/v1/logs', params=params)
            return jsonify(response)
        except Exception as aerr:
            if '404' in str(aerr) or '400' in str(aerr) or 'Not Found' in str(aerr) or 'Bad Request' in str(aerr):
                logger.warning("Audit logs not available; returning empty list")
                return jsonify({"logs": [], "count": 0, "offset": int(offset)})
            raise aerr
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
        # Normalize site id key expected by upstream API
        site_id = request.args.get('site_id', request.args.get('site-id'))
        if site_id:
            params['site-id'] = site_id
        # Optional timeframe passthrough (e.g., 1h, 1d, 7d)
        if request.args.get('timeframe'):
            params['timeframe'] = request.args.get('timeframe')
        if request.args.get('limit'):
            params['limit'] = request.args.get('limit')

        response = aruba_client.get('/network-monitoring/v1alpha1/switches', params=params)
        return jsonify(response)
    except Exception as e:
        # Gracefully handle 400/404 as empty list
        try:
            from requests.exceptions import HTTPError
            if isinstance(e, HTTPError) and getattr(e, 'response', None) is not None and e.response.status_code in (400, 404):
                logger.warning(f"Switches monitoring returned {e.response.status_code}; returning empty result")
                return jsonify({"count": 0, "items": []})
        except Exception:
            pass
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
        # Normalize site id key expected by upstream API
        site_id = request.args.get('site_id', request.args.get('site-id'))
        if site_id:
            params['site-id'] = site_id
        # Optional timeframe passthrough (e.g., 1h, 1d, 7d)
        if request.args.get('timeframe'):
            params['timeframe'] = request.args.get('timeframe')
        if request.args.get('limit'):
            params['limit'] = request.args.get('limit')

        response = aruba_client.get('/network-monitoring/v1alpha1/applications', params=params)
        return jsonify(response)
    except Exception as e:
        # If upstream provided HTTP details, pass through status and message for easier debugging
        try:
            import requests
            if isinstance(e, requests.HTTPError) and e.response is not None:
                status = e.response.status_code
                text = e.response.text or ''
                logger.error(f"Upstream error applications: {status} {text[:300]}")
                # Try to forward JSON if present
                try:
                    return jsonify(e.response.json()), status
                except Exception:
                    return jsonify({"error": text}), status
        except Exception:
            pass
        logger.error(f"Error fetching application visibility: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/monitoring/applications/top', methods=['GET'])
@require_session
def get_top_applications():
    """Get top applications by bandwidth usage."""
    try:
        params = {}
        # Normalize site id key expected by upstream API
        site_id = request.args.get('site_id', request.args.get('site-id'))
        if site_id:
            params['site-id'] = site_id
        # Optional timeframe passthrough (e.g., 1h, 1d, 7d)
        if request.args.get('timeframe'):
            params['timeframe'] = request.args.get('timeframe')
        limit = 10
        if request.args.get('limit'):
            try:
                limit = int(request.args.get('limit', 10))
            except Exception:
                limit = 10

        # Derive top applications from the generic applications API

        # Fallback logic
        try:
            apps_response = aruba_client.get('/network-monitoring/v1alpha1/applications', params=params)
        except Exception as apps_err:
            try:
                from requests.exceptions import HTTPError
                if isinstance(apps_err, HTTPError) and getattr(apps_err, 'response', None) is not None and apps_err.response.status_code in (400, 404):
                    logger.warning(f"Applications endpoint unavailable/invalid params (status {apps_err.response.status_code}); returning empty list")
                    return jsonify({"count": 0, "items": []})
            except Exception:
                pass
            raise apps_err

        # Extract list safely
        if isinstance(apps_response, dict):
            app_list = apps_response.get('applications') or apps_response.get('items') or []
        elif isinstance(apps_response, list):
            app_list = apps_response
        else:
            app_list = []

        def app_metric(app: dict) -> float:
            # Try common fields; default to 0 if missing or non-numeric
            candidates = [
                app.get('total_bytes'),
                app.get('bytes'),
                app.get('usage_bytes'),
                app.get('bandwidth_bps'),
            ]
            numeric = [c for c in candidates if isinstance(c, (int, float))]
            return max(numeric) if numeric else 0.0

        # Sort and slice
        sorted_apps = sorted(app_list, key=app_metric, reverse=True)[:limit]
        return jsonify({
            "count": len(sorted_apps),
            "items": sorted_apps
        })
    except Exception as e:
        # If upstream provided HTTP details, pass through status and message for easier debugging
        try:
            import requests
            if isinstance(e, requests.HTTPError) and e.response is not None:
                status = e.response.status_code
                text = e.response.text or ''
                logger.error(f"Upstream error applications/top: {status} {text[:300]}")
                try:
                    return jsonify(e.response.json()), status
                except Exception:
                    return jsonify({"error": text}), status
        except Exception:
            pass
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


# Geocoding and Timezone proxy endpoints (free providers, no API keys)
try:
    import requests as _requests  # type: ignore
except Exception:
    _requests = None

@app.route('/api/geocode/search', methods=['GET'])
def geocode_search():
    """
    Proxy to free geocoding provider (Nominatim) to avoid browser CSP/CORS issues.
    Query params:
      - q: search text
      - limit: max results (default 5)
      - country: optional ISO2 filter (e.g., 'us'); if not provided we default to US
    """
    try:
        if not _requests:
            return jsonify({"error": "requests module unavailable"}), 500
        q = request.args.get('q', '').strip()
        limit = int(request.args.get('limit', '5'))
        country = (request.args.get('country') or 'us').lower()
        if not q:
            return jsonify({"items": []})
        resp = _requests.get(
            'https://nominatim.openstreetmap.org/search',
            params={'q': q, 'format': 'json', 'addressdetails': 1, 'limit': limit},
            headers={'User-Agent': 'aruba-central-portal/1.0'}
        )
        resp.raise_for_status()
        data = resp.json()
        items = []
        for it in data:
            addr = it.get('address', {}) if isinstance(it.get('address'), dict) else {}
            # Enforce US-only (or requested country) results
            if country and (addr.get('country_code') or '').lower() != country:
                continue
            items.append({
                "label": it.get('display_name'),
                "lat": float(it.get('lat')) if it.get('lat') else None,
                "lon": float(it.get('lon')) if it.get('lon') else None,
                "city": addr.get('city') or addr.get('town') or addr.get('village') or addr.get('hamlet'),
                "state": addr.get('state'),
                "country": addr.get('country'),
                "country_code": addr.get('country_code'),
                "postcode": addr.get('postcode'),
            })
        return jsonify({"items": items})
    except Exception as e:
        logger.error(f"Geocode search error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/geocode/timezone', methods=['GET'])
def geocode_timezone():
    """
    Given lat/lon, return timezone id via BigDataCloud (no key).
    Query params:
      - lat
      - lon
    """
    try:
        if not _requests:
            return jsonify({"error": "requests module unavailable"}), 500
        lat = request.args.get('lat')
        lon = request.args.get('lon')
        if not lat or not lon:
            return jsonify({"error": "lat and lon required"}), 400
        resp = _requests.get(
            'https://api.bigdatacloud.net/data/timezone-by-location',
            params={'latitude': lat, 'longitude': lon}
        )
        resp.raise_for_status()
        data = resp.json()
        tz = data.get('ianaTimeId') or data.get('timeZone') or data.get('timeZoneId')
        return jsonify({"timezone": tz})
    except Exception as e:
        logger.error(f"Timezone lookup error: {e}")
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

    # If the path exists as a static file, serve it directly with cache headers
    if path and app.static_folder:
        file_path = Path(app.static_folder) / path
        if file_path.exists() and file_path.is_file():
            response = send_from_directory(app.static_folder, path)
            # Add cache headers for static assets
            response = add_cache_headers(response, is_static=True)
            # Add ETag for cache validation
            with open(file_path, 'rb') as f:
                content = f.read()
            response = add_etag_header(response, content)
            return response

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


# ============= Configuration API - Network Config v1alpha1 =============
# Comprehensive Configuration API endpoints based on Aruba Central Configuration API
# Reference: https://developer.arubanetworks.com/new-central-config/reference

# ============= Scope Management APIs =============

@app.route('/api/config/sites', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/sites', error_msg="Get sites", fallback_data={"items": [], "count": 0})
def get_config_sites(): pass

@app.route('/api/config/sites', methods=['POST'])
@require_session
def create_config_site():
    """Create a new site."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post('/network-config/v1alpha1/sites', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating site: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/sites', methods=['PUT'])
@require_session
def update_config_site():
    """Update an existing site."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.put('/network-config/v1alpha1/sites', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating site: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/sites', methods=['DELETE'])
@require_session
def delete_config_site():
    """Delete a site by scope-id."""
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

@app.route('/api/config/sites/bulk-delete', methods=['DELETE'])
@require_session
def bulk_delete_sites():
    """Bulk delete sites."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.delete('/network-config/v1alpha1/sites/bulk-delete', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error bulk deleting sites: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/site-collections', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/site-collections', error_msg="Get site collections", fallback_data={"items": [], "count": 0})
def get_site_collections(): pass

@app.route('/api/config/site-collections', methods=['POST'])
@require_session
def create_site_collection():
    """Create a new site-collection."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post('/network-config/v1alpha1/site-collections', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating site-collection: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/site-collections', methods=['PUT'])
@require_session
def update_site_collection():
    """Update an existing site-collection."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.put('/network-config/v1alpha1/site-collections', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating site-collection: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/site-collections', methods=['DELETE'])
@require_session
def delete_site_collection():
    """Delete a site-collection by scope-id."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        scope_id = request.args.get('scope-id')
        if not scope_id:
            return jsonify({"error": "scope-id query parameter is required"}), 400
        params = {'scope-id': scope_id}
        response = aruba_client.delete('/network-config/v1alpha1/site-collections', params=params)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting site-collection: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/site-collections/bulk-delete', methods=['DELETE'])
@require_session
def bulk_delete_site_collections():
    """Bulk delete site-collections."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.delete('/network-config/v1alpha1/site-collections/bulk-delete', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error bulk deleting site-collections: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/site-collections/add-sites', methods=['POST'])
@require_session
def add_sites_to_collection():
    """Add sites to an existing site-collection."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post('/network-config/v1alpha1/site-collections/add-sites', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error adding sites to collection: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/site-collections/remove-sites', methods=['DELETE'])
@require_session
def remove_sites_from_collection():
    """Remove sites from site-collection."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.delete('/network-config/v1alpha1/site-collections/remove-sites', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error removing sites from collection: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/device-groups', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/device-groups', error_msg="Get device groups", fallback_data={"items": [], "count": 0})
def get_device_groups(): pass

@app.route('/api/config/scope-hierarchy', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/hierarchy', error_msg="Get scope hierarchy", fallback_data={})
def get_scope_hierarchy(): pass

# ============= Template Support Endpoints =============

@app.route('/api/config/templates/<resource>', methods=['GET'])
@require_session
def get_templates_for_resource(resource):
    """Get available templates for a resource type."""
    try:
        # Return template definitions for the resource
        # This will be expanded with actual template files later
        templates = {
            'sites': [
                {'id': 'sites-csv', 'name': 'Sites (CSV)', 'format': 'csv', 'description': 'CSV format for bulk site import'},
                {'id': 'sites-json', 'name': 'Sites (JSON)', 'format': 'json', 'description': 'JSON format for site import'}
            ],
            'mac-registrations': [
                {'id': 'mac-csv', 'name': 'MAC Registrations (CSV)', 'format': 'csv', 'description': 'CSV format for MAC registration import'},
                {'id': 'mac-json', 'name': 'MAC Registrations (JSON)', 'format': 'json', 'description': 'JSON format for MAC registration import'}
            ]
        }
        return jsonify({'templates': templates.get(resource, [])})
    except Exception as e:
        logger.error(f"Error getting templates: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/templates/<resource>/<template_id>', methods=['GET'])
@require_session
def download_template(resource, template_id):
    """Download a template file."""
    try:
        # TODO: Serve actual template files from backend
        # For now, return a JSON response with template content
        from flask import make_response
        response = make_response('template content here')
        response.headers['Content-Type'] = 'text/csv' if 'csv' in template_id else 'application/json'
        response.headers['Content-Disposition'] = f'attachment; filename={template_id}'
        return response
    except Exception as e:
        logger.error(f"Error downloading template: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/<resource>/import', methods=['POST'])
@require_session
def import_resource(resource):
    """Import resources from file (CSV/JSON)."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        
        template_id = request.form.get('template_id')
        file = request.files.get('file')
        
        if not file:
            return jsonify({"error": "No file provided"}), 400
        
        # TODO: Parse file and validate against template
        # TODO: Call appropriate API endpoints to create/update resources
        
        return jsonify({"message": "Import functionality coming soon", "resource": resource, "template": template_id})
    except Exception as e:
        logger.error(f"Error importing {resource}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/<resource>/export', methods=['GET'])
@require_session
def export_resource(resource):
    """Export resources to file (CSV/JSON)."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        
        format = request.args.get('format', 'csv')
        # TODO: Fetch resources and format as CSV/JSON
        
        return jsonify({"message": "Export functionality coming soon", "resource": resource, "format": format})
    except Exception as e:
        logger.error(f"Error exporting {resource}: {e}")
        return jsonify({"error": str(e)}), 500

# ============= Application Experience APIs =============

@app.route('/api/config/airgroup-system', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/airgroup-system', error_msg="Get airgroup system", fallback_data={})
def get_airgroup_system(): pass

@app.route('/api/config/airgroup-system', methods=['POST'])
@require_session
def create_airgroup_system():
    """Create new airgroup system configuration."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post('/network-config/v1alpha1/airgroup-system', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating airgroup system: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/airgroup-system', methods=['PATCH'])
@require_session
def update_airgroup_system():
    """Modify airgroup system configuration."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.patch('/network-config/v1alpha1/airgroup-system', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating airgroup system: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/airgroup-system', methods=['DELETE'])
@require_session
def delete_airgroup_system():
    """Delete airgroup system."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        response = aruba_client.delete('/network-config/v1alpha1/airgroup-system')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting airgroup system: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/app-recog-control', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/app-recog-control', error_msg="Get ARC configuration", fallback_data={})
def get_app_recog_control(): pass

@app.route('/api/config/app-recog-control/<name>', methods=['GET'])
@require_session
@api_proxy(lambda name: f'/network-config/v1alpha1/app-recog-control/{name}', error_msg="Get ARC profile", fallback_data={})
def get_app_recog_control_profile(name): pass

@app.route('/api/config/app-recog-control/<name>', methods=['POST'])
@require_session
def create_app_recog_control_profile(name):
    """Create new ARC profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post(f'/network-config/v1alpha1/app-recog-control/{name}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating ARC profile: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/app-recog-control/<name>', methods=['PATCH'])
@require_session
def update_app_recog_control_profile(name):
    """Update ARC profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.patch(f'/network-config/v1alpha1/app-recog-control/{name}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating ARC profile: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/app-recog-control/<name>', methods=['DELETE'])
@require_session
def delete_app_recog_control_profile(name):
    """Delete ARC profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        response = aruba_client.delete(f'/network-config/v1alpha1/app-recog-control/{name}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting ARC profile: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/ucc', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/ucc', error_msg="Get UCC configuration", fallback_data={})
def get_ucc(): pass

@app.route('/api/config/ucc/<name>', methods=['GET'])
@require_session
@api_proxy(lambda name: f'/network-config/v1alpha1/ucc/{name}', error_msg="Get UCC profile", fallback_data={})
def get_ucc_profile(name): pass

@app.route('/api/config/ucc/<name>', methods=['POST'])
@require_session
def create_ucc_profile(name):
    """Create UCC profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post(f'/network-config/v1alpha1/ucc/{name}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating UCC profile: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/ucc/<name>', methods=['PATCH'])
@require_session
def update_ucc_profile(name):
    """Update UCC profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.patch(f'/network-config/v1alpha1/ucc/{name}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating UCC profile: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/ucc/<name>', methods=['DELETE'])
@require_session
def delete_ucc_profile(name):
    """Delete UCC profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        response = aruba_client.delete(f'/network-config/v1alpha1/ucc/{name}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting UCC profile: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/airgroup-policy', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/airgroup-policies', error_msg="Get airgroup policies", fallback_data={"items": [], "count": 0})
def get_airgroup_policies(): pass

@app.route('/api/config/airgroup-policy', methods=['POST'])
@require_session
def create_airgroup_policy():
    """Create new airgroup policy."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post('/network-config/v1alpha1/airgroup-policies', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating airgroup policy: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/airgroup-policy/<policy_id>', methods=['GET'])
@require_session
@api_proxy(lambda policy_id: f'/network-config/v1alpha1/airgroup-policies/{policy_id}', error_msg="Get airgroup policy", fallback_data={})
def get_airgroup_policy(policy_id): pass

@app.route('/api/config/airgroup-policy/<policy_id>', methods=['PATCH'])
@require_session
def update_airgroup_policy(policy_id):
    """Update airgroup policy."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.patch(f'/network-config/v1alpha1/airgroup-policies/{policy_id}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating airgroup policy: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/airgroup-policy/<policy_id>', methods=['DELETE'])
@require_session
def delete_airgroup_policy(policy_id):
    """Delete airgroup policy."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        response = aruba_client.delete(f'/network-config/v1alpha1/airgroup-policies/{policy_id}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting airgroup policy: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/airgroup-service-definition', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/airgroup-service-definitions', error_msg="Get airgroup service definitions", fallback_data={"items": [], "count": 0})
def get_airgroup_service_definitions(): pass

@app.route('/api/config/airgroup-service-definition', methods=['POST'])
@require_session
def create_airgroup_service_definition():
    """Create new airgroup service definition."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post('/network-config/v1alpha1/airgroup-service-definitions', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating airgroup service definition: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/airgroup-service-definition/<definition_id>', methods=['GET'])
@require_session
@api_proxy(lambda definition_id: f'/network-config/v1alpha1/airgroup-service-definitions/{definition_id}', error_msg="Get airgroup service definition", fallback_data={})
def get_airgroup_service_definition(definition_id): pass

@app.route('/api/config/airgroup-service-definition/<definition_id>', methods=['PATCH'])
@require_session
def update_airgroup_service_definition(definition_id):
    """Update airgroup service definition."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.patch(f'/network-config/v1alpha1/airgroup-service-definitions/{definition_id}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating airgroup service definition: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/airgroup-service-definition/<definition_id>', methods=['DELETE'])
@require_session
def delete_airgroup_service_definition(definition_id):
    """Delete airgroup service definition."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        response = aruba_client.delete(f'/network-config/v1alpha1/airgroup-service-definitions/{definition_id}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting airgroup service definition: {e}")
        return jsonify({"error": str(e)}), 500

# ============= Central NAC APIs =============

# CDA Endpoint helper - removed dynamic function creation to avoid Flask endpoint conflicts
# Instead, create endpoints individually

@app.route('/api/config/cda-authz-policy', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/cda-authz-policy', error_msg="Get CDA authz policy", fallback_data={})
def get_cda_authz_policy(): pass

@app.route('/api/config/cda-authz-policy', methods=['POST'])
@require_session
def create_cda_authz_policy():
    """Create CDA authorization policy."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post('/network-config/v1alpha1/cda-authz-policy', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating CDA authz policy: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/cda-authz-policy', methods=['PATCH'])
@require_session
def update_cda_authz_policy():
    """Update CDA authorization policy."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.patch('/network-config/v1alpha1/cda-authz-policy', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating CDA authz policy: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/cda-authz-policy', methods=['DELETE'])
@require_session
def delete_cda_authz_policy():
    """Delete CDA authorization policy."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        response = aruba_client.delete('/network-config/v1alpha1/cda-authz-policy')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting CDA authz policy: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/cda-airpass-approval', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/cda-airpass-approval', error_msg="Get Air Pass approval", fallback_data={})
def get_cda_airpass_approval(): pass

@app.route('/api/config/cda-identity-store', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/cda-identity-store', error_msg="Get CDA identity store", fallback_data={})
def get_cda_identity_store(): pass

@app.route('/api/config/cda-identity-store', methods=['POST'])
@require_session
def create_cda_identity_store():
    """Create CDA identity store."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post('/network-config/v1alpha1/cda-identity-store', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating CDA identity store: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/cda-identity-store', methods=['PATCH'])
@require_session
def update_cda_identity_store():
    """Update CDA identity store."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.patch('/network-config/v1alpha1/cda-identity-store', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating CDA identity store: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/cda-identity-store', methods=['DELETE'])
@require_session
def delete_cda_identity_store():
    """Delete CDA identity store."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        response = aruba_client.delete('/network-config/v1alpha1/cda-identity-store')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting CDA identity store: {e}")
        return jsonify({"error": str(e)}), 500

# CDA Portal Profile (with name parameter)
@app.route('/api/config/cda-portal-profile', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/cda-portal-profiles', error_msg="Get CDA portal profiles", fallback_data={"items": []})
def get_cda_portal_profiles(): pass

@app.route('/api/config/cda-portal-profile/<name>', methods=['GET'])
@require_session
@api_proxy(lambda name: f'/network-config/v1alpha1/cda-portal-profiles/{name}', error_msg="Get CDA portal profile", fallback_data={})
def get_cda_portal_profile(name): pass

@app.route('/api/config/cda-portal-profile/<name>', methods=['POST'])
@require_session
def create_cda_portal_profile(name):
    """Create CDA portal profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post(f'/network-config/v1alpha1/cda-portal-profiles/{name}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating CDA portal profile: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/cda-portal-profile/<name>', methods=['PATCH'])
@require_session
def update_cda_portal_profile(name):
    """Update CDA portal profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.patch(f'/network-config/v1alpha1/cda-portal-profiles/{name}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating CDA portal profile: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/cda-portal-profile/<name>', methods=['DELETE'])
@require_session
def delete_cda_portal_profile(name):
    """Delete CDA portal profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        response = aruba_client.delete(f'/network-config/v1alpha1/cda-portal-profiles/{name}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting CDA portal profile: {e}")
        return jsonify({"error": str(e)}), 500

# CDA Auth Profile
@app.route('/api/config/cda-auth-profile', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/cda-auth-profile', error_msg="Get CDA auth profile", fallback_data={})
def get_cda_auth_profile(): pass

@app.route('/api/config/cda-auth-profile', methods=['POST'])
@require_session
def create_cda_auth_profile():
    """Create CDA auth profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post('/network-config/v1alpha1/cda-auth-profile', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating CDA auth profile: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/cda-auth-profile', methods=['PATCH'])
@require_session
def update_cda_auth_profile():
    """Update CDA auth profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.patch('/network-config/v1alpha1/cda-auth-profile', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating CDA auth profile: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/cda-auth-profile', methods=['DELETE'])
@require_session
def delete_cda_auth_profile():
    """Delete CDA auth profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        response = aruba_client.delete('/network-config/v1alpha1/cda-auth-profile')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting CDA auth profile: {e}")
        return jsonify({"error": str(e)}), 500

# CDA Portal Skin Profile (with name parameter)
@app.route('/api/config/cda-portal-skin-profile/<name>', methods=['GET'])
@require_session
@api_proxy(lambda name: f'/network-config/v1alpha1/cda-portal-skin-profiles/{name}', error_msg="Get CDA portal skin profile", fallback_data={})
def get_cda_portal_skin_profile(name): pass

@app.route('/api/config/cda-portal-skin-profile/<name>', methods=['POST'])
@require_session
def create_cda_portal_skin_profile(name):
    """Create CDA portal skin profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post(f'/network-config/v1alpha1/cda-portal-skin-profiles/{name}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating CDA portal skin profile: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/cda-portal-skin-profile/<name>', methods=['PATCH'])
@require_session
def update_cda_portal_skin_profile(name):
    """Update CDA portal skin profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.patch(f'/network-config/v1alpha1/cda-portal-skin-profiles/{name}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating CDA portal skin profile: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/cda-portal-skin-profile/<name>', methods=['DELETE'])
@require_session
def delete_cda_portal_skin_profile(name):
    """Delete CDA portal skin profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        response = aruba_client.delete(f'/network-config/v1alpha1/cda-portal-skin-profiles/{name}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting CDA portal skin profile: {e}")
        return jsonify({"error": str(e)}), 500

# CDA Message Provider (with name parameter)
@app.route('/api/config/cda-message-provider/<name>', methods=['GET'])
@require_session
@api_proxy(lambda name: f'/network-config/v1alpha1/cda-message-providers/{name}', error_msg="Get CDA message provider", fallback_data={})
def get_cda_message_provider(name): pass

@app.route('/api/config/cda-message-provider/<name>', methods=['POST'])
@require_session
def create_cda_message_provider(name):
    """Create CDA message provider."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post(f'/network-config/v1alpha1/cda-message-providers/{name}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating CDA message provider: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/cda-message-provider/<name>', methods=['PATCH'])
@require_session
def update_cda_message_provider(name):
    """Update CDA message provider."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.patch(f'/network-config/v1alpha1/cda-message-providers/{name}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating CDA message provider: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/cda-message-provider/<name>', methods=['DELETE'])
@require_session
def delete_cda_message_provider(name):
    """Delete CDA message provider."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        response = aruba_client.delete(f'/network-config/v1alpha1/cda-message-providers/{name}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting CDA message provider: {e}")
        return jsonify({"error": str(e)}), 500

# CDA Portal Overrides Profile (with name parameter)
@app.route('/api/config/cda-portal-overrides-profile/<name>', methods=['GET'])
@require_session
@api_proxy(lambda name: f'/network-config/v1alpha1/cda-portal-overrides-profiles/{name}', error_msg="Get CDA portal overrides profile", fallback_data={})
def get_cda_portal_overrides_profile(name): pass

@app.route('/api/config/cda-portal-overrides-profile/<name>', methods=['POST'])
@require_session
def create_cda_portal_overrides_profile(name):
    """Create CDA portal overrides profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post(f'/network-config/v1alpha1/cda-portal-overrides-profiles/{name}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating CDA portal overrides profile: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/cda-portal-overrides-profile/<name>', methods=['PATCH'])
@require_session
def update_cda_portal_overrides_profile(name):
    """Update CDA portal overrides profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.patch(f'/network-config/v1alpha1/cda-portal-overrides-profiles/{name}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating CDA portal overrides profile: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/cda-portal-overrides-profile/<name>', methods=['DELETE'])
@require_session
def delete_cda_portal_overrides_profile(name):
    """Delete CDA portal overrides profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        response = aruba_client.delete(f'/network-config/v1alpha1/cda-portal-overrides-profiles/{name}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting CDA portal overrides profile: {e}")
        return jsonify({"error": str(e)}), 500

# ============= Central NAC Service APIs =============

@app.route('/api/config/nac/mac-registration', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/mac-registration', error_msg="Get MAC registrations", fallback_data={"items": [], "count": 0})
def get_mac_registrations(): pass

@app.route('/api/config/nac/mac-registration', methods=['POST'])
@require_session
def create_mac_registration():
    """Add MAC registration."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post('/network-config/v1alpha1/mac-registration', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating MAC registration: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/nac/mac-registration/<mac_id>', methods=['PUT'])
@require_session
def update_mac_registration(mac_id):
    """Update MAC registration."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.put(f'/network-config/v1alpha1/mac-registration/{mac_id}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating MAC registration: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/nac/mac-registration/<mac_id>', methods=['DELETE'])
@require_session
def delete_mac_registration(mac_id):
    """Delete MAC registration."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        response = aruba_client.delete(f'/network-config/v1alpha1/mac-registration/{mac_id}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting MAC registration: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/nac/mac-registration/export', methods=['GET'])
@require_session
def export_mac_registration():
    """Export MAC registrations as CSV."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        response = aruba_client.get('/network-config/v1alpha1/mac-registration/export')
        from flask import make_response
        resp = make_response(response.get('csv', ''))
        resp.headers['Content-Type'] = 'text/csv'
        resp.headers['Content-Disposition'] = 'attachment; filename=mac-registrations.csv'
        return resp
    except Exception as e:
        logger.error(f"Error exporting MAC registrations: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/nac/mac-registration/import', methods=['POST'])
@require_session
def import_mac_registration():
    """Import MAC registrations from CSV."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        file = request.files.get('file')
        if not file:
            return jsonify({"error": "No file provided"}), 400
        # TODO: Process CSV file and create registrations
        return jsonify({"message": "Import functionality in progress"})
    except Exception as e:
        logger.error(f"Error importing MAC registrations: {e}")
        return jsonify({"error": str(e)}), 500

# MPSK Registration endpoints (similar pattern)
@app.route('/api/config/nac/mpsk-registration', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/mpsk-registration', error_msg="Get MPSK registrations", fallback_data={"items": [], "count": 0})
def get_mpsk_registrations(): pass

@app.route('/api/config/nac/visitor', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/visitor', error_msg="Get visitors", fallback_data={"items": [], "count": 0})
def get_visitors(): pass

@app.route('/api/config/nac/job', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/job', error_msg="Get jobs", fallback_data={"items": [], "count": 0})
def get_jobs(): pass

@app.route('/api/config/nac/image', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/image', error_msg="Get images", fallback_data={"items": [], "count": 0})
def get_images(): pass

@app.route('/api/config/nac/user-certificate', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/user-certificate', error_msg="Get user certificates", fallback_data={"items": [], "count": 0})
def get_user_certificates(): pass

# ============= Config Management APIs =============

@app.route('/api/config/checkpoint', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/config-checkpoint', error_msg="Get checkpoints", fallback_data={"items": [], "count": 0})
def get_checkpoints(): pass

@app.route('/api/config/checkpoint', methods=['POST'])
@require_session
def create_checkpoint():
    """Create configuration checkpoint."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post('/network-config/v1alpha1/config-checkpoint', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating checkpoint: {e}")
        return jsonify({"error": str(e)}), 500

# ============= Configuration Health APIs =============

@app.route('/api/config/health/device', methods=['GET'])
@require_session
def get_config_health_device():
    """Get active configuration issues for a device."""
    try:
        device_id = request.args.get('device_id')
        if not device_id:
            return jsonify({"error": "device_id query parameter is required"}), 400
        response = aruba_client.get(f'/network-config/v1alpha1/configuration-health/{device_id}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error getting device config health: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/health/summary', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/configuration-health', error_msg="Get config health summary", fallback_data={})
def get_config_health_summary(): pass

@app.route('/api/config/health/active-issue', methods=['GET'])
@require_session
def get_config_health_active_issue():
    """Get active configuration issues for a device by serial number."""
    try:
        serial = request.args.get('serial')
        if not serial:
            return jsonify({"error": "serial query parameter is required"}), 400
        response = aruba_client.get('/network-config/v1alpha1/config-health/active-issue', params={'serial': serial})
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error getting device config health active issues: {e}")
        return jsonify({"error": str(e)}), 500

# ============= Extensions APIs =============

@app.route('/api/config/extension/vsphere-instances', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/extension-vsphere-instances', error_msg="Get vSphere instances", fallback_data={"items": [], "count": 0})
def get_vsphere_instances(): pass

@app.route('/api/config/extension/vsphere-instance/<name>', methods=['GET'])
@require_session
@api_proxy(lambda name: f'/network-config/v1alpha1/extension-vsphere-instance/{name}', error_msg="Get vSphere instance", fallback_data={})
def get_vsphere_instance(name): pass

# ============= High Availability APIs =============

@app.route('/api/config/stack', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/switch-stack', error_msg="Get stacks", fallback_data={"items": [], "count": 0})
def get_stacks(): pass

@app.route('/api/config/vsx/<name>', methods=['GET'])
@require_session
@api_proxy(lambda name: f'/network-config/v1alpha1/vsx/{name}', error_msg="Get VSX profile", fallback_data={})
def get_vsx(name): pass

# ============= Interface APIs =============

@app.route('/api/config/device-profile', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/device-profile', error_msg="Get device profiles", fallback_data={"items": [], "count": 0})
def get_device_profiles(): pass

@app.route('/api/config/device-profile', methods=['POST'])
@require_session
def create_device_profile():
    """Create a new device profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        response = aruba_client.post('/network-config/v1alpha1/device-profile', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating device profile: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/device-profile/<name>', methods=['GET'])
@require_session
@api_proxy(lambda name: f'/network-config/v1alpha1/device-profile/{name}', error_msg="Get device profile", fallback_data={})
def get_device_profile(name): pass

@app.route('/api/config/device-profile/<name>', methods=['PATCH'])
@require_session
def update_device_profile(name):
    """Update an existing device profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        response = aruba_client.patch(f'/network-config/v1alpha1/device-profile/{name}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating device profile: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/device-profile/<name>', methods=['DELETE'])
@require_session
def delete_device_profile(name):
    """Delete a device profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        response = aruba_client.delete(f'/network-config/v1alpha1/device-profile/{name}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting device profile: {e}")
        return jsonify({"error": str(e)}), 500

# ============= Interface Security APIs =============

@app.route('/api/config/mac-lockout/<name>', methods=['GET'])
@require_session
@api_proxy(lambda name: f'/network-config/v1alpha1/mac-lockout/{name}', error_msg="Get MAC lockout profile", fallback_data={})
def get_mac_lockout(name): pass

@app.route('/api/config/macsec', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/macsec', error_msg="Get MACsec configuration", fallback_data={})
def get_macsec(): pass

# ============= Interfaces APIs =============

@app.route('/api/config/interface/loopback', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/interface-loopback', error_msg="Get loopback interfaces", fallback_data={"items": [], "count": 0})
def get_loopback_interfaces(): pass

@app.route('/api/config/interface/management', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/interface-management', error_msg="Get management interfaces", fallback_data={"items": [], "count": 0})
def get_management_interfaces(): pass

@app.route('/api/config/wlan', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/wlan', error_msg="Get WLANs", fallback_data={"items": [], "count": 0})
def get_config_wlans(): pass

@app.route('/api/config/wlan/<name>', methods=['GET'])
@require_session
@api_proxy(lambda name: f'/network-config/v1alpha1/wlan/{name}', error_msg="Get WLAN profile", fallback_data={})
def get_config_wlan(name): pass

@app.route('/api/config/wlan/<name>', methods=['POST'])
@require_session
def create_config_wlan(name):
    """Create WLAN profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.post(f'/network-config/v1alpha1/wlan/{name}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error creating WLAN: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/wlan/<name>', methods=['PATCH'])
@require_session
def update_config_wlan(name):
    """Update WLAN profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        data = request.get_json()
        response = aruba_client.patch(f'/network-config/v1alpha1/wlan/{name}', data=data)
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error updating WLAN: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/wlan/<name>', methods=['DELETE'])
@require_session
def delete_config_wlan(name):
    """Delete WLAN profile."""
    try:
        if not aruba_client:
            return jsonify({"error": "Server not configured"}), 500
        response = aruba_client.delete(f'/network-config/v1alpha1/wlan/{name}')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error deleting WLAN: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/radio/<name>', methods=['GET'])
@require_session
@api_proxy(lambda name: f'/network-config/v1alpha1/radio/{name}', error_msg="Get radio profile", fallback_data={})
def get_radio(name): pass

@app.route('/api/config/vlan', methods=['GET'])
@require_session
@api_proxy('/network-config/v1alpha1/vlan', error_msg="Get VLANs", fallback_data={"items": [], "count": 0})
def get_config_vlans(): pass

@app.route('/api/config/vlan/<vlan_id>', methods=['GET'])
@require_session
@api_proxy(lambda vlan_id: f'/network-config/v1alpha1/vlan/{vlan_id}', error_msg="Get VLAN", fallback_data={})
def get_config_vlan(vlan_id): pass

# ============= Switch Configuration Profiles =============

@app.route('/api/config/switch/<serial>/profile', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-config/v1alpha1/cx/{serial}/profile', error_msg="Get switch profile", fallback_data={})
def get_switch_profile(serial): pass

@app.route('/api/config/switch/<serial>/miscellaneous', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-config/v1alpha1/cx/{serial}/miscellaneous', error_msg="Get switch miscellaneous", fallback_data={})
def get_switch_miscellaneous(serial): pass

@app.route('/api/config/switch/<serial>/named-objects', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-config/v1alpha1/cx/{serial}/named-objects', error_msg="Get switch named objects", fallback_data={})
def get_switch_named_objects(serial): pass

@app.route('/api/config/switch/<serial>/network-services', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-config/v1alpha1/cx/{serial}/network-services', error_msg="Get switch network services", fallback_data={})
def get_switch_network_services(serial): pass

@app.route('/api/config/switch/<serial>/roles-policies', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-config/v1alpha1/cx/{serial}/roles-policies', error_msg="Get switch roles policies", fallback_data={})
def get_switch_roles_policies(serial): pass

@app.route('/api/config/switch/<serial>/routing-overlay', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-config/v1alpha1/cx/{serial}/routing-overlay', error_msg="Get switch routing overlay", fallback_data={})
def get_switch_routing_overlay(serial): pass

@app.route('/api/config/switch/<serial>/security', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-config/v1alpha1/cx/{serial}/security', error_msg="Get switch security", fallback_data={})
def get_switch_security(serial): pass

@app.route('/api/config/switch/<serial>/services', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-config/v1alpha1/cx/{serial}/services', error_msg="Get switch services", fallback_data={})
def get_switch_services(serial): pass

@app.route('/api/config/switch/<serial>/system', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-config/v1alpha1/cx/{serial}/system', error_msg="Get switch system", fallback_data={})
def get_switch_system_config(serial): pass

@app.route('/api/config/switch/<serial>/telemetry', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-config/v1alpha1/cx/{serial}/telemetry', error_msg="Get switch telemetry", fallback_data={})
def get_switch_telemetry(serial): pass

@app.route('/api/config/switch/<serial>/tunnels', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-config/v1alpha1/cx/{serial}/tunnels', error_msg="Get switch tunnels", fallback_data={})
def get_switch_tunnels(serial): pass

@app.route('/api/config/switch/<serial>/vlans-networks', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-config/v1alpha1/cx/{serial}/vlans-networks', error_msg="Get switch VLANs networks", fallback_data={})
def get_switch_vlans_networks(serial): pass

# ============= Wireless Configuration Profiles =============

@app.route('/api/config/wireless/<serial>/profile', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-config/v1alpha1/aps/{serial}/profile', error_msg="Get wireless profile", fallback_data={})
def get_wireless_profile(serial): pass

@app.route('/api/config/wireless/<serial>/radios', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-config/v1alpha1/aps/{serial}/radios', error_msg="Get wireless radios", fallback_data={})
def get_wireless_radios(serial): pass

@app.route('/api/config/wireless/<serial>/wlans', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-config/v1alpha1/aps/{serial}/wlans', error_msg="Get wireless WLANs", fallback_data={})
def get_wireless_wlans(serial): pass

@app.route('/api/config/wireless/<serial>/system', methods=['GET'])
@require_session
@api_proxy(lambda serial: f'/network-config/v1alpha1/aps/{serial}/system', error_msg="Get wireless system", fallback_data={})
def get_wireless_system(serial): pass

# ============= Main =============

if __name__ == '__main__':
    # Run Flask app
    app.run(host='0.0.0.0', port=1344, debug=True)
