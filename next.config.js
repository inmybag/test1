/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.oliveyoung.co.kr',
      },
      {
        protocol: 'http',
        hostname: 'image.oliveyoung.co.kr',
      },
    ],
  },
}

module.exports = nextConfig
