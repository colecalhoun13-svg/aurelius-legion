/** @type {import('next').NextConfig} */
const nextConfig = {
  // Old doors redirect to the merged pages — bookmarks, deep links, and
  // muscle memory keep working (query strings carry over automatically).
  async redirects() {
    return [
      { source: "/", destination: "/home", permanent: false },
      { source: "/bridge", destination: "/decisions", permanent: false },
      { source: "/inbox", destination: "/decisions?tab=triage", permanent: false },
      { source: "/corpus", destination: "/brain?tab=ask", permanent: false },
      { source: "/library", destination: "/brain", permanent: false },
      { source: "/wiki", destination: "/brain?tab=wiki", permanent: false },
      { source: "/projects", destination: "/goals", permanent: false },
    ];
  },
  experimental: {
    // Prisma's native query engine can't be webpack-bundled — leave the
    // client external so Node resolves the generated client + engine
    // from node_modules at runtime.
    serverComponentsExternalPackages: ["@prisma/client"],
  },
};

module.exports = nextConfig;
