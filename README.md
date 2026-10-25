# Cirella

> **Convierte tu perfil social en tu negocio completo, desde un solo enlace.**

Plataforma SaaS multi-tenant para profesionales independientes (astrología, Human Design, Gene Keys, espiritualidad, wellness, coaching, terapias holísticas y creadoras de contenido). Cada creadora obtiene en minutos su espacio en `cirella.app/su-nombre`: link-in-bio premium, tienda, reservas, cursos, membresías, pagos, entrega automática, área de clientes y estadísticas.

«Cirella» es el nombre provisional y se cambia en **/admin/ajustes**.

---

## Puesta en marcha

Requisitos: Node 20+ (probado con Node 22) y PostgreSQL 16 (con Docker o instalado en local).

```bash
npm install
cp .env.example .env
docker compose up -d db   # Postgres 16 con usuario, contraseña y BD «cirella» (o npm run db:up)
npm run setup             # aplica las migraciones y siembra la demo
npm run dev               # http://localhost:3000
```

Sin Docker sirve cualquier Postgres 16 local: crea el usuario y la base de datos `cirella` (contraseña `cirella`) o cambia `DATABASE_URL` y `DIRECT_URL` en `.env`.

Si vienes de una versión anterior, **vuelve a copiar `.env.example`**: la app valida la configuración al arrancar y, sin `APP_ENV` ni `PAYMENT_PROVIDER`, se niega a arrancar explicando qué falta.

- `npm run db:reset` (o `npm run db:seed`) vuelve a dejar los datos de demostración como al principio: el seed vacía las tablas antes de sembrar. **Solo funciona en local**: se niega en `staging`/`production`, con una base de datos que no esté en `localhost` (o en el contenedor `db`) y con una base de datos que tenga cuentas que no creó él mismo. No borra nada en esos casos.
- `npm run db:migrate` crea una migración nueva en `prisma/migrations` tras cambiar `prisma/schema.prisma` (nunca se edita una migración ya publicada).
- `npm run db:deploy` (`prisma migrate deploy`) aplica solo las migraciones pendientes, sin tocar los datos; `npm run deploy` lo incluye.
- `npm run db:check` comprueba que las migraciones y el esquema coinciden. Necesita una BD vacía de usar y tirar en `SHADOW_DATABASE_URL`, que se pasa al ejecutar (no se lee de `.env`): `SHADOW_DATABASE_URL="postgresql://cirella:cirella@localhost:5432/cirella_shadow" npm run db:check`.

El modo demo (accesos rápidos en `/entrar`, buzón `/dev/correo`) solo se activa con `DEMO_MODE="true"`, como viene en `.env.example`, y está **prohibido en producción**: con `APP_ENV=staging` o `production` la app no arranca si lo encuentra, y aunque se saltara esa comprobación seguiría apagado. El buzón, además, solo lo abre la administradora, porque enseña los enlaces de acceso de todas las cuentas.

### Desplegar en producción

La guía completa (Vercel en Fráncfort, Neon, Cloudflare R2 en la UE, staging, copias y restauración, subencargados) está en [docs/despliegue.md](docs/despliegue.md).

