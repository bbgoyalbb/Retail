// craco.config.js
const path = require("path");
require("dotenv").config();

// Check if we're in development/preview mode (not production build)
// Craco sets NODE_ENV=development for start, NODE_ENV=production for build
const isDevServer = process.env.NODE_ENV !== "production";

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

let webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {

      // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
        ],
      };

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }

      // Suppress source map warnings for html5-qrcode (source files not included in package)
      webpackConfig.module.rules.forEach(rule => {
        if (rule.use) {
          const usesSourceMapLoader = Array.isArray(rule.use)
            ? rule.use.some(u => (u.loader && u.loader.includes('source-map-loader')) || u === 'source-map-loader')
            : (rule.use.loader && rule.use.loader.includes('source-map-loader')) || rule.use === 'source-map-loader';
          
          if (usesSourceMapLoader) {
            // Exclude html5-qrcode and its dependencies from source map processing
            const currentExclude = rule.exclude || [];
            rule.exclude = Array.isArray(currentExclude)
              ? [...currentExclude, /node_modules[/\\]html5-qrcode/, /node_modules[/\\]@zxing/]
              : [currentExclude, /node_modules[/\\]html5-qrcode/, /node_modules[/\\]@zxing/];
          }
        }
      });

      // Suppress html5-qrcode source map warnings at the webpack warning level too
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        /Failed to parse source map.*html5-qrcode/,
        /Failed to parse source map.*node_modules[/\\]src[/\\]/,
      ];

      // Split heavy vendor libs into separate named chunks for better long-term caching.
      // App code changes won't bust vendor chunks, and each chunk is fetched only once.
      webpackConfig.optimization = {
        ...webpackConfig.optimization,
        splitChunks: {
          ...webpackConfig.optimization?.splitChunks,
          cacheGroups: {
            ...webpackConfig.optimization?.splitChunks?.cacheGroups,
            recharts: {
              test: /[\\/]node_modules[\\/](recharts|d3-[^/]+|victory-vendor)[\\/]/,
              name: "vendor-recharts",
              chunks: "all",
              priority: 30,
            },
            radix: {
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              name: "vendor-radix",
              chunks: "all",
              priority: 25,
            },
            phosphor: {
              test: /[\\/]node_modules[\\/]@phosphor-icons[\\/]/,
              name: "vendor-phosphor",
              chunks: "all",
              priority: 20,
            },
            dateFns: {
              test: /[\\/]node_modules[\\/](date-fns|react-day-picker)[\\/]/,
              name: "vendor-dates",
              chunks: "all",
              priority: 15,
            },
          },
        },
      };

      return webpackConfig;
    },
    devServer: (devServerConfig) => {
  // Disable the red runtime error overlay — benign errors (e.g. play() interrupted
  // from Html5Qrcode camera init) would otherwise block the UI in development.
  devServerConfig.client = {
    ...devServerConfig.client,
    overlay: false,
  };
  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
      };
    }

    return devServerConfig;
    },
  },
};

// Wrap with visual edits (automatically adds babel plugin, dev server, and overlay in dev mode)
if (isDevServer) {
  try {
    const { withVisualEdits } = require("@emergentbase/visual-edits/craco");
    module.exports = withVisualEdits(webpackConfig);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && err.message.includes('@emergentbase/visual-edits/craco')) {
      console.warn(
        "[visual-edits] @emergentbase/visual-edits not installed — visual editing disabled."
      );
      module.exports = webpackConfig;
    } else {
      throw err;
    }
  }
} else {
  module.exports = webpackConfig;
}
