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

En el hosting se definen las variables de la tabla [Configuración](#configuración) (nunca un `.env` copiado de local) y el paso de publicación ejecuta:

```bash
npm run deploy   # check:env → prisma migrate deploy → datos base (planes, categorías, diseños)
```

`deploy` no carga datos de ejemplo ni crea cuentas: solo añade los planes, categorías y diseños que falten, sin tocar lo editado en `/admin`. Nunca se ejecuta `npm run setup`, `db:seed` ni `db:reset` en producción (además se niegan). Necesita las dependencias de desarrollo (`prisma` y `tsx`) instaladas.

Para la cuenta de administración: regístrate de forma normal en `/registro` con el email elegido y después, en el servidor, `npm run admin:promote -- tu@email.com`. Ninguna contraseña pasa por la terminal ni existe ninguna cuenta `demo1234` en producción.

## Configuración

`lib/env.ts` es la única puerta a la configuración: ningún módulo lee las variables de `process.env` directamente (salvo `NODE_ENV`, que fija Next). Al arrancar (`instrumentation.ts`) se validan todas las variables y, si algo no encaja con el entorno, el proceso termina mostrando **todos** los problemas a la vez. `npm run check:env` hace la misma comprobación antes de desplegar (sin `APP_ENV`, valida como `production`).

`APP_ENV` puede ser `development`, `test`, `staging` o `production`. Si no se define, `next start` (NODE_ENV=production) cuenta como `production`. `staging` y `production` siguen las reglas de producción; en `development` y `test`, `APP_URL` tiene que ser local (localhost o red privada), para que un `.env` de desarrollo no pueda servir la web pública, y las claves live de Stripe están prohibidas.

| Variable | Producción | Notas |
|---|---|---|
| `APP_ENV` | `production` | Recomendado definirla de forma explícita. `staging` admite claves de prueba de Stripe: nunca con creadoras ni contenido reales. |
| `APP_URL` | Obligatoria | `https://`, dominio público y sin ruta (p. ej. `https://cirella.app`). Sin ella no hay valor por defecto. También se necesita al hacer `next build` (SEO y Open Graph). |
| `DATABASE_URL` / `DIRECT_URL` | Obligatorias | `postgresql://…`. La primera es la conexión de la aplicación (la del pooler, si lo hay); la segunda, la directa para las migraciones. |
| `DEMO_MODE` | Prohibido `true` | `"true"` o `"false"`. Con `true` en producción la app no arranca. |
| `PAYMENT_PROVIDER` | `stripe` | Obligatoria en todos los entornos, sin valor por defecto: si falta, las compras fallan en vez de entregarse gratis. `simulated` solo en local y pruebas. |
| `STRIPE_SECRET_KEY` · `STRIPE_PUBLISHABLE_KEY` · `STRIPE_WEBHOOK_SECRET` | Obligatorias | `sk_live_`/`rk_live_`, `pk_live_` y `whsec_` en producción; claves `_test_` en el resto. |
| `CRON_SECRET` | Obligatoria | 32+ caracteres aleatorios (`openssl rand -hex 32`). Token de `GET /api/cron`. |
| `APP_SECRET` | Obligatoria | 32+ caracteres aleatorios. Firma de enlaces y URLs de descarga. Fuera de producción hay una fija de desarrollo. |
| `EMAIL_PROVIDER` | `resend` | `log` (local, se ve en `/dev/correo`) o `resend`. Con `resend`: `RESEND_API_KEY` y `EMAIL_FROM` (dominio verificado en Resend). |
| `STORAGE_DRIVER` | `s3` | `local` (carpeta `STORAGE_DIR`, por defecto `./storage`) o `s3` (Cloudflare R2). Con `s3`: `S3_ENDPOINT` (https), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`; opcionales `S3_REGION` (`auto`) y `S3_PUBLIC_URL`. |
| `SENTRY_DSN` | Opcional | URL del proyecto de Sentry. |
| `TURNSTILE_SITE_KEY` · `TURNSTILE_SECRET_KEY` | Opcionales | Las dos o ninguna. |

### Cuentas de demostración

Contraseña de todas: `demo1234`. También hay botones de acceso rápido en **/entrar**.

| Cuenta | Rol | Qué ver |
|---|---|---|
| `ana@cirella.app` | Creadora · plan Pro | Panel, editor, productos, curso, reservas, estadísticas |
| `laura@example.com` | Clienta de Ana | «Hola, Laura»: curso al 43 %, sesión del 12 oct a las 17:00, PDF de Gene Keys |
| `admin@cirella.app` | Superadmin | Planes, comisiones, creadoras, ventas, reportes |
| `maria@cirella.app` | Creadora · plan Creator | Otro tenant (wellness, plantilla Minimal) |

### Recorrido sugerido

1. **`/`** · landing con precios leídos de la BD y una demo en vivo de Ana.
2. **`/ana`** · página pública (plantilla Mystical) → un producto → **checkout** (tarjeta `4242…`; `4000 0000 0000 0002` simula un rechazo) → «Compra completada» → **`/cuenta`**.
3. **`/registro`** · crea una creadora nueva: onboarding de 10 pasos → «Tu página está lista».
4. **`/panel`** (como Ana) · métricas «Este mes / Últimos 30 días / Total», editor visual con vista previa en vivo, productos por tipo, reservas, automatizaciones, plan, referidos.
5. **`/admin`** · todo lo de la plataforma: planes editables, comisiones, bloqueos, reportes CSV.
6. **`/dev/correo`** · buzón de demostración con todos los emails que «envía» la plataforma (recibos, enlaces mágicos, recordatorios programados), solo para la administradora: si entras sin sesión, ofrece entrar como superadmin y vuelve. El botón «Ejecutar tareas programadas» simula el cron.

Otras páginas de ejemplo: `/maria` (Minimal, plan Creator) y `/sofia` (Luxury, plan Free con «Powered by»).

---

## Qué incluye el MVP

El flujo **Instagram → página → producto → pago → entrega → clienta recurrente** funciona de extremo a extremo y está cubierto por pruebas automáticas.

| Área | Estado |
|---|---|
| Landing, registro, login con contraseña o enlace mágico | ✅ |
| Onboarding de 10 pasos + «Tu página está lista» con copiar / Instagram / WhatsApp / Telegram / ver página | ✅ |
| Página pública mobile-first con 5 plantillas, secciones activables y ordenables, SEO, Open Graph y favicon por creadora, Schema.org | ✅ |
| Productos: digital (archivos privados), sesión (duración, margen, antelación), curso (módulos y lecciones de vídeo, audio, PDF, texto o ejercicio), membresía (contenido privado) | ✅ |
| Checkout sin cuenta previa, cuenta automática o enlace mágico tras pagar | ✅ (pago simulado) |
| Área de cliente: compras, cursos con progreso, sesiones (elegir / cambiar fecha, .ics), membresías (cancelar / reactivar), archivos, perfil, soporte | ✅ |
| Reservas: disponibilidad semanal, días bloqueados, zona horaria, huecos libres en tiempo real | ✅ |
| Panel: ventas, ingresos, clientes, conversión, visitas, top productos, MRR, reservas, suscripciones | ✅ |
| Editor visual: foto, nombre, textos, colores, tipografía, fondo, portada, orden, botones, secciones, redes · Guardar / Vista previa / Publicar | ✅ |
| Analytics: visitas, visitantes únicos, vistas y clics de producto, checkouts, compras, conversión, ingresos, fuentes de tráfico | ✅ |
| Automatizaciones: arquitectura completa + 8 emails (bienvenida, compra, acceso al curso, confirmación y recordatorio de sesión, nueva suscripción, cancelación, compra abandonada) | ✅ (envío simulado) |
| Superadmin: creadoras, clientes, ventas, comisiones, transacciones, suscripciones, productos, planes, categorías, diseños, bloqueados, reportes | ✅ |
| Viral loop: «Powered by» con código de referido, programa de referidos con recompensa configurable | ✅ |

### Simulado en el MVP (con el punto de integración preparado)

| Pieza | Hoy | Para producción |
|---|---|---|
| Pagos | `lib/payments/simulated.ts` | Stripe Connect: implementar `lib/payments/stripe.ts` y llamar a `fulfillOrder()` desde el webhook |
| Emails | Bandeja `EmailMessage` + `/dev/correo` | Resend/Postmark dentro de `deliver()` en `lib/email/outbox.ts` |
| Calendario | `lib/calendar.ts` sin proveedor | Google Calendar: implementar `CalendarProvider` (freebusy + events.insert) |
| Archivos | Disco local (`STORAGE_DIR`) | S3/R2 manteniendo las funciones de `lib/storage.ts` |
| Cron | Botón en `/dev/correo` | Llamar a `GET /api/cron` con `Authorization: Bearer $CRON_SECRET` cada 5–15 min |

---

## Arquitectura

**Stack:** Next.js 15 (App Router, Server Components y Server Actions) · TypeScript · Prisma (PostgreSQL, Prisma Migrate) · Tailwind CSS 4 · Zod. Sin librerías de UI ni de gráficos: el bundle inicial ronda los 108 kB.

```
app/
  page.tsx                 landing
  (auth)/registro, entrar  autenticación
  onboarding/              asistente de 10 pasos y «Tu página está lista»
  [username]/              página pública, producto, checkout, gracias, OG image, favicon
  panel/                   panel de la creadora (tenant)
  cuenta/                  área de cliente
  admin/                   superadmin
  api/                     track, upload, download, slots, cron
  dev/correo/              buzón de demostración
components/
  creator-page/            renderizador de la página pública (también usado en la vista previa del editor)
lib/
  tenant.ts                aislamiento multi-tenant
  orders.ts                checkout y entrega automática
  plans.ts                 entitlements de los planes
  automations.ts           eventos de dominio → emails
  booking.ts, tz.ts        cálculo de huecos con zonas horarias
  templates.ts             sistema de diseño de las páginas públicas
  page-config.ts           esquema del contenido editable de la página
prisma/
  schema.prisma            modelo de datos
  migrations/              migraciones de Prisma Migrate (SQL)
  seed.ts                  datos de demostración
```

### Multi-tenant

Base de datos compartida con columna `creatorId` en **todas** las tablas de negocio (productos, archivos, lecciones, clientes, pedidos, transacciones, accesos, reservas, suscripciones, analytics, automatizaciones, emails), siempre indexada.

- **`tenantDb(creatorId)`** (`lib/tenant.ts`) es un cliente Prisma extendido que inyecta `creatorId` en el `where` de cada lectura, actualización, borrado, conteo y agregado, y en el `data` de cada creación. Todo el panel usa este cliente: aunque llegue un id manipulado (un producto de María en una petición de Ana) la consulta no encuentra nada.
- La identidad es global (`User`) y la relación comercial vive en `Customer`, una fila por cada par creadora–compradora. Si Carmen compra a Ana y a María, cada una ve solo su propia ficha de Carmen.
- El contenido de pago solo se sirve a través de `/api/download/[id]`, que comprueba un `Access` vigente o la propiedad del archivo.
- `npm run test:isolation` comprueba lecturas, agregados, actualizaciones, borrados y creaciones cruzadas. La prueba e2e lo verifica también por HTTP: 404 en el panel y 403 en las descargas ajenas.

### Monetización configurable

Precios, comisión, límite de productos y funcionalidades de cada plan son **datos** (`Plan.features` en JSON) que se editan en **/admin/planes**. Se pueden crear planes nuevos sin tocar código. La comisión se guarda como foto fija en cada pedido (`commissionBps`) y todo movimiento queda en el libro `Transaction` (cobros, renovaciones y cuotas de plan), así que cambiar el modelo no altera el histórico.

Valores iniciales (editables):

| Plan | Precio | Comisión | Productos | Incluye |
|---|---|---|---|---|
| Free | 0 € | 10 % | 3 | Productos digitales, métricas básicas, «Powered by» |
| Creator | 12 €/mes | 5 % | 15 | + reservas, personalización visual, estadísticas, sin marca |
| Pro | 29 €/mes | 2 % | Ilimitados | + cursos, membresías, área de clientes, automatizaciones, estadísticas avanzadas |

### Entrega automática

`fulfillOrder()` (`lib/orders.ts`) es idempotente y es el único punto que convierte un pago en acceso: marca el pedido, registra la transacción, crea la clienta del tenant y concede un `Access` (descarga o curso), una `Booking` (sesión) o una `Subscription` con acceso caducable (membresía). Después emite eventos de dominio que las automatizaciones convierten en emails.

Las reservas no se pisan aunque dos personas paguen el mismo hueco a la vez: la comprobación se hace dentro de la transacción bajo un cerrojo por creadora (`hasBookingClash` en `lib/booking.ts`), y la restricción `Booking_no_overlap` de Postgres impide dos reservas confirmadas solapadas aunque algún camino se salte el cerrojo. Quien llega tarde conserva su compra con la reserva pendiente de elegir fecha.

---

## Pruebas

```bash
npm run test:unit               # funciones puras (scripts/unit-tests.ts y scripts/unit/*.test.ts)
npm run test:isolation          # aislamiento multi-tenant a nivel de datos
npm run test:concurrency        # dos compras simultáneas del mismo hueco → una sola reserva confirmada
npm run test:seed-guard         # el seed no borra BD reales; datos base idempotentes; admin:promote
npm run build && npm run test:startup   # `next start` no arranca con una configuración de producción insegura
npm run build && npm run test:e2e   # flujo completo en un iPhone simulado
```

Las pruebas de aislamiento, concurrencia y e2e usan el Postgres de `.env` con la demo sembrada (`npm run db:reset`). `test:seed-guard` crea y borra su propia base de datos (`cirella_guardtest`) en ese mismo Postgres. Playwright arranca `next start` con `APP_ENV=test`, modo demo y pagos simulados.

La prueba e2e recorre: landing → registro → onboarding de 10 pasos → publicar → compra como invitada → cuenta creada automáticamente → la venta aparece en el panel → la clienta de demo ve su curso al 43 %, su sesión y su PDF → Ana no puede abrir datos ni archivos de María. También cubre casos que fallaron en la revisión: registrarse con el email de otra compradora no da acceso a su cuenta, el menú «Más» del panel móvil, no pagar dos veces la misma membresía y reintentar un pago rechazado cambiando de hora. `e2e/entorno-demo.spec.ts` comprueba que el buzón `/dev/correo` solo lo ve la administradora. Si Playwright no encuentra Chromium, indica la ruta con `PW_CHROMIUM_PATH`.

---

## Decisiones tomadas

- **El plan Free puede vender productos digitales.** El briefing sitúa «Productos digitales» en Creator, pero sin ello el plan gratuito no podría validar el flujo de venta. Las sesiones quedan en Creator y los cursos y membresías en Pro, y todo es configurable desde el admin.
- **Datos de la demo.** Se han creado 3 clientas, 2 reservas y los 6 productos pedidos. Para que el área de cliente coincida con el ejemplo del briefing (un curso al 43 %, una sesión el 12 de octubre a las 17:00 y el PDF de Gene Keys), Laura tiene 3 compras, así que hay 5 pedidos en total.
- **La Lectura de Human Design es una sesión** (como en el ejemplo «Mis sesiones») y la Lectura de Astrología y Gene Keys son productos digitales.
- **Imágenes generadas**, sin fotos de terceros: `scripts/generate-demo-images.py` crea la luna, el eclipse, las nebulosas, el bodygraph y el hexagrama. El seed genera además PDF, audio y vídeo reales para las descargas y el curso.
- **Las sesiones se pueden reservar antes o después de pagar:** la clienta elige hora en el checkout o marca «elegir la fecha después» y reserva desde su cuenta.
