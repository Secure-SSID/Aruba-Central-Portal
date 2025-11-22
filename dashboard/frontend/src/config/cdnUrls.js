/**
 * CDN URL Configuration
 * 
 * External resource URLs for device images and logos.
 * Can be overridden via environment variables:
 * - VITE_DEVICE_IMAGE_CDN_BASE: Base URL for device images
 * - VITE_HPE_LOGO_URL: URL for HPE logo
 */

// Device image CDN base URL (can be overridden by VITE_DEVICE_IMAGE_CDN_BASE)
export const DEVICE_IMAGE_CDN_BASE = import.meta.env.VITE_DEVICE_IMAGE_CDN_BASE || 
  'https://diz7hgluhzsxv.cloudfront.net';

// HPE Logo URL (can be overridden by VITE_HPE_LOGO_URL)
export const HPE_LOGO_URL = import.meta.env.VITE_HPE_LOGO_URL || 
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Hewlett_Packard_Enterprise_logo.svg/530px-Hewlett_Packard_Enterprise_logo.svg.png';

// CDN URL patterns for device images
export const CDN_PATTERNS = {
  // Special case for Q9H73A
  Q9H73A_SPECIFIC: `${DEVICE_IMAGE_CDN_BASE}/ui-base/v33191/assets/ui-components/static/media/Q9H73A.e0f32991.png`,
  
  // 2025 UDL patterns
  UDL_2025_V3132: [
    `${DEVICE_IMAGE_CDN_BASE}/2025/udl/v3132/static/media/{partNumber}.3e5127c7.png`,
    `${DEVICE_IMAGE_CDN_BASE}/2025/udl/v3132/static/media/{partNumber}.10a25695.png`,
    `${DEVICE_IMAGE_CDN_BASE}/2025/udl/v3132/static/media/{partNumber}.d8474883.png`,
    `${DEVICE_IMAGE_CDN_BASE}/2025/udl/v3132/static/media/{partNumber}.a0310c52.png`,
    `${DEVICE_IMAGE_CDN_BASE}/2025/udl/v3132/static/media/{partNumber}.png`,
  ],
  
  // UI Base patterns
  UI_BASE_V33191: [
    `${DEVICE_IMAGE_CDN_BASE}/ui-base/v33191/assets/ui-components/static/media/{partNumber}.e0f32991.png`,
    `${DEVICE_IMAGE_CDN_BASE}/ui-base/v33191/assets/ui-components/static/media/{partNumber}.a0310c52.png`,
    `${DEVICE_IMAGE_CDN_BASE}/ui-base/v33191/assets/ui-components/static/media/{partNumber}-crop.e6178d42.png`,
  ],
};

// Helper function to generate CDN URLs for a part number
export const getCdnUrlsForPartNumber = (partNumber) => {
  const urls = [];
  
  // Add 2025 UDL patterns
  CDN_PATTERNS.UDL_2025_V3132.forEach(pattern => {
    urls.push(pattern.replace('{partNumber}', partNumber));
  });
  
  // Add UI Base patterns
  CDN_PATTERNS.UI_BASE_V33191.forEach(pattern => {
    urls.push(pattern.replace('{partNumber}', partNumber));
  });
  
  return urls;
};

