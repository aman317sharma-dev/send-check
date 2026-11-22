import type { NextConfig } from "next";

// Turbopack's native bindings aren't available on this machine
// (win32/arm64, blocked by an Application Control policy), so this project
// runs on webpack instead (`next dev --webpack` / `next build --webpack`).
// Tailwind runs through the standard @tailwindcss/postcss plugin
// (postcss.config.mjs) rather than the turbopack-only loader.
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
