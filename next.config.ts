import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The collector drives a real browser and must never be bundled into the app.
  serverExternalPackages: ['playwright'],
};

export default nextConfig;
