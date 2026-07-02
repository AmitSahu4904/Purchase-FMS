/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URI: process.env.NEXT_PUBLIC_API_URI || '/api/sheets',
  },
}

export default nextConfig
