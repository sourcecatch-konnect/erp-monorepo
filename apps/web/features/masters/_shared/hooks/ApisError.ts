import axios from "axios";

/**
 * Extract clean error message from API response
 */
export const handleApiError = (error: unknown): Error => {
  if (axios.isAxiosError(error)) {
    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.response?.data?.details ||
      error.message ||
      "Something went wrong";

    return new Error(message);
  }

  return new Error("Unexpected error occurred");
};

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