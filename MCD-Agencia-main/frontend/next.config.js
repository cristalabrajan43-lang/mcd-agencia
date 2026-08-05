/**
 * Next.js Configuration for MCD-Agencia
 *
 * This configuration file sets up:
 * - Internationalization (ES/EN)
 * - Image optimization
 * - API rewrites
 * - Security headers
 *
 * @see https://nextjs.org/docs/api-reference/next.config.js/introduction
 */

const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ==========================================================================
  // React Configuration
  // ==========================================================================
  reactStrictMode: true,

  // ==========================================================================
  // Image Optimization
  // ==========================================================================
  images: {
    // Allow images from external domains
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
      },
      {
        protocol: 'https',
        hostname: 'agenciamcd.mx',
      },
      {
        protocol: 'https',
        hostname: '*.onrender.com',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.digitaloceanspaces.com',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
    // Supported image formats (WebP only — AVIF removed for broader compatibility)
    formats: ['image/webp'],
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Image sizes for next/image
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // ==========================================================================
  // API Rewrites (Proxy to Backend)
  // ==========================================================================
  async rewrites() {
    const apiUrl =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:8000/api/v1';

    const backendOrigin = (() => {
      try {
        return new URL(apiUrl).origin;
      } catch {
        return 'http://localhost:8000';
      }
    })();

    return {
      // Use fallback rewrites so they are checked AFTER dynamic routes.
      // Order: headers → redirects → beforeFiles → static files →
      //        afterFiles → dynamic routes → fallback
      // This ensures local Next.js API route handlers (e.g. /api/postal-code,
      // /api/geocode, /api/routing, /api/leads) are matched first as dynamic
      // routes, and only unmatched /api/* requests are proxied to Django.
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: '/api/v1/:path*',
          destination: `${apiUrl}/:path*`,
        },
        {
          source: '/media/:path*',
          destination: `${backendOrigin}/media/:path*`,
        },
      ],
    };
  },

  // ==========================================================================
  // Security Headers
  // ==========================================================================
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
          {
            key: 'Content-Security-Policy',
            value: (() => {
              // Extract just the origin (scheme + host) from the API URL for CSP
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
              let apiOrigin;
              try {
                apiOrigin = new URL(apiUrl).origin;
              } catch {
                apiOrigin = apiUrl;
              }
              return [
                "default-src 'self'",
                `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV !== 'production' ? "'unsafe-eval'" : ''} https://www.google.com https://www.gstatic.com https://www.googletagmanager.com https://*.clarity.ms https://connect.facebook.net`,
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com",
                `img-src 'self' data: blob: https: ${apiOrigin}`,
                `connect-src 'self' ${apiOrigin} https://www.google-analytics.com https://www.clarity.ms https://*.clarity.ms https://connect.facebook.net https://nominatim.openstreetmap.org https://router.project-osrm.org`,
                "frame-src 'self' https://www.google.com https://maps.google.com https://www.youtube-nocookie.com https://www.youtube.com",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "frame-ancestors 'none'",
                process.env.NODE_ENV === 'production' ? "upgrade-insecure-requests" : "",
              ].filter(Boolean).join('; ');
            })(),
          },
        ],
      },
    ];
  },

  // ==========================================================================
  // Experimental Features
  // ==========================================================================
  experimental: {
    // Server actions are available by default - no need to configure
  },

  // ==========================================================================
  // Webpack Configuration
  // ==========================================================================
  webpack: (config, { isServer }) => {
    // Add custom webpack configurations here if needed
    return config;
  },

  // ==========================================================================
  // Environment Variables
  // ==========================================================================
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  },

  // ==========================================================================
  // Output Configuration
  // ==========================================================================
  output: 'standalone',

  // ==========================================================================
  // Powered By Header
  // ==========================================================================
  poweredByHeader: false,
};

module.exports = withNextIntl(nextConfig);
