/**
 * Error Utilities
 * Functions to extract and format error messages from API responses
 */

/**
 * Extract a user-friendly error message from an axios error
 * @param {Error} error - The error object from axios
 * @param {string} defaultMessage - Default message if error cannot be extracted
 * @returns {string} - User-friendly error message
 */
export const getErrorMessage = (error, defaultMessage = 'An error occurred') => {
  // If it's not an axios error, return the message or default
  if (!error || !error.response) {
    return error?.message || defaultMessage;
  }

  const { response } = error;
  const { data, status } = response;

  // Try to extract error message from response data
  if (data) {
    // If data is a string, use it directly
    if (typeof data === 'string') {
      return data;
    }

    // If data has an error property
    if (data.error) {
      // If error is a string, use it
      if (typeof data.error === 'string') {
        return data.error;
      }
      // If error is an object, try to extract message
      if (typeof data.error === 'object' && data.error.message) {
        return data.error.message;
      }
    }

    // If data has a message property
    if (data.message) {
      return data.message;
    }

    // If data has a detail property (common in some APIs)
    if (data.detail) {
      return data.detail;
    }

    // If data is an object with useful information, stringify it
    if (typeof data === 'object' && Object.keys(data).length > 0) {
      // Try to find a meaningful message
      const possibleKeys = ['error_message', 'errorMessage', 'msg', 'description', 'reason'];
      for (const key of possibleKeys) {
        if (data[key]) {
          return String(data[key]);
        }
      }
    }
  }

  // Fallback to status-based messages
  switch (status) {
    case 400:
      return 'Bad Request: Invalid parameters or data provided';
    case 401:
      return 'Unauthorized: Please log in again';
    case 403:
      return 'Forbidden: You do not have permission to perform this action';
    case 404:
      return 'Not Found: The requested resource was not found';
    case 500:
      return 'Server Error: An internal server error occurred';
    case 502:
      return 'Bad Gateway: The server is temporarily unavailable';
    case 503:
      return 'Service Unavailable: The service is temporarily unavailable';
    default:
      return error.message || defaultMessage;
  }
};

/**
 * Extract detailed error information for debugging
 * @param {Error} error - The error object from axios
 * @returns {Object} - Detailed error information
 */
export const getErrorDetails = (error) => {
  if (!error) {
    return { message: 'Unknown error', status: null, data: null };
  }

  const details = {
    message: error.message || 'Unknown error',
    status: error.response?.status || null,
    data: error.response?.data || null,
    url: error.config?.url || null,
    method: error.config?.method || null,
  };

  return details;
};

/**
 * Check if an error is a network error (no response)
 * @param {Error} error - The error object
 * @returns {boolean} - True if it's a network error
 */
export const isNetworkError = (error) => {
  return error && !error.response && error.message && (
    error.message.includes('Network Error') ||
    error.message.includes('timeout') ||
    error.message.includes('ECONNREFUSED')
  );
};

/**
 * Check if an error is a client error (4xx)
 * @param {Error} error - The error object
 * @returns {boolean} - True if it's a 4xx error
 */
export const isClientError = (error) => {
  const status = error?.response?.status;
  return status >= 400 && status < 500;
};

/**
 * Check if an error is a server error (5xx)
 * @param {Error} error - The error object
 * @returns {boolean} - True if it's a 5xx error
 */
export const isServerError = (error) => {
  const status = error?.response?.status;
  return status >= 500 && status < 600;
};

