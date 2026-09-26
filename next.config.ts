import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so a stray lockfile higher up the tree isn't picked up.
  turbopack: { root: path.join(__dirname) },
  // The dev badge sits on top of the galaxy legend; build errors still show in the overlay.
  devIndicators: false,
};

export default nextConfig;
