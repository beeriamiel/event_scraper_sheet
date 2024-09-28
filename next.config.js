/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
  },
}

module.exports = nextConfig