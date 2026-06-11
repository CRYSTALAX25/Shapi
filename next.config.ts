import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 removed the built-in ESLint integration — the old
  // `eslint: { ignoreDuringBuilds: true }` key is no longer a valid option
  // and only produced "Invalid next.config.ts options" warnings on startup.
  typescript: { ignoreBuildErrors: true },
  async redirects() {
    return [
      // Page renamed to Course Wallet — keep old links/bookmarks working.
      // Query params (e.g. ?skill=) are forwarded automatically.
      { source: '/upskill', destination: '/course-wallet', permanent: true },
    ]
  },
};

export default nextConfig;
