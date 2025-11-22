/**
 * API Endpoint Configuration
 * 
 * Regional API endpoints for Aruba Central.
 * Can be overridden via environment variables:
 * - VITE_ARUBA_API_BASE_URL: Override default base URL
 * - VITE_ARUBA_API_REGIONS: JSON string of custom regions array
 */

// Default base URL (can be overridden by VITE_ARUBA_API_BASE_URL)
export const DEFAULT_API_BASE_URL = import.meta.env.VITE_ARUBA_API_BASE_URL || 
  'https://internal.api.central.arubanetworks.com';

// Regional endpoints configuration
export const API_REGIONS = (() => {
  // Allow override via environment variable
  if (import.meta.env.VITE_ARUBA_API_REGIONS) {
    try {
      return JSON.parse(import.meta.env.VITE_ARUBA_API_REGIONS);
    } catch (e) {
      console.warn('Invalid VITE_ARUBA_API_REGIONS, using defaults');
    }
  }
  
  // Default regional endpoints
  return [
    {
      name: 'Internal',
      url: 'https://internal.api.central.arubanetworks.com',
      description: 'Cluster: internal'
    },
    {
      name: 'EU-1 (eu)',
      url: 'https://de1.api.central.arubanetworks.com',
      description: 'Cluster: eu'
    },
    {
      name: 'EU-Central2 (eucentral2)',
      url: 'https://de2.api.central.arubanetworks.com',
      description: 'Cluster: eucentral2'
    },
    {
      name: 'EU-Central3 (eucentral3)',
      url: 'https://de3.api.central.arubanetworks.com',
      description: 'Cluster: eucentral3'
    },
    {
      name: 'US-1 (prod)',
      url: 'https://us1.api.central.arubanetworks.com',
      description: 'Cluster: prod'
    },
    {
      name: 'US-2 (central-prod2)',
      url: 'https://us2.api.central.arubanetworks.com',
      description: 'Cluster: central-prod2'
    },
    {
      name: 'US-WEST-4 (uswest4)',
      url: 'https://us4.api.central.arubanetworks.com',
      description: 'Cluster: uswest4'
    },
    {
      name: 'US-WEST-5 (uswest5)',
      url: 'https://us5.api.central.arubanetworks.com',
      description: 'Cluster: uswest5'
    },
    {
      name: 'US-East1 (us-east-1)',
      url: 'https://us6.api.central.arubanetworks.com',
      description: 'Cluster: us-east-1'
    },
    {
      name: 'Canada-1 (starman)',
      url: 'https://ca1.api.central.arubanetworks.com',
      description: 'Cluster: starman'
    },
    {
      name: 'APAC-1 (apac)',
      url: 'https://in.api.central.arubanetworks.com',
      description: 'Cluster: apac'
    },
    {
      name: 'APAC-EAST1 (apaceast)',
      url: 'https://jp1.api.central.arubanetworks.com',
      description: 'Cluster: apaceast'
    },
    {
      name: 'APAC-SOUTH1 (apacsouth)',
      url: 'https://au1.api.central.arubanetworks.com',
      description: 'Cluster: apacsouth'
    },
  ];
})();

// GreenLake API base URL
export const GREENLAKE_API_BASE_URL = import.meta.env.VITE_GL_API_BASE_URL || 
  'https://global.api.greenlake.hpe.com';

