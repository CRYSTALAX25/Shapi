import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      // Page renamed to Course Wallet — keep old links/bookmarks working.
      // Query params (e.g. ?skill=) are forwarded automatically.
      { source: '/upskill', destination: '/course-wallet', permanent: true },
    ]
  },
};

export default nextConfig;
