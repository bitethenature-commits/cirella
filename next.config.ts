import type { NextConfig } from "next";
import { buildEnvSnapshot, securityHeaderOptionsFromEnv, securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  // Sentry se carga solo con SENTRY_DSN (import dinámico en lib/monitoring.ts): fuera del bundle.
  serverExternalPackages: ["@sentry/nextjs"],
  // app/global-error.tsx sustituye al layout raíz y no tiene datos del servidor: el modo del sitio
  // llega al navegador al compilar (cambiar SITE_MODE pide volver a desplegar con build, como hacen
  // Vercel y Railway). CIRELLA_BUILD_ENV guarda lo que el build deja fijado: al arrancar en
  // producción, instrumentation.ts avisa si las variables han cambiado sin volver a compilar.
  env: { NEXT_PUBLIC_SITE_MODE: process.env.SITE_MODE ?? "platform", CIRELLA_BUILD_ENV: JSON.stringify(buildEnvSnapshot()) },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  // «Reservas» ya no existe: todo está en Solicitudes. Los enlaces de los emails ya enviados siguen funcionando.
  async redirects() {
    return [
      { source: "/panel/reservas", destination: "/panel/solicitudes", permanent: true },
      { source: "/panel/reservas/horario", destination: "/panel/solicitudes/horario", permanent: true },
      { source: "/panel/reservas/nueva", destination: "/panel/solicitudes/dar/sesion", permanent: true },
      { source: "/panel/reservas/:id", destination: "/panel/solicitudes/reserva/:id", permanent: true },
    ];
  },
  async headers() {
    // CSP, HSTS y demás (lib/security-headers.ts). Se calculan al hacer `next build` con las
    // variables de ese momento: en Vercel cada entorno se construye con las suyas.
    // /api/stream y /api/portal/<elemento>/<n> (bytes de archivos privados) llevan su propia CSP
    // «sandbox»: la general no la pisa.
    const all = securityHeaders(securityHeaderOptionsFromEnv());
    return [
      { source: "/((?!api/stream/|api/portal/).*)", headers: all },
      { source: "/api/stream/:path*", headers: all.filter((h) => h.key !== "Content-Security-Policy").concat({ key: "Content-Security-Policy", value: "sandbox; default-src 'none'" }) },
      { source: "/api/portal/:path*", headers: all.filter((h) => h.key !== "Content-Security-Policy").concat({ key: "Content-Security-Policy", value: "sandbox; default-src 'none'" }) },
    ];
  },
};

export default nextConfig;