En el hosting se definen las variables de la tabla [Configuración](#configuración) (nunca un `.env` copiado de local) y el paso de publicación ejecuta:

```bash
npm run deploy   # check:env → prisma migrate deploy → datos base (planes, categorías, diseños)
```

`deploy` no carga datos de ejemplo ni crea cuentas: solo añade los planes, categorías y diseños que falten, sin tocar lo editado en `/admin`. Nunca se ejecuta `npm run setup`, `db:seed` ni `db:reset` en producción (además se niegan). Necesita las dependencias de desarrollo (`prisma` y `tsx`) instaladas.

Después del primer despliegue, programa `GET /api/cron` **cada 5 minutos** con la cabecera `Authorization: Bearer $CRON_SECRET` (Vercel Cron con el plan Pro, que ya viene en `vercel.json`, cron-job.org, GitHub Actions o el cron del servidor; el modo personal, que va en Railway, usa cron-job.org: ver [docs/modo-personal.md](docs/modo-personal.md)): envía los emails y sus reintentos, procesa los avisos pendientes, las renovaciones y los abandonos, y vuelve a entregar los pedidos cobrados que no se entregaron. Opcionalmente, apunta un monitor de disponibilidad (BetterStack, UptimeRobot…) a `GET /api/health`: responde 503 si la base de datos no responde o si el cron lleva más de 20 minutos sin ejecutarse (el cuerpo JSON dice cuál de las dos cosas falla). Ver [Fiabilidad y monitorización](#fiabilidad-y-monitorización).

Para la cuenta de administración: regístrate de forma normal en `/registro` con el email elegido y después, en el servidor, `npm run admin:promote -- tu@email.com`. Ninguna contraseña pasa por la terminal ni existe ninguna cuenta `demo1234` en producción.

### Modo personal (una sola dueña)

Con `SITE_MODE=personal` y `OWNER_USERNAME=<usuario>` Cirella es la web de una sola persona: su página es la portada (`/`; `/<usuario>` redirige ahí y las demás páginas de creadora dan 404), no se pueden crear cuentas de creadora, no hay planes ni comisiones, y o no cobra en la web (`PAYMENT_PROVIDER=none`: lo gratuito se consigue con el email y lo de pago lleva a otra web) o cobra con las cuentas de la dueña, con tarjeta (Stripe directo, sin Connect) y/o PayPal (`PAYMENT_PROVIDER=stripe,paypal`; la compradora elige en el checkout, cada pedido y membresía se cobra, renueva y reembolsa por su pasarela, y vende la dueña con su IVA: incluida una empresa de fuera de la UE con la ventanilla única «no Unión»; guía: [docs/cobros-stripe-paypal.md](docs/cobros-stripe-paypal.md)), y en el login, el panel, el área de clienta y los 404 se ve el nombre de su página en lugar de «Cirella». El panel enseña Inscripciones, Publicaciones y Códigos, y `/admin` se reduce a envíos fallidos y ajustes. Su cuenta (administradora, página publicada, plan «Personal» con comisión 0) se crea sola en el despliegue con `OWNER_EMAIL` y `OWNER_NAME`, o con `npm run personal:setup -- --email tu@email.com --name "Tu Nombre"`. Sin la variable, todo funciona como siempre. En Render, `render.yaml` crea la web y la base de datos de una vez ([docs/render.md](docs/render.md)). Guía paso a paso para desplegarlo (Railway con Postgres, Cloudflare R2, Resend y cron-job.org; unos 5 $ al mes más el dominio), pensada para alguien sin conocimientos técnicos: [docs/modo-personal.md](docs/modo-personal.md).

## Configuración

`lib/env.ts` es la única puerta a la configuración: ningún módulo lee las variables de `process.env` directamente (salvo `NODE_ENV`, que fija Next). Al arrancar (`instrumentation.ts`) se validan todas las variables y, si algo no encaja con el entorno, el proceso termina mostrando **todos** los problemas a la vez. `npm run check:env` hace la misma comprobación antes de desplegar (sin `APP_ENV`, valida como `production`).

`APP_ENV` puede ser `development`, `test`, `staging` o `production`. Si no se define, `next start` (NODE_ENV=production) cuenta como `production`. `staging` y `production` siguen las reglas de producción; en `development` y `test`, `APP_URL` tiene que ser local (localhost o red privada), para que un `.env` de desarrollo no pueda servir la web pública, y las claves live de Stripe están prohibidas.

| Variable | Producción | Notas |
|---|---|---|
| `APP_ENV` | `production` | Recomendado definirla de forma explícita. `staging` admite claves de prueba de Stripe: nunca con creadoras ni contenido reales. |
| `APP_URL` | Obligatoria | `https://`, dominio público y sin ruta (p. ej. `https://cirella.app`). Sin ella no hay valor por defecto. También se necesita al hacer `next build` (SEO y Open Graph). |
| `DATABASE_URL` / `DIRECT_URL` | Obligatorias | `postgresql://…`. La primera es la conexión de la aplicación (la del pooler, si lo hay); la segunda, la directa para las migraciones. |
| `DEMO_MODE` | Prohibido `true` | `"true"` o `"false"`. Con `true` en producción la app no arranca. |
| `SITE_MODE` | Opcional | `platform` (por defecto) o `personal`: la web de una sola dueña, sin registro de otras creadoras ni cobros en la web (ver `lib/site-mode.ts`). |
| `OWNER_USERNAME` | Obligatoria en modo personal | Usuario de la dueña de la web (el de su página, p. ej. `ana`). |
| `OWNER_EMAIL` / `OWNER_NAME` | Opcionales (modo personal) | Email y nombre de la dueña. Con `OWNER_EMAIL`, `npm run deploy` crea su cuenta (administradora, sin contraseña: entra con un enlace por email) y su página publicada si aún no existen; después no las toca. Sin ella, la cuenta se crea con `npm run personal:setup`. |
| `PAYMENT_PROVIDER` | `stripe` (`none` o `stripe,paypal` en modo personal) | Obligatoria en todos los entornos, sin valor por defecto: si falta, las compras fallan en vez de entregarse gratis. `simulated` solo en local y pruebas. `none` (sin cobros en la web: todo checkout de pago se cierra) en local o, en producción, solo en modo personal; entonces no hacen falta las claves de Stripe. Varias separadas por comas (`stripe,paypal`): la compradora elige; `paypal` solo en modo personal. |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_WEBHOOK_ID` / `PAYPAL_ENV` | Con `paypal` | App REST de la cuenta PayPal Business de la dueña; `PAYPAL_WEBHOOK_ID` (obligatorio en producción) verifica los avisos de `/api/webhooks/paypal`; `PAYPAL_ENV=live` en producción, `sandbox` fuera. `PAYPAL_API_URL` solo para pruebas en local (PayPal falso de `scripts/paypal-mock.ts`). |
| `STRIPE_SECRET_KEY` · `STRIPE_PUBLISHABLE_KEY` · `STRIPE_WEBHOOK_SECRET` | Obligatorias | `sk_live_`/`rk_live_`, `pk_live_` y `whsec_` en producción; claves `_test_` en el resto. `STRIPE_WEBHOOK_SECRET` es el del endpoint de plataforma de `/api/webhooks/stripe` (ver [docs/pagos-stripe.md](docs/pagos-stripe.md)). |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Obligatoria | `whsec_…` del segundo endpoint, el de «eventos en cuentas conectadas» (`account.updated`): sin él no sabremos cuándo Stripe verifica a una creadora. |
| `STRIPE_ON_BEHALF_OF` | Opcional | `true` hace a la creadora comerciante de liquidación (su nombre en el extracto de la tarjeta). Por defecto `false`; pendiente de decidir con la asesoría. |
| `CRON_SECRET` | Obligatoria | 32+ caracteres aleatorios (`openssl rand -hex 32`). Token de `GET /api/cron`; con ella, `/api/health` vigila además que el cron no esté parado. |
| `APP_SECRET` | Obligatoria | 32+ caracteres aleatorios. Firma de enlaces, los billetes de subida y las URLs temporales de descarga. Fuera de producción hay una fija de desarrollo. |
| `EMAIL_PROVIDER` | `resend` | `log` (local, se ve en `/dev/correo`; las direcciones con `+fallo` o `+rebote` simulan fallos del proveedor) o `resend`. Con `resend`: `RESEND_API_KEY` y `EMAIL_FROM` (`Cirella <hola@tudominio.com>`, en un dominio verificado en Resend). Los emails a clientas salen desde esa dirección con el nombre de la creadora y responden a su email de contacto. |
| `STORAGE_DRIVER` | `s3` | `local` (carpeta `STORAGE_DIR`, por defecto `./storage`) o `s3` (Cloudflare R2). Con `s3`: `S3_ENDPOINT` (en R2 con jurisdicción UE, `https://<cuenta>.eu.r2.cloudflarestorage.com`), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`; opcional `S3_REGION` (`auto`). `S3_PUBLIC_URL` no se usa: los buckets son privados. |
| `SENTRY_DSN` | Opcional | DSN del proyecto de Sentry en la región UE (`…ingest.de.sentry.io/…`). Sin DSN, Sentry ni se carga y los errores quedan en el log del servidor. El entorno que se informa es `APP_ENV`. |
| `TURNSTILE_SITE_KEY` · `TURNSTILE_SECRET_KEY` | Opcionales | Las dos o ninguna. Captcha invisible del checkout tras varios pagos rechazados (ver «Límites de intentos»). |
| `CLIENT_IP_HEADER` | Obligatoria | Cabecera con la IP real de la clienta que la plataforma sobrescribe siempre: `x-real-ip` en Vercel (sin Cloudflare como proxy delante). Fuera de producción, sin ella se usa el último valor de `X-Forwarded-For`. Ver «Límites de intentos». |

### Cuentas de demostración

Contraseña de todas: `demo1234`. También hay botones de acceso rápido en **/entrar**.

| Cuenta | Rol | Qué ver |
|---|---|---|
| `ana@cirella.app` | Creadora · plan Pro | Panel, editor, productos, curso, reservas, estadísticas |
| `laura@example.com` | Clienta de Ana | «Hola, Laura»: curso al 43 %, una sesión a las 17:00 dentro de unos días (siempre por venir), PDF de Gene Keys |
| `admin@cirella.app` | Superadmin | Planes, comisiones, creadoras, ventas, reportes |
| `maria@cirella.app` | Creadora · plan Creator | Otro tenant (wellness, plantilla Minimal) |

### Recorrido sugerido

1. **`/`** · landing con precios leídos de la BD y una demo en vivo de Ana.
2. **`/ana`** · página pública (plantilla Mystical) → un producto → **checkout** (tarjeta `4242…`; `4000 0000 0000 0002` simula un rechazo y `4000 0027 6000 3184` la confirmación en la app del banco, con «El banco tarda» para ver el pago pendiente) → «Compra completada» → **«Tu compra»** (`/cuenta/pedidos/…`, solo ese pedido; para ver todas las compras se entra con un enlace al email).
3. **`/registro`** · crea una creadora nueva: onboarding de 10 pasos (el registro es el primero) → «Tu página está lista».
4. **`/panel`** (como Ana) · métricas «Este mes / Últimos 30 días / Total», editor visual con vista previa en vivo, productos por tipo, reservas, automatizaciones, plan, referidos.
5. **`/admin`** · todo lo de la plataforma: planes editables, comisiones, bloqueos, reportes CSV, política de IVA y facturas emitidas (`/admin/impuestos`).
6. **`/dev/correo`** · buzón de demostración con todos los emails que «envía» la plataforma (recibos, enlaces mágicos, recordatorios programados), solo para la administradora: si entras sin sesión, ofrece entrar como superadmin y vuelve. El botón «Ejecutar tareas programadas» simula el cron.

La portada de Ana lleva un bloque de cada tipo (su vídeo de bienvenida subido, un gráfico y una galería) y tiene dos páginas extra: **«Sobre mí»** publicada (`/ana/p/sobre-mi`; en la web personal, `/sobre-mi`) y **«Preguntas frecuentes»** en borrador; se editan en `/panel/paginas`.

Otras páginas de ejemplo: `/maria` (Minimal, plan Creator) y `/sofia` (Luxury, plan Free con «Powered by»).

---

## Qué incluye el MVP

El flujo **Instagram → página → producto → pago → entrega → clienta recurrente** funciona de extremo a extremo y está cubierto por pruebas automáticas.

| Área | Estado |
|---|---|
| Landing, registro, login con contraseña o enlace mágico (con pantalla «Entrar» y la marca de la creadora), «Confirma tu email» | ✅ |
| Onboarding de 10 pasos + «Tu página está lista» con copiar / Instagram / WhatsApp / Telegram / ver página | ✅ |
| Página pública mobile-first con 5 plantillas, secciones activables y ordenables, SEO, Open Graph y favicon por creadora, Schema.org | ✅ |
| Productos: digital (archivos privados), sesión (duración, margen, antelación), curso (módulos y lecciones por partes: vídeo, audio, texto con formato, PDF, imágenes, YouTube/Vimeo y otros archivos en una misma lección), membresía (contenido privado) | ✅ |
| Checkout sin cuenta previa: acceso inmediato a esa compra en el navegador que pagó y enlace personal en el recibo | ✅ |
| Cobros con Stripe Connect Express (Checkout alojado, cargos de destino, confirmación del banco y pago pendiente, tarjeta guardada para renovar membresías, contracargos) y verificación de la cuenta de cobro de cada creadora | ✅ (simulador en la demo; ver [docs/pagos-stripe.md](docs/pagos-stripe.md)) |
| DAC7: datos fiscales de las creadoras, recordatorios, informe trimestral y CSV del modelo 238 | ✅ (criterios por confirmar con la asesoría) |
| IVA incluido y facturas: precios con «IVA incluido», país de la compradora y desglose en el checkout, «Necesito factura con mi NIF», facturas numeradas e inmutables (simplificada, completa, sustitutiva y rectificativa) imprimibles en `/facturas/…`, justificante cuando no hay factura, factura mensual de Cirella a cada creadora, situación de IVA de la creadora y política de IVA en `/admin/impuestos` | ✅ (opción A por defecto; decisión, OSS y Verifactu por cerrar con la asesoría) |
| Venta online conforme a la ley: quién vende (NIF/NIE/CIF validado) en la página, la ficha, el checkout y el recibo; condiciones, cambios y reembolsos y privacidad editables por creadora; casillas del checkout sin marcar (condiciones, renuncia al desistimiento, novedades); copia de las condiciones aceptadas en cada pedido; términos, privacidad y aviso legal de la plataforma; visitas sin cookies | ✅ (textos por revisar con una asesoría) |
| Área de cliente: compras, cursos con progreso, sesiones (elegir / cambiar fecha, .ics), membresías (cancelar / reactivar), archivos, perfil, soporte | ✅ |
| Reservas: disponibilidad semanal, días bloqueados, zona horaria, huecos libres en tiempo real | ✅ |
| Reembolsos totales o parciales desde el detalle del pedido, «Cambiar o cancelar» una sesión (otra fecha, cancelar y reembolsar, cancelar sin reembolso), desistimiento en 14 días desde «Mis compras», siempre con confirmación y aviso por email | ✅ (reglas del desistimiento por confirmar con la abogada) |
| Panel: ventas, ingresos, clientes, conversión, visitas, top productos, MRR, reservas, suscripciones | ✅ |
| Editor visual: foto, nombre, textos, colores, tipografía, fondo, portada, orden, botones, secciones, redes · Guardar / Vista previa / Publicar | ✅ |
| Analytics sin cookies: visitas, visitantes únicos (por día), vistas y clics de producto, checkouts, compras, conversión, ingresos, fuentes de tráfico | ✅ |
| Automatizaciones: arquitectura completa + 8 emails (bienvenida, compra, acceso al curso, confirmación y recordatorio de sesión, nueva suscripción, cancelación, compra abandonada) | ✅ (envío simulado) |
| Superadmin: creadoras, clientes, ventas, comisiones, transacciones, suscripciones, productos, planes, categorías, diseños, bloqueados, reportes | ✅ |
| Viral loop: «Powered by» con código de referido, programa de referidos con recompensa configurable | ✅ |

### Simulado en el MVP (con el punto de integración preparado)

| Pieza | Hoy | Para producción |
|---|---|---|
| Pagos | `lib/payments/simulated.ts` (mismo ciclo de vida que Stripe) | Stripe ya integrado (`PAYMENT_PROVIDER=stripe`): crear la cuenta y los webhooks y probarlo en modo prueba con la CLI de Stripe ([docs/pagos-stripe.md](docs/pagos-stripe.md)). Las cuotas de los planes de las creadoras siguen simuladas. |
| Emails | Bandeja `EmailMessage` + `/dev/correo` (proveedor `log`) | Resend ya integrado (`EMAIL_PROVIDER=resend`, `lib/email/providers/resend.ts`) |
| Calendario | `lib/calendar.ts` sin proveedor | Google Calendar: implementar `CalendarProvider` (freebusy + events.insert) |
| Archivos | Disco local (`STORAGE_DIR`) | S3/R2 manteniendo las funciones de `lib/storage.ts` |
| Cron | Botón en `/dev/correo` | Llamar a `GET /api/cron` con `Authorization: Bearer $CRON_SECRET` cada 5 min |

---

## Arquitectura

**Stack:** Next.js 15 (App Router, Server Components y Server Actions) · TypeScript · Prisma (PostgreSQL, Prisma Migrate) · Tailwind CSS 4 · Zod. Sin librerías de UI ni de gráficos: el bundle inicial ronda los 108 kB.

```
app/
  page.tsx                 landing
  (auth)/registro, entrar  autenticación («Crea tu contraseña» en (auth)/contrasena)
  auth/                    enlace mágico (magic), enlaces personales (enlace), acceso tras pagar (pedido)
  onboarding/              asistente de 10 pasos y «Tu página está lista»
  [username]/              página pública, producto, checkout, gracias, OG image, favicon
  panel/                   panel de la creadora (tenant)
  cuenta/                  área de cliente
  admin/                   superadmin
  api/                     track, upload, download, slots, cron, health, webhooks/stripe, payments (vuelta de la pasarela)
  pago-simulado/           «Stripe» y «banco» del simulador (solo con PAYMENT_PROVIDER=simulated)
  dev/correo/              buzón de demostración
components/
  creator-page/            renderizador de la página pública (también usado en la vista previa del editor)
lib/
  tenant.ts                aislamiento multi-tenant
  auth.ts, buyer-access.ts sesiones, verificación del email y guardas del área de cliente
  magic-links.ts, order-links.ts  enlaces mágicos y enlaces personales de los emails
  orders.ts                checkout y entrega automática
  payments/                pasarelas (simulada y Stripe Connect), avisos de la pasarela (events.ts) y reintentos de renovación
  payouts.ts               cuenta de cobro de cada creadora: estado, requisitos de Stripe y avisos
  dac7.ts, dac7-data.ts    DAC7 / modelo 238: datos fiscales, recordatorios e informe trimestral
  plans.ts                 entitlements de los planes
  events.ts                eventos de dominio (outbox transaccional) → event-handlers.ts
  automations.ts           qué emails envía cada evento
  email/                   bandeja de salida con reintentos y proveedores (log, Resend)
  cron.ts, job-lock.ts     tareas programadas con cerrojo y latido
  watchdog.ts              vigilante de pedidos cobrados sin entregar
  monitoring.ts            errores y alertas (Sentry opcional)
  booking.ts, tz.ts        cálculo de huecos con zonas horarias
  templates.ts             sistema de diseño de las páginas públicas
  page-config.ts           esquema del contenido editable de la página
prisma/
  schema.prisma            modelo de datos
  migrations/              migraciones de Prisma Migrate (SQL)
  seed.ts                  datos de demostración
  demo-dates.ts            fechas de la demo, relativas al día en que se siembra
  demo-sales.ts            importes de las ventas de la demo (IVA y comisión como el checkout)
```

### Acceso a la cuenta

Nadie entra en la cuenta de otra persona solo por conocer su email:

- **Email confirmado.** `User.emailVerifiedAt` se fija la primera vez que alguien demuestra que el email es suyo (enlace mágico o «Sí, he sido yo» en el email «Confirma tu email» que llega tras darse de alta con contraseña). Una sesión es **verificada** solo si se abrió con un enlace mágico o con contraseña sobre un email ya confirmado, y solo las verificadas abren el área de cliente completa y `/admin`. El alta con contraseña entra directa al onboarding (no frena la conversión) y el panel muestra «Confirma tu email» hasta que se confirma.
- **Recuperación.** La primera prueba de propiedad (o «No he sido yo») borra la contraseña creada sin esa prueba y todas las sesiones, y pide crear una nueva en `/contrasena`. Así, quien registre antes el email de una futura clienta pierde el acceso en cuanto ella abre un enlace.
- **Enlace mágico en dos pasos.** `/auth/magic` solo enseña el botón «Entrar» (los antivirus del correo abren los enlaces con GET y ya no los gastan); el POST lo gasta de forma atómica. Dura 1 hora (72 h el de «Confirma tu email»), lleva la marca de la creadora si se pidió desde su página y la página no envía `Referer`.
- **Sesiones limitadas a un pedido** (`Session.orderId`). Al pagar, el navegador que hizo el pedido (cookie httpOnly `cirella_compra` con el hash en `Order.claimTokenHash`) recibe una sesión de 24 h que solo abre esa compra: su producto, sus archivos y su reserva. También al volver de la pasarela o del banco (`claimOrderSession`). Nunca sustituye una sesión de cuenta abierta ni abre `/cuenta` completa, `/panel`, `/onboarding` ni `/admin`.
- **Enlaces personales** (`OrderLink`, `lib/order-links.ts`) en el recibo, el acceso al curso, la confirmación y el recordatorio de la sesión y la propuesta de otra fecha: llevan directos a la compra sin contraseña, sirven varias veces durante 14 días (el del recordatorio cuenta desde su envío) y abren una sesión limitada de 7 días. Nunca confirman el email. Al reembolsar con retirada de acceso se revocan junto con las sesiones del pedido; caducados, llevan al login con la marca de la creadora.
- **Login con marca** en `/[username]/entrar` (solo enlace por email). `/entrar` pasa a modo clienta cuando el destino es `/cuenta` y, si la ruta dice de qué creadora es, redirige a su login. Si el navegador ya tiene otra cuenta abierta, `/auth/enlace/cambiar` pregunta antes de cambiar.
- Las guardas viven en `lib/buyer-access.ts` (`requireBuyerFull`, `requireBuyerFor`, `checkProductAccess`) y el cron borra las sesiones, enlaces mágicos y enlaces personales caducados.

Plazos propuestos (pendientes de confirmar): enlace mágico 60 min, «Confirma tu email» 72 h, enlace personal 14 días, sesión del enlace personal 7 días y sesión tras comprar 24 h.

### Multi-tenant

Base de datos compartida con columna `creatorId` en **todas** las tablas de negocio (productos, archivos, lecciones, clientes, pedidos, transacciones, accesos, reservas, suscripciones, analytics, automatizaciones, emails), siempre indexada.

- **`tenantDb(creatorId)`** (`lib/tenant.ts`) es un cliente Prisma extendido que inyecta `creatorId` en el `where` de cada lectura, actualización, borrado, conteo y agregado, y en el `data` de cada creación. Todo el panel usa este cliente: aunque llegue un id manipulado (un producto de María en una petición de Ana) la consulta no encuentra nada.
- La identidad es global (`User`) y la relación comercial vive en `Customer`, una fila por cada par creadora–compradora. Si Carmen compra a Ana y a María, cada una ve solo su propia ficha de Carmen.
- El contenido de pago solo se sirve a través de `/api/download/[id]`, que comprueba un `Access` vigente (con una sesión verificada o limitada a ese producto) o la propiedad del archivo.
- `npm run test:isolation` comprueba lecturas, agregados, actualizaciones, borrados y creaciones cruzadas. La prueba e2e lo verifica también por HTTP: 404 en el panel y 403 en las descargas ajenas.

### Monetización configurable

Precios, comisión, límite de productos y funcionalidades de cada plan son **datos** (`Plan.features` en JSON) que se editan en **/admin/planes**. Se pueden crear planes nuevos sin tocar código. Los precios de los planes y de los productos son finales, con el IVA incluido, y la comisión se calcula sobre el precio sin IVA (ver «IVA y facturas»). La comisión se guarda como foto fija en cada pedido (`commissionBps`) y todo movimiento queda en el libro `Transaction` (cobros, renovaciones y cuotas de plan), así que cambiar el modelo no altera el histórico.

Valores iniciales (editables):

| Plan | Precio | Comisión | Productos | Incluye |
|---|---|---|---|---|
| Free | 0 € | 10 % | 3 | Productos digitales, métricas básicas, «Powered by» |
| Creator | 12 €/mes | 5 % | 15 | + reservas, personalización visual, estadísticas, sin marca |
| Pro | 29 €/mes | 2 % | Ilimitados | + cursos, membresías, área de clientes, automatizaciones, estadísticas avanzadas |

### Entrega automática

`fulfillOrder()` (`lib/orders.ts`) es idempotente y es el único punto que convierte un pago en acceso: marca el pedido, registra la transacción, crea la clienta del tenant y concede un `Access` (descarga o curso), una `Booking` (sesión) o una `Subscription` con acceso caducable (membresía). Los eventos de dominio (pago completado, clienta nueva, reserva, suscripción) se guardan en la misma transacción y las automatizaciones los convierten en emails (ver abajo).

**Nada se publica sin algo que entregar** (`lib/delivery.ts`, una sola regla para todo). Un producto digital necesita al menos un archivo o enlace, o estar marcado como «Lo preparo yo para cada clienta» (`Product.deliveryMode = PERSONAL`) con instrucciones de qué recibirá y cuándo, que la clienta ve en la ficha, en el email de compra y en su cuenta; un curso necesita al menos una lección; una membresía sin publicaciones solo genera un aviso. Los productos nacen en borrador (`status` por defecto `DRAFT`) y la regla se comprueba al publicar desde el editor, la lista, el admin y el final del onboarding, y al borrar el último archivo, lección o módulo de un producto publicado. El paso 8 del onboarding pregunta cómo se entrega el primer producto (subir el archivo, poner un enlace, prepararlo a mano o «Lo añado más tarde», que lo deja en borrador); «Tu página está lista» solo promete ventas si el producto está publicado y los cobros activos. El panel avisa en Inicio y marca «Sin entrega» en la lista. La ficha, el checkout y la página de gracias dicen la verdad: «1 archivo descargable y 2 enlaces», «Preparado personalmente para ti» y «Cómo lo recibes». La entrega personal aún no tiene flujo propio (subida por pedido, «pendiente de entregar», plazo): la creadora la envía por email siguiendo sus instrucciones.

Las reservas no se pisan aunque dos personas paguen el mismo hueco a la vez: la comprobación se hace dentro de la transacción bajo un cerrojo por creadora (`hasBookingClash` en `lib/booking.ts`), y la restricción `Booking_no_overlap` de Postgres impide dos reservas confirmadas solapadas aunque algún camino se salte el cerrojo. Quien llega tarde conserva su compra con la reserva pendiente de elegir fecha.

### Cobros (Stripe Connect)

Cada venta es un Checkout alojado de Stripe con **cargo de destino**: cobra la cuenta de Cirella, `application_fee_amount` es su comisión más, si vende ella a efectos de IVA, el IVA de la venta (`platformRetainedCents`, `lib/tax`) y el resto va a la cuenta Express de la creadora. Ningún dato de tarjeta pasa por nuestro servidor. El aviso de Stripe (`/api/webhooks/stripe`, guardado en `PaymentEvent` para no aplicarlo dos veces) y la vuelta de la compradora (`/api/payments/return`) acaban en `applyPaymentUpdate` (`lib/payments/events.ts`), que comprueba importe, moneda y cuenta de destino antes de entregar. Si el banco tarda, el pedido queda «Pago pendiente» (`PROCESSING`) y la página de gracias se actualiza sola; un segundo cobro del mismo pedido se reembolsa. Una creadora solo vende con su cuenta de cobro activada (`canAcceptPayments`, `lib/payouts.ts`); su estado y lo que le falta están en **/panel/ajustes/cobros** y el embudo en **/admin/creadoras**. Las membresías guardan la tarjeta y se renuevan sin la clienta delante; si falla, «Pago pendiente» con reintentos a 1 y 3 días y «Pagar ahora». Configuración, eventos, pruebas y decisiones pendientes: [docs/pagos-stripe.md](docs/pagos-stripe.md).

### Reembolsos, cancelaciones y cambios de fecha

Desde **/panel/ventas/[id]** la creadora devuelve todo o una parte de un pedido (con la opción de retirar el acceso, cancelar la sesión o la membresía) y ve el historial de reembolsos; en **/panel/reservas** cada sesión tiene «Cambiar o cancelar» con tres opciones: proponer otra fecha (se libera el hueco, el pago se mantiene y la clienta recibe un enlace para elegir), cancelar y reembolsar, o cancelar sin reembolso con un motivo obligatorio. La compradora puede **desistir** en 14 días desde **/cuenta/compras** (con sesión verificada) y ve en su sesión el motivo de una cancelación o la nueva fecha propuesta. Todo pide confirmación y avisa por email.

`refundOrder` (`lib/refunds.ts`) reserva el importe con el pedido bloqueado (`SELECT … FOR UPDATE`), así que dos peticiones a la vez nunca devuelven más de lo pagado, y pide el reembolso a la pasarela que cobró el pedido con el id del `Refund` como clave de idempotencia (se devuelve también la parte proporcional de la comisión de Cirella). Los efectos (acceso, sesión, membresía) se aplican en cuanto la pasarela lo acepta; el dinero se contabiliza al confirmarse (`markRefundSucceeded`): fila `REFUND` en **negativo** en el libro, `Order.refundedCents`, contadores de la clienta, evento de analítica y evento `order.refunded`. Un reembolso parcial deja el pedido en `PAID` («Reembolsado parcialmente»); el total lo pasa a `REFUNDED`, que nunca se vuelve a entregar. Los avisos de Stripe (`refund.*`, contracargos perdidos y reembolsos hechos desde su panel) entran por `syncProviderRefund`. Las cifras del panel y del admin son netas de reembolsos (`orderFigures`, `lib/refund-math.ts`) y un reembolso se resta del periodo de la venta original. Los cambios de reserva viven en `lib/booking-changes.ts`.

### Calendario propio (reservas, lecturas y talleres)

La creadora tiene su propia agenda, sin Google Calendar ni Calendly: trabaja con su enlace de Zoom y avisos por email (`lib/calendar.ts` queda dormido). El motor de huecos es puro (`lib/slots.ts`, probado en `scripts/unit/calendario.test.ts`): horario semanal en su zona − días bloqueados − **fechas especiales** (`AvailabilityOverride`: HOURS sustituye el horario de ese día, en la zona que se elija, p. ej. «9:00–13:00 hora de Bali»; BLOCK quita unas horas) − lo ocupado (reservas, talleres y, en la web personal, los **pagos en curso**). El **horizonte** es por sesión (`Product.horizonDays`, 2 semanas a 6 meses) y es el mismo al listar y al comprobar un hueco. `lib/booking.ts` carga los datos; `/api/slots?tz=` devuelve los días en la zona de quien mira y `components/booking/slot-picker.tsx` es el calendario mensual del checkout, del área de cliente y del panel.

- **Reservar y pagar**: en la web personal, el pedido guarda la hora desde que se crea (bajo el cerrojo de la creadora) y mientras la página de Stripe o PayPal siga abierta (`checkoutExpiresAt`); si el pago falla o caduca, la hora vuelve a estar libre. Al confirmar el pago se vuelve a comprobar bajo el cerrojo y la regla `Booking_no_overlap` de la BD es la última red: nunca hay dos sesiones solapadas (si una carrera llega hasta ahí, la segunda queda pagada «pendiente de fecha»). La antelación mínima cuenta desde el pedido. Un abandono guarda la hora unos 30 minutos como mucho.
- **Zona horaria**: la clienta ve y recibe su hora (`Booking.customerTimezone`, `sessionWhen`); la dueña, la suya y «para ella, 11:00 en Bogotá» (`ownerWhen`). La dueña elige su zona de la lista completa (`lib/timezones.ts`) y el panel le avisa si su móvil está en otra (de viaje).
- **Datos para la lectura** (`lib/intake.ts`): cada sesión o lectura «Lo preparo yo» puede pedir fecha, hora y lugar de nacimiento y hasta 8 preguntas. Se guardan en `Order.intake` con el texto de cada pregunta, la clienta los corrige desde su área hasta la sesión o la entrega, la dueña los ve con «Copiar» y los puede borrar; los de pedidos sin pagar se borran a los 30 días (cron `datosLecturas`).
- **Avisos**: confirmación con «Añadir a mi calendario» (.ics firmado, `/api/ics/[id]`), recordatorio 24 h y **segundo recordatorio** 60 min antes con el enlace de Zoom, «Nuevo enlace» si la dueña cambia el de una reserva o el de la sesión, y para la dueña **«Aviso de reservas»** (nueva reserva con los datos, fecha elegida o cambiada, cancelación desde la pasarela, datos nuevos). Las dos automatizaciones nuevas vienen activadas solo en la web personal; ahí el aviso de una sesión pagada sustituye a «Nueva venta».
- **Dar una sesión o lectura** (`/panel/reservas/nueva`, `lib/manual-orders.ts`): regalo o pagada fuera, en un hueco de su agenda, a cualquier otra hora o «que la elija ella». Crea un pedido de 0 € y entrega por `fulfillOrder`; repetir el envío no duplica nada (`requestId`) y una hora ocupada se rechaza.
- **Entregas por pedido** (`OrderFile`, `lib/order-files.ts`): la grabación de una sesión o la lectura preparada (audio, vídeo de hasta 4 GB desde el iPhone, PDF, enlace) con un mensaje con formato. Solo la ven esa clienta (sesión verificada o la de ese pedido, con el acceso activo) y la dueña, por `/api/download` y `/api/stream` con su propia comprobación. Al entregarse una lectura ya no se puede desistir (`DELIVERED`).
- **Talleres en directo**: una sesión con fecha fija y plazas (`groupSession`, `capacity`); cada plaza es una reserva `groupSeat` (fuera de la regla de solapes) y el taller ocupa la agenda 1:1. Se pueden mover de fecha (avisa a cada asistente), subir la grabación y «Avisar de la grabación».

Si un pedido se borrara en cascada, sus archivos de entrega quedarían en R2 (como los de un producto).

### Comunidad (membresías)

Cada membresía tiene su comunidad privada: publicaciones de la dueña con comentarios y «me gusta» de sus miembros.

- **Publicaciones** (`MembershipPost`, `lib/community.ts`, reglas puras en `lib/community-rules.ts`): texto con formato, hasta 10 archivos (audio, vídeo, PDF, imágenes; `ProductFile.postId`, la misma subida por partes que los cursos) y un enlace. «Cuándo»: publicar ahora, **programar** (día y hora en su zona) o borrador. Una programada se ve sola al llegar su hora (`visibleMemberPostWhere`, sin cron); sus archivos no se sirven antes (`checkFileAccess` en `/api/download`, `/api/stream` y `/cuenta/archivos`). La ficha pública nunca enseña borradores, programadas ni adjuntos. Editor en `/panel/productos/<id>/publicaciones/…`; las miembros, en `/cuenta/membresias/<id>` (feed de 15 en 15) y `/cuenta/membresias/<id>/<post>`.
- **Aviso por email** (`lib/community-notify.ts`): al hacerse visible (después de responder al «Publicar ahora», o el cron `comunidad` para las programadas), un email a cada persona con acceso vigente, con su enlace personal, salvo la dueña y quien se dio de baja (`Customer.postEmailsOptOutAt`, `/baja/comunidad` y List-Unsubscribe en un clic, `lib/community-optout.ts`). Se reparte por páginas con cursor y `dedupeKey` por persona; los avisos de hace más de 7 días ya no salen. La bandeja envía primero los transaccionales y después los masivos (`BULK_TEMPLATES`).
- **Comentarios y «me gusta»**: texto plano (≤ 2000, nunca HTML ni enlaces), un nivel de respuestas, nombre «Laura M.» (nunca el email). Comentar exige una sesión de cuenta (no el enlace de un email, que sí deja dar «me gusta»). La dueña borra cualquiera, cierra los comentarios de una publicación y deja sin comentar a una persona (`Customer.commentsBlockedAt`). Avisos: «Comentarios nuevos» a la dueña y respuesta de la dueña a la miembro. Límites: 20 comentarios y 300 «me gusta» por hora.
- **Cursos incluidos** (`ProductInclusion`, `lib/membership-access.ts`): «Qué incluye esta membresía». El acceso al curso no se copia: se deduce del de la membresía en cada visita (`accessSource`, usado por `hasAccess`, `checkProductAccess` y las páginas), así que termina en el mismo instante que ella. El enlace personal de la membresía abre también sus cursos.

### Mi página y páginas extra

- **Bloques** (`lib/page-blocks.ts`, en `pageDraft/pagePublished.blocks` y en las páginas extra): texto con formato, **imagen**, **galería** (carrusel o cuadrícula, hasta 12) y **vídeo**. Los bloques de antes (sin `kind`) son de texto y se pintan igual; `readPageConfig` descarta un bloque dañado sin tumbar la página. Hasta 20 en la portada (2000 caracteres por texto) y 40 en cada página extra (10 000). Se editan con el mismo editor (`components/panel/blocks/`): el selector de fotos se abre en el mismo toque que «Añadir imagen», las subidas enseñan su progreso y la vista previa del teléfono solo se monta en escritorio. Al guardar, `sanitizeBlocks` (`lib/page-blocks.server.ts`) solo deja imágenes y vídeos de la propia creadora, enlaces de vídeo reconocidos y texto sin imágenes.
- **Imágenes**: por `/api/upload` con el perfil **graphic** de `lib/images.ts` (hasta 1600 × 4000 px, WebP q88: una historia de Canva de 1080 × 1920 no se encoge). La subida devuelve el ancho y el alto, que se guardan en el bloque: la web pinta `width`/`height` (sin saltos), `srcset` con las variantes de `/media`, carga diferida y, sin enlace, se amplían al tocarlas (`ZoomableImage`).
- **Vídeo**: enlace de YouTube o Vimeo (`lib/video-embed.ts`), que no carga nada de fuera hasta pulsar ▶ (`VideoFacade`, con portada opcional), o, solo en la web personal, **subido** (`purpose: "video"`: MP4/MOV/M4V hasta 1 GB, por partes si es grande, con duración, medidas y códec). Se guarda en `public/video/<creadora>/<24 hex>.<ext>` y la página lo pide a `/media/video/…`, que responde 302 a una URL firmada de 12 h (la redirección se cachea 10 min): el vídeo sale de R2, nunca del servidor. `<video playsInline>`, nunca en reproducción automática, con `preload="none"` si tiene portada (que el navegador saca de un fotograma al subirlo).
- **Páginas extra** (`SitePage`, `lib/site-pages.ts` y `lib/site-pages.server.ts`): «Sobre mí», «Preguntas frecuentes» o en blanco, cada una con borrador y versión publicada (como la portada), título y descripción para buscadores y redes, y su dirección: `/<usuaria>/p/<slug>` en la plataforma y `/<slug>` en la web personal (rewrite del middleware, `ownerPageRewrite`; es la canónica). Una dirección nunca puede ser una ruta de la web (`RESERVED_USERNAMES`) ni la dueña, y «p» es un slug de producto reservado. Las publicadas salen en el pie de la web (portada, fichas, novedades, legal) en el orden del panel y en el sitemap. Son dinámicas: un 404 cuesta una consulta. Panel: `/panel/paginas` (en el menú de la web personal; en la plataforma, desde «Mi página › Secciones › Gestionar páginas»), con vista previa del borrador, despublicar, borrar y «Añadir un botón a esta página en mi portada».

### Fin del acceso

El acceso termina solo y **se comprueba en cada visita** (`Access.expiresAt` > ahora), nunca solo por un cron:

- **Membresía de pago**: `expiresAt` = fin del periodo pagado. Cancelada, mantiene el acceso hasta ese día; tras el tercer cobro fallido, se cancela. Al cerrarse se avisa a la miembro (`subscription.ended` → «Tu membresía ha terminado»). Mientras el banco confirma una renovación (`processing`) el acceso se alarga hasta el siguiente intento.
- **Acceso a mano con fecha de fin** («Duración del acceso»: 1, 3, 6 meses, 1 año o un día concreto, `lib/access-end.ts`): el último día cuenta en la zona de la dueña. Se guarda en el pedido de 0 € (`metadata.accessUntil`) y en `Access.expiresAt`; «Cambiar fecha» la alarga, la quita o lo devuelve. En la web personal también vale para lo que se cobra en la web (Bizum, transferencia, regalos). El cron `caducidades` (`lib/access-expiry.ts`) avisa 7 días antes (si duraba 14 días o más) y al llegar lo marca `EXPIRED`, corta sus enlaces personales y avisa a ella y a la dueña. El formulario público no devuelve un acceso terminado por su fecha.

### Cumplimiento legal

Una compra en la página de una creadora es un contrato entre ella y su clienta; Cirella solo presta la tecnología. Por eso:

- **Quién vende** (LSSI art. 10). Cada creadora rellena su identidad legal en **/panel/ajustes/legal** o en el paso 9 del onboarding: persona física o empresa, nombre fiscal, NIF/NIE/CIF con su letra o dígito de control, dirección, email público y, si aplica, datos registrales o de colegio profesional. Sin ella no se conecta la cuenta de cobro ni se crea ningún pedido (`legalIdentityComplete`, `lib/legal.ts`). Aparece como «Vende: …» en el pie de sus páginas, la ficha, el checkout y el recibo, y completa en **/{usuario}/legal** (aviso legal, condiciones, cambios y reembolsos con el formulario de desistimiento, privacidad y cookies).
- **Textos editables**. Las condiciones, la política de cambios y reembolsos y la privacidad parten de plantillas para España (`lib/legal-templates.ts`) que la creadora puede adaptar o «Restaurar». No llevan su identidad dentro (se remiten al aviso legal), así que nunca se quedan desactualizados.
- **Checkout** (TRLGDCU arts. 98.7 y 103; RGPD art. 7). Bajo el email, la primera capa de privacidad («Responsable: …»). Junto al total, las sesiones dicen «Cambios gratis hasta 24 h antes» (`SESSION_CHANGE_NOTICE_HOURS`). Tres casillas sin marcar: las condiciones (con la renovación mensual o anual de las membresías), la renuncia al desistimiento, obligatoria para pagar todo lo que no es una sesión en directo (acceso inmediato al contenido digital, curso o membresía; «que se prepare ya» en «Lo preparo yo»; servicio dentro del plazo en un taller a menos de 15 días) y, opcional, las novedades por email. `lib/checkout-consents.ts` las valida y la acción del checkout las guarda en el pedido (`termsAcceptedAt`, `waiverKind`, `waiverText` literal, `waiverVersion` = versión de los textos + huella SHA-256, `waiverAcceptedAt`, `marketingOptIn`) antes de cobrar; `startOrderPayment` no cobra (con ninguna pasarela) un pedido sin condiciones o sin la renuncia vigente, y el recibo la confirma en soporte duradero.
- **Desistimiento y día 15** (`lib/withdrawal.ts`). El día de la compra es el día 0 (zona de la dueña); se puede desistir hasta las 23:59 del día 14. Las sesiones individuales que se pagan en la web solo ofrecen huecos desde las 00:00 del día 15 (y al menos 14 × 24 h después del pago): al comprar, al elegir la fecha después, al cambiarla y tras «Proponer otra fecha», siempre contando desde el pago del pedido. La antelación de esas sesiones va en días (mínimo 15, `Product.minNoticeHours` = días × 24; las de antes se leen como 15). Las sesiones dadas a mano no siguen la regla. Sin «Desistir» en lo digital con renuncia; con él en las sesiones y en los talleres a 15 días o más.
- **Versión aceptada** (`LegalSnapshot`, `lib/legal-snapshot.ts`). Cada pedido enlaza una copia fija de la identidad y los textos que aceptó, direccionada por contenido (sha256): solo se crea una fila nueva cuando la creadora cambia algo. Se ve en **/{usuario}/legal?v={id}** y el recibo la enlaza, repite quién vende, la renuncia marcada con su fecha y la política de cambios, y lleva las condiciones al final como copia en soporte duradero.
- **Novedades por email**. El consentimiento pasa a la clienta al pagar (`Customer.marketingOptIn` y su fecha); una compra posterior sin la casilla no lo retira. La creadora lo ve en Clientes («Novedades ✓») y la compradora lo retira en **/cuenta/perfil**.
- **Plataforma**: **/terminos** (con el encargo de tratamiento del art. 28 RGPD en `#encargo`), **/privacidad** (con las cookies) y **/aviso-legal**, con la identidad legal de Cirella de **/admin/ajustes** («Pendiente de completar» mientras falte). Las creadoras aceptan los términos en el paso 2 del onboarding (`Creator.termsAcceptedAt` y `termsVersion` = `PLATFORM_TERMS_VERSION`).
- **Visitas sin cookies** (LSSI art. 22.2). No hay cookie de visitante ni nada en `sessionStorage`: el visitante del día es `sha256(sal diaria + creadora + IP + navegador)` (`lib/visitor.ts`) y la sal (`AnalyticsSalt`) se borra a los dos días, así que nadie se puede seguir de un día a otro. «Visitantes únicos» cuenta personas distintas por día. La cookie `cv_id` de versiones anteriores se borra en la siguiente visita. **La IP sale de la cabecera que fija el proxy** (`CLIENT_IP_HEADER`, o el último valor de `X-Forwarded-For`; `lib/client-ip.ts`), la misma que usan los límites de intentos.

**Las plantillas, los textos de las casillas y las páginas de la plataforma son borradores: deben revisarse con una asesoría de consumo y protección de datos antes de lanzar.** Si cambian, sube `LEGAL_TEMPLATE_VERSION` o `PLATFORM_TERMS_VERSION` (`lib/legal.ts`).

### IVA y facturas

Todos los precios son **finales, con el IVA incluido**: el precio no cambia con el país de la compradora, cambia el IVA que contiene. La política de IVA se elige en **/admin/impuestos** (`taxMode`):

- **`PLATFORM_DIGITAL` (opción A, por defecto).** Cirella es la vendedora a efectos de IVA de los productos digitales, cursos y membresías (art. 9 bis del Reglamento 282/2011): repercute el IVA del país de la compradora (tabla de tipos generales de la UE en `lib/tax/rates.ts`, revisar cada enero), lo retiene en el cobro y lo declara en la ventanilla única (OSS). Las sesiones en directo las vende la creadora, y también los productos digitales que prepara ella a mano («Lo preparo yo», p. ej. una lectura personal): no son servicios electrónicos (art. 7 del mismo Reglamento: casi automáticos y con una intervención humana mínima). **Pendiente de confirmar con la asesoría** esa clasificación.
- **`CREATOR`.** Cada creadora vende sus productos y Cirella solo factura la cuota y la comisión.

Cuando vende la creadora, su IVA depende de su **situación de IVA** (tarjeta «IVA» de **/panel/ajustes**: no repercute, repercute o exenta con su motivo). Canarias, Ceuta y Melilla y los países fuera de la UE van al 0 % con su nota.

- **Núcleo puro** (`lib/tax`): `decideTax` (quién vende, país y tipo), `splitInclusive` (base + IVA = total), `computeSaleAmounts` (comisión sobre la base sin IVA; si vende Cirella, el IVA no es de la creadora), `decidePlatformServiceTax` (IVA de la cuota y la comisión: 21 % en España, inversión del sujeto pasivo a empresas de la UE, art. 69 fuera de la UE) y la validación de NIF, NIE y CIF.
- **Instantánea fiscal**: el pedido, el cobro (`Transaction`), la renovación y el reembolso guardan quién vende, país, tipo e IVA; el pedido, además, el país declarado, el país de la IP (cabecera de la CDN: segunda prueba de localización) y los datos de «Necesito factura con mi NIF». La suscripción guarda su pedido y el país para calcular el IVA de cada renovación.
- **Checkout**: «País de residencia» (sugerido por la IP o el idioma), desglose «IVA incluido · 13,71 € (21 %)» o «Precio final», y la casilla «Necesito factura con mi NIF» si la venta se puede facturar; si no, «Recibirás un justificante de compra por email». Fuera del modo demo no se vende lo que vende Cirella sin sus datos fiscales (los de **/admin/ajustes**, los mismos del aviso legal).
- **Facturas** (`Invoice`, `lib/invoices`): inmutables, con instantánea del emisor y del destinatario y numeración correlativa sin huecos por emisor, serie y año (`INSERT … ON CONFLICT … RETURNING` en la misma transacción que el cobro). Series: `V` (ventas de Cirella), `S` (cuotas y comisiones), `R` (rectificativas), `CIR`/`CIRR` (en nombre de cada creadora). Cada cobro y renovación emite la simplificada (F2) o la completa (F1) si se pidió con NIF; la compradora puede pedir después la completa desde el detalle de su compra (F3, sustituye a la simplificada) y cada reembolso emite su rectificativa (R1/R5) en negativo. Cuando vende una creadora sin IVA no hay factura: la compradora tiene un justificante imprimible («Este documento no es una factura»).
- **Factura mensual de Cirella** a cada creadora (serie `S`): cuota del plan y comisión de las ventas en las que vende ella. La emite el cron a partir del día 1 para el mes anterior (idempotente), se avisa por email y está en **/panel/plan** («Facturas de Cirella», con lo que lleva el mes en curso).
- **Dónde se ven**: `/facturas/[id]` (HTML A4 con «Imprimir o guardar en PDF»; lo abren la administración, la creadora y la compradora, también con la sesión limitada al pedido; al resto, 404), «Recibo y factura» en `/cuenta/pedidos/[id]` (enlazado desde «Mis compras» y desde el recibo, que lleva el IVA y el número de factura), y en **/panel/ventas**: «Recibes» sin el IVA que ingresa Cirella, la cifra de IVA y «Descargar CSV» con las columnas fiscales y el número de factura. Las métricas del panel siguen mostrando los ingresos con IVA.

**Pendiente de decidir con la asesoría fiscal** (el código no lo resuelve): la opción A o B por escrito (alta en OSS con el modelo 035, 369 trimestral, 303 y 349); los formatos de las exportaciones para la asesoría (libro registro de facturas, resumen OSS/369, tabla del 303: aún no se generan); Verifactu (servicio certificado o sistema propio antes de la fecha obligatoria; las facturas ya tienen `registryRef` y `registryQrUrl`, hoy vacíos); que la comisión se calcule sobre la base sin IVA y que con la opción A no se facture comisión por las ventas digitales; la facturación en nombre de la creadora (mandato en sus condiciones y art. 5 del RD 1619/2012); tipos reducidos (libros electrónicos, formación), ventas a empresas de la UE con validación VIES, IVA de países de fuera de la UE e IGIC/IPSI; el umbral de 10.000 € de las creadoras con IVA en modo `CREATOR`; y la conservación y anonimización de las facturas (una creadora con facturas no se puede borrar).

### Fiabilidad y monitorización

Ningún recibo, acceso ni error se pierde en silencio:

- **Outbox de eventos** (`OutboxEvent`, `lib/events.ts`). Los eventos de dominio se guardan en la misma transacción que el cambio de negocio (el pedido pagado y su «pago completado» se guardan juntos o no se guarda ninguno). Se procesan al momento tras el commit (`lib/event-handlers.ts`: primero los emails, después el calendario) y, si algo falla o el proceso cae, el cron los reintenta. Tras 6 intentos quedan descartados (DEAD), con alerta. Todos los handlers son idempotentes (los emails llevan `dedupeKey`; el calendario, `externalEventId`).
- **Bandeja de emails con reintentos** (`EmailMessage`, `lib/email/outbox.ts`). Cada envío se reclama con un UPDATE condicional (QUEUED → SENDING, lease de 2 min), así que nunca sale dos veces aunque el cron y la entrega en línea coincidan. Si el proveedor falla, se reintenta a 1 min, 5 min, 30 min, 2 h y 12 h; una dirección rechazada (400/422) no se reintenta. Tras 6 intentos queda «No entregado», con alerta. Resend recibe una `Idempotency-Key` por email.
- **Cron cada 5 min** (`/api/cron`, `lib/cron.ts`) con cerrojo (`JobLock`, un `INSERT … ON CONFLICT` atómico con lease de 10 min), que además hace de latido. Cada tarea aísla sus errores. Las renovaciones y las cuotas de plan son idempotentes (UPDATE condicional sobre el periodo + `Transaction.idempotencyKey` única).
- **Vigilante** (`lib/watchdog.ts`). Si la pasarela confirmó un cobro (`Order.chargedAt`) y el pedido sigue sin entregar a los 10 min, vuelve a entregarlo y avisa. Avisa también si un pago completado lleva 15 min sin recibo.
- **Monitorización** (`lib/monitoring.ts`). Sentry es opcional (`SENTRY_DSN`, región UE) y se carga solo con DSN: errores de servidor (`onRequestError` en `instrumentation.ts`), alertas agrupadas y Cron Monitor `cirella-cron` (avisa si pasan 20 min sin ejecutarse). A Sentry solo van ids, nunca emails ni cookies. `GET /api/health` comprueba la base de datos y el cron.
- **Páginas de error**: genéricas (`app/error.tsx`, `app/global-error.tsx`, panel y cuenta) y con la plantilla de la creadora en su página pública, el checkout y la confirmación, con un aviso tranquilizador tras pagar. Un producto retirado muestra un 404 con su marca y un enlace a su página.
- **`/admin/envios` («Envíos fallidos»)**: emails no entregados o en reintento y eventos con problemas, con «Reintentar ahora», «Descartar» y «Reprocesar», y el estado del cron. La portada de `/admin` avisa si hay algo que revisar. La creadora ve en Automatizaciones qué emails se están reintentando o no se han entregado.

### Límites de intentos

Los contadores viven en Postgres (`RateLimit`, `lib/rate-limit.ts`) y los comparten todas las instancias: ventana fija, un único `INSERT … ON CONFLICT` atómico por intento y limpieza oportunista de las filas vencidas. Las claves son un HMAC con `APP_SECRET`, así que no se guardan IP ni emails en claro (tampoco en `Order.ipHash`). Los umbrales son constantes de `lib/limits.ts`:

| Qué | Límite | Qué ve la persona |
|---|---|---|
| Login con contraseña | 5 intentos cada 15 min por email (se pone a cero al acertar) y 30 por conexión | «Demasiados intentos con este email. Espera… o entra con un enlace mágico». bcrypt se ejecuta siempre, con un hash ficticio si no hay cuenta, para no revelar qué emails la tienen |
| Enlace mágico (también «Reenviarme el enlace» y registrarse con un email que ya existe) | 3 por hora por email y 10 por conexión | «Ya te hemos enviado varios enlaces…» |
| Registro | 10 cuentas por hora por conexión | «Demasiados registros desde esta conexión…» |
| Checkout | 5 intentos cada 10 min por email y 20 por conexión (holgado por el CGNAT de las operadoras móviles) | «Demasiados intentos de pago…» |
| Pagos rechazados | Cloudflare Turnstile invisible a partir del 2.º rechazo (si está configurado) y bloqueo tras 5 en 10 min, por conexión o por email | Un pago pendiente no cuenta; los rechazos que llegan por el aviso de la pasarela cuentan con la IP del pedido. Si Cloudflare no responde, el pago pasa (con aviso en el log) y siguen los límites |
| Visitas (`/api/track`) | El mismo evento de la misma persona (IP + navegador) cuenta una vez cada 30 min; como mucho 300 eventos por hora por conexión y creadora | Nada: lo descartado responde 204 igual |
| Horarios (`/api/slots`) | 60 peticiones por minuto por conexión | 429 con `Retry-After`; el checkout avisa «No hemos podido cargar los horarios…» sin romperse |
| Subidas (`/api/upload/sign`) | 30 por hora por creadora en la plataforma y 120 en la web personal (se cuenta al pedir la URL de subida) | «Has subido muchos archivos en poco tiempo…» |
| Partes de una subida por partes (`/api/upload/parts`, solo web personal) | 600 por hora por creadora (un vídeo de 4 GB son 256 partes) | «Demasiadas partes en poco tiempo…» |

**Email de compra abandonada** (`lib/recovery-guard.ts`): solo sale si esa visitante abrió el checkout de ese producto en la página de esa creadora (`CHECKOUT_STARTED`), si no ha escrito más de 2 emails distintos (más de 5 desde la misma conexión) en 24 h y como mucho uno por destinatario cada 24 h. Así nadie puede usar pagos fallidos para mandar emails con el nombre de la creadora a direcciones ajenas. El motivo de cada email no enviado queda en `Order.recoverySkipped` (`sin-visita`, `sin-checkout`, `muchos-emails` o `ya-avisada`).

Configuración: `CLIENT_IP_HEADER` (obligatoria en producción), `APP_SECRET` (el HMAC de las claves) y, opcionales y siempre juntas, `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` (sin ellas no hay captcha, solo límites). **En producción la app debe ir detrás de un proxy que fije la IP y sobrescriba siempre esa cabecera: en Vercel, `CLIENT_IP_HEADER=x-real-ip`, sin Cloudflare como proxy delante** (Vercel deja pasar `cf-connecting-ip` y a la web se llega también por `*.vercel.app`, así que cualquiera podría inventársela; `cf-connecting-ip` solo sirve en un servidor al que únicamente se llega a través de Cloudflare). Con la cabecera equivocada todas las clientas compartirían contador; sin ella, se usa el último valor de `X-Forwarded-For`, que solo es fiable si lo añade tu proxy. Turnstile necesita `https://challenges.cloudflare.com` en `script-src`, `frame-src` y `connect-src`: la CSP lo añade sola cuando están las claves (`lib/security-headers.ts`). Fuera de producción, las peticiones desde la propia máquina (localhost) no cuentan por conexión, para que el desarrollo y las pruebas no agoten el cupo; los límites por email y por creadora sí se aplican.

**Pendiente de la fundadora**: crear el widget de Turnstile (gratis, modo «Invisible» o «Managed») para el dominio de producción; confirmar el proxy del despliegue para fijar `CLIENT_IP_HEADER`; revisar los umbrales (se recomienda subir las subidas a 60 por hora: montar un curso con muchas lecciones puede chocar con 30); y con la asesoría, incorporar a la privacidad el tratamiento de la IP con hash por seguridad (interés legítimo), Cloudflare como encargado del tratamiento por Turnstile y cuánto se conserva `Order.ipHash`.

### Almacenamiento e imágenes

Los archivos viven en disco (`./storage`) en desarrollo y en Cloudflare R2 (jurisdicción UE) en producción (`lib/storage/`), siempre detrás de URLs firmadas: los buckets son privados. El navegador sube directamente al almacenamiento en tres pasos (`/api/upload/sign` → `PUT` → `/api/upload/complete`) con un billete firmado que solo sirve para la carpeta de su creadora; máximo 1 GB por archivo y 25 MB por imagen en la plataforma (un solo PUT). En la web personal los vídeos admiten hasta 4 GB y todo lo de más de 64 MiB se sube por partes de 16 MiB (`/api/upload/parts`, 3 a la vez, con reintentos por parte y `/api/upload/abort` al cancelar). Tipos admitidos y límites: `lib/file-types.ts` (MP4, MOV, M4V, MP3, M4A, WAV, PDF, JPG, PNG, WebP, GIF, EPUB, ZIP; HEIC se rechaza explicando cómo exportarlo). Al completar una subida de vídeo o audio se leen su duración, su códec (H264/HEVC) y su tamaño ya girado (`lib/media-probe.ts`, solo cabeceras); `npm run media:probe` lo hace para los archivos de antes. Las imágenes se enderezan, pierden los datos EXIF/GPS y se convierten a WebP (máximo 1600 px) con variantes de 400, 800 y 1200 px que la página sirve con `srcset`. Las descargas comprueban el acceso y redirigen a un enlace temporal de 10 min (3 h para el vídeo y el audio de los cursos), sin pasar el archivo por la memoria del servidor. La página pública de cada creadora se cachea (ISR de 60 s); la vista previa del borrador está en `/vista-previa`.

**Lecciones por partes** (`LessonPart`, `lib/lesson-parts.ts`, `lib/lessons.ts`). Una lección es un solo paso del progreso y lleva, en el orden que elige la creadora, partes de tres tipos: texto (con formato), archivo de los materiales del curso (se ve según su tipo: vídeo, audio, PDF, imagen o botón de descarga) y enlace de YouTube/Vimeo; como mucho 12. Se editan en `/panel/productos/<id>/lecciones/nueva?modulo=…` y `/lecciones/<lessonId>`: subir desde el dispositivo (MOV y MP4 del iPhone, M4A de Zoom, PDF, JPG/PNG), elegir de los materiales o pegar un enlace; las subidas van en cola y quedan al momento en «Materiales del curso». Si Safari recarga la pestaña se ofrece el borrador local, y `Lesson.version` evita pisar lo guardado desde otro dispositivo. La alumna ve arriba el vídeo con el que empieza la lección y el resto en orden, con un solo reproductor sonando a la vez. Las columnas de antes de `Lesson` (`kind`, `body`, `bodyFormat`, `fileId`, `mediaUrl`) se siguen escribiendo como copia de compatibilidad durante una versión (por si hay que volver atrás) y nadie las lee; la migración `20261018120000_lecciones_por_partes` pasó las lecciones de antes a partes.

**Visores** (`components/media`, punto de entrada `MediaView`): el vídeo usa la URL firmada de 3 h y la renueva solo (`/api/download/[id]?inline=1&format=json`); el PDF (pdf.js 6.3.289, recursos copiados a `public/assets/pdfjs/<versión>/` por `prebuild`/`predev`), las imágenes privadas y el audio de la web personal llegan por `GET /api/stream/[fileId]`, desde la misma web, comprobando el acceso en cada petición con Range (tramos de 8 MiB, tipo de la lista, `nosniff`, CORP `same-origin`, CSP `sandbox`). El visor de un archivo comprado es `/cuenta/archivos/[fileId]`. Los enlaces de YouTube y Vimeo se incrustan con `lib/video-embed.ts` (youtube-nocookie, código de privacidad de Vimeo y `dnt=1`); otro enlace se abre fuera («Abrir el vídeo»).

**Calendario de Reservas** (`app/panel/reservas/calendar.tsx`, datos en `lib/calendar-diary.ts`): el cielo sale de `lib/astro-calendar.ts` (astronomy-engine 2.1.19, MIT; geocéntrico y tropical; Quirón, Ceres, Palas, Juno, Vesta y Eris de tablas de JPL Horizons 2000–2050 generadas con `scripts/gen-body-tables.ts`; Nodo Norte y Lilith medios con las fórmulas de Meeus). Nada de esto consulta servicios de fuera en marcha.

**Texto con formato** (`lib/rich-text.ts`, «MD» al estilo de WhatsApp): `**negrita**`, `_cursiva_`, `## encabezado`, listas, citas, líneas, `[texto](enlace)` e imágenes propias. Se edita con `RichTextEditor` y se pinta con `RichContent` (web) o `richToEmailHtml` (emails, con el dominio real de cada enlace). Cada campo tiene su columna `…Format`: null = texto de antes, que se pinta exactamente igual que siempre.

---

## Pruebas

```bash
npm run test:unit               # funciones puras (scripts/unit-tests.ts y scripts/unit/*.test.ts)
npm run test:isolation          # aislamiento multi-tenant a nivel de datos y del almacenamiento (billetes de subida, también por partes)
npm run test:media              # límites de subida por modo, subida por partes, lectura de vídeos y audios y respuestas con Range
npm run test:rich-text          # columnas de formato, extractos en texto plano y email de bienvenida con formato por la outbox
npm run test:lessons            # lecciones por partes: relleno de la migración, guardar (versión, mover, aislamiento), cascadas y progreso
npm run test:concurrency        # dos compras simultáneas del mismo hueco → una sola reserva confirmada; plazas de taller
npm run test:pages              # páginas extra y bloques: aislamiento, direcciones, saneamiento, borrador/publicado, pie, botón en la portada y el vídeo de la página (web personal y plataforma)
npm run test:community          # comunidad: cursos incluidos, fin de acceso (cron y en cada visita), publicaciones programadas, adjuntos, avisos por email, bajas, comentarios y «me gusta»
npm run test:calendar           # calendario propio: fechas especiales, horizonte, horas guardadas al pagar, zona de la clienta, avisos, talleres, sesiones dadas a mano y entregas
npm run test:calendar-diary     # calendario de Reservas: notas del diario y lo de cada día del mes (con aislamiento)
npm run test:reliability        # reintentos de emails, outbox de eventos, cerrojo del cron, renovaciones idempotentes, vigilante
npm run test:payments           # entrega única ante avisos repetidos, guardián de importe, renovaciones fallidas, cuenta de cobro y DAC7
npm run test:refunds            # reembolsos (a la vez, pendientes, fallidos, avisos de la pasarela), desistimiento y cambios de reserva
npm run test:withdrawal         # desistimiento: renuncia obligatoria con cada pasarela, día 15 al comprar, elegir, cambiar y proponer fecha, sesiones a mano y talleres
npm run test:legal              # sin datos legales no se vende, sin condiciones no se cobra, versión aceptada, recibo, novedades y sal diaria
npm run test:invoices           # IVA del pedido y del cobro, F1/F2/F3/R1 y CIR, renovaciones, factura mensual y bloqueo sin datos de la empresa
npm run test:delivery           # nada publicado sin entrega: borrador por defecto, archivos/enlaces/lecciones, borrar el último y avisos del panel
npm run test:limits             # límites de intentos: contador atómico, login, enlaces, captcha y bloqueo del checkout, visitas y email de recuperación
npm run test:access             # enlaces mágicos (un solo uso, recuperación de la cuenta, «Sí/No he sido yo»), enlaces personales y limpieza
npm run test:optout             # baja de los recordatorios: cabeceras List-Unsubscribe, baja en un clic (POST), solo el hash del email y la carrera con el envío
npm run test:seed-guard         # el seed no borra BD reales; datos base idempotentes; admin:promote
npm run build && npm run test:startup   # `next start` no arranca con una configuración de producción insegura
npm run build && npm run test:e2e   # flujo completo en un iPhone simulado
```

Las pruebas de aislamiento (que incluyen la numeración de facturas a la vez y que la demo no publica nada vacío), concurrencia, fiabilidad, pagos, reembolsos, acceso, legales, facturas, entrega, límites, baja de recordatorios y e2e usan el Postgres de `.env` con la demo sembrada (`npm run db:reset`). `test:seed-guard` crea y borra su propia base de datos (`cirella_guardtest`) en ese mismo Postgres. Playwright arranca `next start` con `APP_ENV=test`, modo demo y pagos simulados.

La prueba e2e recorre: landing → registro → onboarding de 10 pasos (con los términos y los datos legales) → publicar → compra como invitada → «Tu compra» (solo ese pedido) → la venta aparece en el panel → la clienta de demo ve su curso al 43 %, su sesión y su PDF → Ana no puede abrir datos ni archivos de María. También cubre casos que fallaron en la revisión: registrarse con el email de otra compradora no da acceso a su cuenta, el menú «Más» del panel móvil, no pagar dos veces la misma membresía y reintentar un pago rechazado cambiando de hora. `e2e/entorno-demo.spec.ts` comprueba que el buzón `/dev/correo` solo lo ve la administradora, `e2e/infra.spec.ts` la subida directa, las imágenes WebP sin EXIF, las descargas firmadas, las cabeceras de seguridad y el peso de la página pública, `e2e/pagos.spec.ts` la confirmación en el banco (3DS), el pago pendiente, cancelar y reintentar, los estados de la cuenta de cobro, «Pagar ahora» de una renovación y los datos e informe de DAC7, `e2e/reembolsos.spec.ts` cancelar y reembolsar una sesión (con y sin aceptar la confirmación), proponer otra fecha, un reembolso parcial y el desistimiento de una clienta, y `e2e/fiabilidad.spec.ts` que un fallo del email no rompe la compra, que el envío aparece en el panel y en `/admin/envios` (reintentar y descartar), las páginas de error y 404 con la marca de la creadora y `/api/health`, y `e2e/acceso-cuenta.spec.ts` que la sesión de una compra solo abre ese pedido, que un GET no gasta el enlace mágico, el enlace personal del recibo (y su caducidad con marca), el login con la marca de la creadora, «Crea tu contraseña», «No he sido yo» / «Sí, he sido yo», que cambiar la contraseña cierra las demás sesiones y el aviso de enlace de otra cuenta, y `e2e/legal.spec.ts` quién vende y la privacidad en el checkout, las casillas obligatorias sin marcar, el recibo con la versión aceptada, la política de cambios de las sesiones, el pie y la página legal de la creadora, las páginas legales de la plataforma, que las visitas no dejan cookies ni nada en el navegador, los datos y textos legales del panel y retirar las novedades desde la cuenta, y `e2e/iva-facturas.spec.ts` las etiquetas «IVA incluido», una compra con «Necesito factura con mi NIF» (con un NIF mal escrito antes), una compra desde Francia con su simplificada y la factura que la sustituye, el justificante de una sesión sin IVA, que nadie abre una factura ajena, las facturas de Cirella, la situación de IVA y el CSV del panel y la política de IVA del admin, y `e2e/entrega.spec.ts` el paso «¿Cómo lo entregas?» del onboarding (subir un archivo, poner un enlace, «Lo preparo yo para cada clienta» con su compra, y «Lo añado más tarde», que deja el producto en borrador, fuera de la página y con aviso en el panel), que el editor no publica un producto sin entrega ni deja borrar lo último que entrega, y los textos honestos de la ficha y el checkout, `e2e/lecturas.spec.ts` (web personal con cobros) una reserva desde Bogotá con sus datos de nacimiento, la reserva en el panel con el cambio de enlace de Zoom, una fecha especial en hora de Bali, «Dar una sesión o lectura» con los datos que completa la clienta, la entrega de una lectura grabada y un taller que se llena, y `e2e/limites.spec.ts` el corte tras 5 contraseñas erróneas y tras 3 enlaces mágicos, el bloqueo del checkout tras 5 pagos rechazados (sin afectar a otra compradora y sin captcha si no hay claves de Turnstile) y que un 429 de los horarios no rompe el checkout. Si Playwright no encuentra Chromium, indica la ruta con `PW_CHROMIUM_PATH`.

---

## Decisiones tomadas

- **El plan Free puede vender productos digitales.** El briefing sitúa «Productos digitales» en Creator, pero sin ello el plan gratuito no podría validar el flujo de venta. Las sesiones quedan en Creator y los cursos y membresías en Pro, y todo es configurable desde el admin.
- **Datos de la demo.** Se han creado 3 clientas, 2 reservas y los 6 productos pedidos. Para que el área de cliente coincida con el ejemplo del briefing (un curso al 43 %, una sesión a las 17:00 y el PDF de Gene Keys), Laura tiene 3 compras, así que Ana tiene 5 pedidos (y María, 1).
- **Fechas de la demo relativas al día en que se siembra** (`prisma/demo-dates.ts`): las compras caen en los días anteriores y las reservas siempre están por venir. La sesión de Laura es el primer día con horario de Ana (L–J por la tarde) a partir de dentro de 3 días, a las 17:00; la de Carmen, el siguiente día con horario, a las 10:00; los días bloqueados («Retiro de otoño»), dentro de dos semanas. Los recordatorios programados son los de esas fechas. Las pruebas e2e calculan la fecha esperada con la misma regla.
- **Ventas de la demo con IVA** (`prisma/demo-sales.ts`): se calculan con las mismas funciones que el checkout (`decideTax` y `computeSaleAmounts`: IVA incluido y comisión sobre la base) y cada cobro tiene su factura (`issueSaleInvoiceTx`): simplificada de Cirella para lo digital y en nombre de Ana para sus sesiones. Una venta sembrada de «Gene Keys» muestra el mismo «Recibes» que una nueva.
- **La Lectura de Human Design es una sesión** (como en el ejemplo «Mis sesiones») y la Lectura de Astrología y Gene Keys son productos digitales.
- **Imágenes generadas**, sin fotos de terceros: `scripts/generate-demo-images.py` crea la luna, el eclipse, las nebulosas, el bodygraph y el hexagrama. El seed genera además PDF, audio y vídeo reales para las descargas y el curso.
- **Las sesiones se pueden reservar antes o después de pagar:** la clienta elige hora en el checkout o marca «elegir la fecha después» y reserva desde su cuenta.
