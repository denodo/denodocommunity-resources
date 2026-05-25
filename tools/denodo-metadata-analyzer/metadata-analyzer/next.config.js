/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static export for Python server deployment
  output: 'export',

  // Disable static optimization to prevent memory issues during build
  experimental: {
    workerThreads: false,
    cpus: 1
  },

  images: { unoptimized: true },
  trailingSlash: true,
  eslint: {
    // Skip linting during builds to reduce memory usage
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Temporarily skip type checking to avoid memory issues
    ignoreBuildErrors: true,
  },
  // Note: COOP/COEP headers for DuckDB WASM will be set by Python server
  webpack: (config, { isServer }) => {
    // Reduce memory usage
    config.optimization = {
      ...config.optimization,
      minimize: process.env.NODE_ENV === 'production',
      moduleIds: 'deterministic',
    };

    // Disable filesystem cache compression to prevent memory issues
    config.cache = false;

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };

      // DuckDB WASM specific configurations
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
        syncWebAssembly: true,
      };

      // Handle .wasm files
      config.module.rules.push({
        test: /\.wasm$/,
        type: 'webassembly/async',
      });

      // Exclude large VQL files from bundling
      config.module.rules.push({
        test: /\.(vql|VQL)$/,
        type: 'asset/resource',
      });
    }

    return config;
  },
};

export default nextConfig;