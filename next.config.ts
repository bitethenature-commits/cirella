import type { NextConfig } from "next";
import { securityHeaderOptionsFromEnv, securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  // Sentry se carga solo con SENTRY_DSN (import dinámico en lib/monitoring.ts): fuera del bundle.
  serverExternalPackages: ["@sentry/nextjs"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    // CSP, HSTS y demás (lib/security-headers.ts). Se calculan al hacer `next build` con las
    // variables de ese momento: en Vercel cada entorno se construye con las suyas.
    return [{ source: "/:path*", headers: securityHeaders(securityHeaderOptionsFromEnv()) }];
  },
};

export default nextConfig;
