/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Shared hosting may limit the number of child Node processes.
    cpus: 1,
    serverComponentsExternalPackages: ["pdfkit"],
  },
};

module.exports = nextConfig;
