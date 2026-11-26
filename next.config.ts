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
  // Las direcciones en español de antes (2026-11) llevan a las nuevas, en inglés: los enlaces de los emails ya
  // enviados y los guardados siguen funcionando. Las de la web de cada creadora, en middleware.ts.
  async redirects() {
    const moved: [string, string][] = [
      ["/cuenta/mi-energia/astrologia", "/area/energy/astrology"],
      ["/cuenta/mi-energia/diseno-humano", "/area/energy/human-design"],
      ["/cuenta/mi-energia/luna", "/area/energy/moon"],
      ["/cuenta/mi-energia/oraculo", "/area/energy/oracle"],
      ["/cuenta/mi-energia/runas", "/area/energy/runes"],
      ["/cuenta/mi-energia/:resto*", "/area/energy/:resto*"],
      ["/cuenta/sesiones/anteriores", "/area/sessions/past"],
      ["/cuenta/sesiones/:resto*", "/area/sessions/:resto*"],
      ["/cuenta/novedades/confirmar", "/area/newsletter/confirm"],
      ["/cuenta/membresias/:resto*", "/area/membership/:resto*"],
      ["/cuenta/cursos/:resto*", "/area/courses/:resto*"],
      ["/cuenta/archivos/:resto*", "/area/files/:resto*"],
      ["/cuenta/compras", "/area/purchases"],
      ["/cuenta/pedidos/:resto*", "/area/orders/:resto*"],
      ["/cuenta/perfil", "/area/profile"],
      ["/cuenta/soporte", "/area/settings"],
      ["/cuenta/:resto*", "/area/:resto*"],
      ["/entrar/codigo", "/login/code"],
      ["/entrar", "/login"],
      ["/registro", "/signup"],
      ["/contrasena", "/password"],
      ["/aviso-legal", "/legal-notice"],
      ["/privacidad", "/privacy"],
      ["/terminos", "/terms"],
      ["/auth/salir", "/auth/logout"],
      ["/auth/continuar", "/auth/continue"],
      ["/auth/enlace/cambiar", "/auth/link/change"],
      ["/auth/enlace", "/auth/link"],
      ["/auth/pedido/:id", "/auth/order/:id"],
      ["/auth/crear-pagina", "/auth/create-page"],
      ["/baja/comunidad/un-clic", "/unsubscribe/membership/one-click"],
      ["/baja/newsletter/un-clic", "/unsubscribe/newsletter/one-click"],
      ["/baja/recordatorios/un-clic", "/unsubscribe/reminders/one-click"],
      ["/baja/comunidad", "/unsubscribe/membership"],
      ["/baja/newsletter", "/unsubscribe/newsletter"],
      ["/baja/recordatorios", "/unsubscribe/reminders"],
      ["/novedades/confirmar", "/newsletter/confirm"],
      ["/pago-simulado/cuenta", "/test-payment/account"],
      ["/pago-simulado/:ref", "/test-payment/:ref"],
      ["/media/ver/:cid/:file", "/media/view/:cid/:file"],
      ["/dev/correo", "/dev/email"],
    ];
    return [
      { source: "/panel/reservas", destination: "/panel/solicitudes", permanent: true },
      { source: "/panel/reservas/horario", destination: "/panel/solicitudes/horario", permanent: true },
      { source: "/panel/reservas/nueva", destination: "/panel/solicitudes/dar/sesion", permanent: true },
      { source: "/panel/reservas/:id", destination: "/panel/solicitudes/reserva/:id", permanent: true },
      ...moved.map(([source, destination]) => ({ source, destination, permanent: true })),
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
