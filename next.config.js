/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Empty turbopack config to silence warnings
  // Turbopack handles WASM files natively in Next.js 16
  turbopack: {},

  // Externalize tiktoken to avoid bundling issues with WASM
  // This prevents Next.js from trying to bundle tiktoken and its WASM files
  // allowing it to be loaded directly from node_modules at runtime
  serverExternalPackages: ["tiktoken"],

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    // Handle tiktoken WASM files for webpack builds
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Ensure WASM files are treated as assets
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });

    return config;
  },
};

export default config;
