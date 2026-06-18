import axios from "axios";

/**
 * Extract clean error message from API response
 */
export function handleApiError(error: any) {
  const message =
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    "Unexpected error occurred";

  throw new Error(message); // ✔ KEEP REAL MESSAGE
}

/**
 * Wrapper to handle async API calls with centralized error handling
 */
export const withErrorHandling = async <T>(
  fn: () => Promise<T>
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    throw handleApiError(error);
  }
};