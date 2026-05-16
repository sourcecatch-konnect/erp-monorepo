import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
  withCredentials: true,
});
api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // access token expired
    if (
      error.response?.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        // use refreshToken cookie
        await api.post("/auth/refresh");

        // retry previous request
        return api(originalRequest);

      } catch (refreshError) {
        // refresh token also expired
        window.location.href = "/login";

        return Promise.reject(
          refreshError
        );
      }
    }

    const message =
      error?.response?.data?.message ||
      error?.message ||
      "Something went wrong";

    return Promise.reject(
      new Error(message)
    );
  }
);