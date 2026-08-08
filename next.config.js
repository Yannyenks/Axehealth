const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
    // argon2 embarque un binaire natif (node-gyp-build) — le laisser bundler
    // par webpack casse la résolution du binaire prébuilt en production
    // (Vercel: "No native build was found for platform=linux..."). Il faut
    // qu'il reste un require() direct vers node_modules au runtime.
    serverComponentsExternalPackages: ["argon2"],
  },
};

module.exports = withNextIntl(nextConfig);
