import type { NextConfig } from "next";

// Runs when `next build` loads this file — confirms which API URL is inlined into the client bundle.
const apiUrlForBuild = process.env.NEXT_PUBLIC_API_URL?.trim();
if (apiUrlForBuild) {
  console.log(
    "[build] NEXT_PUBLIC_API_URL (API requests will use this):",
    apiUrlForBuild.replace(/\/+$/, "")
  );
} else {
  console.warn(
    "[build] NEXT_PUBLIC_API_URL is not set. Production will fall back to same host :5000 (usually wrong on Render); set it in your host’s env and rebuild."
  );
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
