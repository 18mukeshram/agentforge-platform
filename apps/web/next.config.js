// apps/web/next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker
  output: "standalone",

  // Strict mode for better development
  reactStrictMode: true,

  // Disable x-powered-by header
  poweredByHeader: false,

  // Environment variables available to the browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },

  // Image optimization (if using next/image)
  images: {
    unoptimized: true, // For static export compatibility
  },
};

module.exports = nextConfig;
