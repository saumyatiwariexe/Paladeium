/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Allow the AR Lens (localhost:3001) to call the menu API
        source: '/api/restaurants/:slug/menu',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ]
  },
}

export default nextConfig
