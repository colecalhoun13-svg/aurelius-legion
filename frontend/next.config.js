/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Prisma's native query engine can't be webpack-bundled — leave the
    // client external so Node resolves the generated client + engine
    // from node_modules at runtime.
    serverComponentsExternalPackages: ["@prisma/client"],
  },
};

module.exports = nextConfig;
