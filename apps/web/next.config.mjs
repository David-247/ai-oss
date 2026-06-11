/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are consumed as TypeScript source; Next transpiles them.
  transpilePackages: ["@ai-oss/shared"],
  // §4: HSTS-ready TLS. Full security-header policy lands in Phase 19;
  // HSTS is safe to assert now since the canonical site is HTTPS-only.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
