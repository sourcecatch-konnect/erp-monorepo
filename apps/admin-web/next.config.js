/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@skerp/types", "@skerp/validators", "@skerp/ui"],
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "*.local",
    "huey-loveliest-jannie.ngrok-free.dev",
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ],
  // Proxy all /api/* calls to the local Express server. Lets us tunnel
  // only the frontend through ngrok — the browser sees same-origin requests,
  // so no CORS and cookies work without SameSite=None.
  async rewrites() {
    const apiTarget = process.env.API_PROXY_TARGET || "http://localhost:5000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
