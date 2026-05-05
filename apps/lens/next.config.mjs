/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three'],

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection',       value: '1; mode=block' },
          // AR requires camera. geolocation and microphone are not used.
          { key: 'Permissions-Policy',     value: 'camera=self, microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
