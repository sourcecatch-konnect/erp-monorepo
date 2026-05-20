/**
 * Central route path constants. Use these instead of hardcoding paths so
 * redirects and links stay consistent across the app.
 */
export const ROUTES = {
  login: "/login",
  signup: "/signup",
  dashboard: "/dashboard",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
