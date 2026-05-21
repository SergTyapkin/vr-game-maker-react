// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  reactStrictMode: true,
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],

  webpack(config) {
    config.module.rules.push({
      test: /\.(glb|gltf|hdr|bin|jpeg|jpg|png|svg)$/,
      type: 'asset/resource',
    });

    return config;
  },

  // Прокси для бэкенда в режиме разработки
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
      {
        source: '/assets/:path*',
        destination: 'http://localhost:8000/assets/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
