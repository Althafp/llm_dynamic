import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Turbopack temporarily to avoid cache issues
  // You can remove this if Turbopack works fine
  
// External packages required at runtime on the server
serverExternalPackages: ['@google-cloud/storage'],
  
  // Output configuration (if needed for static export)
  // output: 'standalone', // Uncomment for Docker deployment
};

export default nextConfig;
