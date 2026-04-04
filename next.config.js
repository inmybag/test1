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
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: '*.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: '*.cdninstagram.com',
      },
      {
        protocol: 'https',
        hostname: 'p16-sign-sg.tiktokcdn.com',
      },
      {
        protocol: 'https',
        hostname: '*.tiktokcdn.com',
      },
    ],
  },
  serverExternalPackages: ['@sparticuz/chromium'],
}

module.exports = nextConfig
