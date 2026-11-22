import type { NextConfig } from "next";

// Turbopack's native bindings aren't available on this machine
// (win32/arm64, blocked by an Application Control policy), so this project
// runs on webpack instead (`next dev --webpack` / `next build --webpack`).
// Tailwind runs through the standard @tailwindcss/postcss plugin
// (postcss.config.mjs) rather than the turbopack-only loader. Plain
// defaults otherwise — the experimental cacheComponents/partialPrefetching
// flags added friction (Suspense-boundary requirements, a route-config
// conflict) with no benefit for this project's scope.
const nextConfig: NextConfig = {};

export default nextConfig;
