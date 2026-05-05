/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const lensOrigin = process.env.LENS_URL ?? '*'

    return [
      // ── Public AR Lens endpoints ─────────────────────────────────────────
      {
        source: '/api/restaurants/:slug/menu',
        headers: [
          { key: 'Access-Control-Allow-Origin',  value: lensOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
          { key: 'Cache-Control',                value: 'public, s-maxage=60, stale-while-revalidate=300' },
        ],
      },
      {
        source: '/api/restaurants/:slug/models/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin',  value: lensOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
          { key: 'Cache-Control',                value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Order placement (POST from lens) + status polling (GET from lens)
        source: '/api/restaurants/:slug/orders/:orderId*',
        headers: [
          { key: 'Access-Control-Allow-Origin',  value: lensOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },

      // ── Security headers for all routes ─────────────────────────────────
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection',          value: '1; mode=block' },
          // Dashboard never uses camera/mic/geo — explicitly block them
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
