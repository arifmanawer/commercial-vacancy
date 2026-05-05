import type { NextConfig } from "next";
import path from "path";

// Runs when `next build` loads this file — confirms which API URL is inlined into the client bundle.
const apiUrlForBuild = process.env.NEXT_PUBLIC_API_URL?.trim();
if (apiUrlForBuild) {
  console.log(
    "[build] NEXT_PUBLIC_API_URL (API requests will use this):",
    apiUrlForBuild.replace(/\/+$/, "")
  );
} else {
  console.warn(
    "[build] NEXT_PUBLIC_API_URL is not set. Client requests will use relative `/api/...` (requires a proxy/rewrite). Set it in your host’s env and rebuild."
  );
}

const nextConfig: NextConfig = {
  // Prevent monorepo/multi-lockfile root mis-detection in CI (e.g. Vercel).
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
