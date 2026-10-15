# Despliegue de Cirella en producción (UE)

Guía para poner Cirella en marcha con datos reales: dónde vive cada cosa, qué cuentas hay que
crear, qué variables se configuran en cada entorno y cómo se recupera la base de datos si algo
sale mal. Todo queda alojado en la Unión Europea (Fráncfort).

La lista completa de variables y sus reglas está en el README, tabla «Configuración». Aquí se
explica de dónde sale cada valor.

---

## Arquitectura en producción

| Pieza | Servicio | Región | Para qué |
|---|---|---|---|
| Web y API | **Vercel** (plan Pro) | `fra1` (Fráncfort) | Next.js, tareas programadas (`/api/cron` cada 5 min) |
| Base de datos | **Neon** Postgres 16 | `aws-eu-central-1` (Fráncfort) | Todos los datos; restauración a cualquier momento de los últimos 7 días |
| Archivos | **Cloudflare R2** | Jurisdicción UE | Imágenes de las páginas, contenido de pago, copias manuales de la BD |
| Emails | Resend | UE (`eu-west-1`) | Emails transaccionales |
| Pagos | Stripe | — | Cobros y pagos a las creadoras (configuración: [pagos-stripe.md](pagos-stripe.md)) |

El servidor nunca guarda archivos en disco (Vercel no tiene disco persistente):

- **Subidas**: el navegador sube el archivo directamente a R2 con una URL firmada de 15 minutos;
  luego el servidor comprueba que llegó entero. Así se pueden subir vídeos de hasta 1 GB (Vercel
  no acepta peticiones de más de ~4,5 MB).
- **Imágenes** (avatar, portada, productos): se enderezan, se les quitan los metadatos (EXIF con
  la ubicación GPS de la foto) y se guardan en WebP con tres tamaños más pequeños para el móvil.
  Se sirven en `/media/…` con caché de un año en la CDN de Vercel.
- **Contenido de pago**: `/api/download/<id>` comprueba el acceso y redirige a un enlace temporal
  de R2 (10 minutos para descargar; 3 horas para ver un vídeo o audio del curso en la página).
- **Página pública de cada creadora** (`/ana`): cacheada 60 segundos (ISR). Al publicar o cambiar
  productos se refresca al momento. La vista previa del borrador está en `/vista-previa`.

---

## Base de datos (Neon)

1. Crea una cuenta en [neon.tech](https://neon.tech) y un proyecto:
   - Región: **AWS Europe Central 1 (Frankfurt)** — `aws-eu-central-1`.
   - Versión de Postgres: **16**.
   - Plan con **7 días de historial** (*history retention* / *restore window*). Es lo que permite
     volver a cualquier minuto de la última semana.
2. La rama principal (`main`) es **producción**. Crea otra rama llamada **`staging`** para el
   entorno de pruebas.
3. En *Connection details* copia dos cadenas de conexión de cada rama:
   - **Con pooler** (el host lleva `-pooler`) → `DATABASE_URL`. Añade al final
     `?sslmode=require&pgbouncer=true`. Sin `pgbouncer=true` Prisma falla con errores de
     *prepared statements*.
   - **Directa** (sin `-pooler`) → `DIRECT_URL`, con `?sslmode=require`. La usan las migraciones.

---

## Copias de seguridad

Dos capas:

1. **Restauración a un momento (Neon, automática)**: Neon guarda el historial de los últimos
   7 días. No hay que hacer nada para que funcione.
2. **Copia manual propia en R2**: `scripts/backup-db.sh` hace un `pg_dump` y lo sube al bucket
   `cirella-backups` (se borran solas a los 30 días con la regla de ciclo de vida). Hazla
   **antes de cada migración delicada** y **una vez al mes**. Necesita Docker y la CLI de AWS:

   ```bash
   BACKUP_DATABASE_URL="<DIRECT_URL de producción>" \
   BACKUP_S3_ENDPOINT="https://<cuenta>.eu.r2.cloudflarestorage.com" \
   BACKUP_S3_BUCKET="cirella-backups" \
   AWS_ACCESS_KEY_ID="<token de cirella-backups>" AWS_SECRET_ACCESS_KEY="<secreto>" AWS_DEFAULT_REGION="auto" \
   bash scripts/backup-db.sh
   ```

   (No hay copia nocturna automática en GitHub Actions: con la restauración de Neon basta para
   empezar. Si más adelante se quiere, el mismo script sirve para un trabajo programado.)

### Cómo restaurar

- **Volver atrás en el tiempo (lo normal)**: en Neon → *Branches* → `main` → *Restore* → elige
  fecha y hora (antes del problema). Neon guarda el estado anterior como una rama de respaldo por
  si te equivocas de minuto. La web sigue usando las mismas URLs de conexión.
- **Desde una copia manual**: descarga el `.dump` de `cirella-backups/db/` y ejecuta

  ```bash
  pg_restore --clean --if-exists --no-owner -d "<DIRECT_URL de destino>" cirella-AAAAMMDDTHHMMZ.dump
  ```

### Simulacro mensual (10 minutos)

1. En Neon crea una rama nueva desde `main` *en un momento de ayer* (p. ej. `simulacro-2026-11`).
2. Conéctate con `psql "<DIRECT_URL de esa rama>"` y comprueba datos recientes:
   `select count(*), max("createdAt") from "Order";`
3. Restaura además la última copia manual en otra rama vacía con `pg_restore` y repite la consulta.
4. Borra las ramas del simulacro. Apunta la fecha y el resultado.

---

## Archivos (Cloudflare R2)

1. En Cloudflare → R2 crea **tres buckets** con *Jurisdiction*: **European Union (EU)**:
   - `cirella-prod` (producción)
   - `cirella-staging` (pruebas)
   - `cirella-backups` (copias manuales de la base de datos)
2. **Tokens**: R2 → *Manage API tokens* → crea un token por bucket con permiso
   *Object Read & Write* **limitado a ese bucket**. De cada uno guarda el *Access Key ID* y el
   *Secret Access Key* (solo se muestra una vez).
3. **Endpoint**: el de la jurisdicción UE, `https://<id-de-cuenta>.eu.r2.cloudflarestorage.com`
   (fíjate en el `.eu.`). Va en `S3_ENDPOINT`.
4. **CORS** (para que el navegador pueda subir directamente). En `cirella-prod` → *Settings* →
   *CORS policy*:

   ```json
   [{ "AllowedOrigins": ["https://cirella.app"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```

   y en `cirella-staging` lo mismo con `https://staging.cirella.app`. Si cambias de dominio,
   actualízalo aquí o las subidas fallarán.
5. **Ciclo de vida** (*Object lifecycle rules*):
   - En `cirella-prod` y `cirella-staging`: borrar objetos con prefijo `incoming/` a **1 día**
     (fotos subidas que nunca se llegaron a procesar).
   - En `cirella-backups`: borrar todo a los **30 días**.
6. Los buckets son **privados**: no actives el acceso público ni un dominio público. Las imágenes
   se sirven a través de `/media/…` (con caché en Vercel) y el contenido de pago con enlaces
   temporales. `S3_PUBLIC_URL` no hace falta.

R2 no guarda versiones de los objetos: cuando una creadora borra un archivo de un producto, se
borra de verdad.

---

## Vercel

1. Plan **Pro** (el plan gratuito no permite uso comercial y solo ejecuta las tareas programadas
   una vez al día).
2. Importa el repositorio. En *Settings → Functions* la región debe ser **Frankfurt (fra1)**
   (`vercel.json` ya la fija, junto con la tarea programada de cada 5 minutos).
3. **Dominios**: `cirella.app` para producción y `staging.cirella.app` asignado a la rama
   `staging` (*Settings → Domains → Git Branch*).
4. **Comando de build** (*Settings → Build and Deployment → Build Command*):

   ```bash
   if [ "$VERCEL_ENV" = production ] || [ "$MIGRATE_ON_BUILD" = true ]; then npm run deploy; fi && npm run build
   ```

   `npm run deploy` comprueba la configuración, aplica las migraciones pendientes y crea los datos
   base que falten (planes, categorías, diseños). Así migran **producción** y **staging**.
   **Solo se despliegan `main` y `staging`**: en *Settings → Git → Ignored Build Step* pon

   ```bash
   if [ "$VERCEL_ENV" = production ] || [ "$VERCEL_GIT_COMMIT_REF" = staging ]; then exit 1; else exit 0; fi
   ```

   (con la convención de Vercel, `exit 0` se salta el build y `exit 1` construye). Las demás ramas
   no pueden arrancar: sin `APP_ENV` ni `APP_URL` cuentan como producción y no pasan la comprobación
   de la configuración (el build fallaría en cada push y mandaría un aviso de error).
5. **Variables de entorno** (*Settings → Environment Variables*). En *Production*, y en
   *Preview* limitadas a la rama `staging`:

| Variable | Production | Preview (rama `staging`) |
|---|---|---|
| `APP_ENV` | `production` | `staging` |
| `APP_URL` | `https://cirella.app` | `https://staging.cirella.app` |
| `DATABASE_URL` | Neon `main`, con pooler + `?sslmode=require&pgbouncer=true` | Neon `staging`, ídem |
| `DIRECT_URL` | Neon `main`, directa + `?sslmode=require` | Neon `staging`, ídem |
| `MIGRATE_ON_BUILD` | — | `true` |
| `PAYMENT_PROVIDER` | `stripe` | `stripe` |
| `STRIPE_SECRET_KEY` · `STRIPE_PUBLISHABLE_KEY` · `STRIPE_WEBHOOK_SECRET` | claves live | claves de prueba |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | secreto del endpoint de Connect (live) | ídem, de prueba |
| `STRIPE_ON_BEHALF_OF` | según decida la asesoría (`false` por defecto) | ídem |
| `APP_SECRET` | `openssl rand -hex 32` | otro distinto |
| `CRON_SECRET` | `openssl rand -hex 32` | otro distinto |
| `EMAIL_PROVIDER` | `resend` | `resend` |
| `RESEND_API_KEY` · `EMAIL_FROM` | clave de Resend · `Cirella <hola@cirella.app>` | ídem |
| `STORAGE_DRIVER` | `s3` | `s3` |
| `S3_ENDPOINT` | `https://<cuenta>.eu.r2.cloudflarestorage.com` | ídem |
| `S3_BUCKET` | `cirella-prod` | `cirella-staging` |
| `S3_ACCESS_KEY_ID` · `S3_SECRET_ACCESS_KEY` | token de `cirella-prod` | token de `cirella-staging` |
| `SENTRY_DSN` | opcional | opcional |
| `TURNSTILE_SITE_KEY` · `TURNSTILE_SECRET_KEY` | opcionales (las dos o ninguna) | ídem |
| `CLIENT_IP_HEADER` | `x-real-ip` | ídem |

   `APP_SECRET` firma los enlaces temporales y los billetes de subida: si se cambia, los enlaces
   ya enviados dejan de valer (no se pierde nada más).

   `CLIENT_IP_HEADER` es la cabecera de la que salen las IP para los límites de intentos (README,
   «Límites de intentos»). Tiene que ser una que la plataforma **sobrescriba siempre**: en Vercel,
   `x-real-ip`. No pongas Cloudflare como proxy delante de Vercel (en su DNS, nube gris, «DNS
   only»): Vercel no borra `cf-connecting-ip` y a la web se puede llegar sin pasar por Cloudflare
   (`*.vercel.app`), así que cualquiera podría inventarse esa cabecera y saltarse los límites; y
   con `x-real-ip` detrás de Cloudflare todas las clientas compartirían la IP de Cloudflare y se
   bloquearían entre ellas. `cf-connecting-ip` solo vale en un servidor al que únicamente se
   llega a través de Cloudflare.

6. Las **cabeceras de seguridad** (CSP) se calculan al construir con estas variables: si cambias
   `S3_ENDPOINT`, las claves de Stripe, Turnstile o Sentry, **vuelve a desplegar** para que la
   política las incluya.

Vercel llama a `/api/cron` con la cabecera `Authorization: Bearer $CRON_SECRET` automáticamente,
**solo en producción** (las tareas programadas de Vercel nunca se ejecutan en las
previsualizaciones, y staging lo es). Para staging, ver «Entorno de pruebas».

---

## Entorno de pruebas (staging)

- Rama `staging` del repositorio → `https://staging.cirella.app`, con su rama de Neon y su
  bucket de R2. Mismas reglas que producción (https, Stripe, Resend, R2) pero con claves de
  prueba de Stripe.
- Flujo: se fusiona en `staging`, se prueba allí con tarjetas de prueba de Stripe y, si todo va
  bien, se fusiona en `main` (producción).
- Para refrescar sus datos con los de producción: en Neon, *Reset from parent* sobre la rama
  `staging`. Ojo: los archivos de R2 no se copian, así que las imágenes y descargas antiguas no
  estarán en `cirella-staging`. Nunca se usa con creadoras ni clientas reales.
- El seed de demostración no se ejecuta nunca fuera de local (se niega).
- **La tarea programada no se ejecuta sola en staging**: Vercel Cron solo llama a producción.
  Prográmala fuera (GitHub Actions con `schedule: '*/5 * * * *'` o cron-job.org) con
  `curl -fsS -H "Authorization: Bearer $CRON_SECRET_STAGING" https://staging.cirella.app/api/cron`.
  Si la *Deployment Protection* de Vercel cubre las previsualizaciones, añade también la cabecera
  `x-vercel-protection-bypass: <secreto>`. Sin esto, en staging no salen los emails programados
  ni los reintentos, no se renuevan membresías y `/api/health` responde 503 («retrasado»).

---

## Migraciones

- En local, tras cambiar `prisma/schema.prisma`: `npm run db:migrate` (crea la migración en
  `prisma/migrations` y la aplica). Se suben al repositorio junto con el cambio.
- **Nunca se edita una migración ya aplicada** en staging o producción: se crea otra nueva.
- Antes de fusionar, `npm run db:check` comprueba que las migraciones y el esquema coinciden (ver
  README).
- En Vercel se aplican solas al desplegar producción y staging (paso 4 de «Vercel»). Para una
  migración delicada: haz antes una copia manual, pruébala en staging y despliega fuera de horas.
- La migración inicial crea, además del esquema, la regla `Booking_no_overlap`: la base de datos
  impide dos reservas confirmadas de la misma creadora a la misma hora.

---

## Desarrollo local

```bash
cp .env.example .env
npm install
npm run db:up      # Postgres 16 en Docker
npm run setup      # migraciones + datos de demostración
npm run dev
```

Los archivos se guardan en `./storage` (driver `local`), con las mismas URLs firmadas que R2:
`/api/storage/local?t=…`. Para probar con R2 en local, define `STORAGE_DRIVER=s3` y las
variables `S3_*` de un bucket de pruebas, y añade `http://localhost:3000` a su CORS.

---

## Subencargados del tratamiento (RGPD)

Para el aviso de privacidad y el registro de actividades. Con cada uno hay que aceptar su
acuerdo de encargo del tratamiento (DPA); son empresas de EE. UU., así que la transferencia se
cubre con las cláusulas contractuales tipo y el Marco de Privacidad de Datos UE-EE. UU.:

| Proveedor | Qué trata | Dónde |
|---|---|---|
| Vercel Inc. | Alojamiento de la web, registros de peticiones (IP) | Fráncfort (fra1) |
| Neon Inc. | Base de datos: cuentas, pedidos, clientas | Fráncfort (aws-eu-central-1) |
| Cloudflare Inc. | Archivos: imágenes y contenido de pago | Jurisdicción UE de R2 |
| Stripe Payments Europe Ltd. | Pagos y datos de cobro | UE (Irlanda) |
| Resend Inc. | Envío de emails (dirección, contenido) | UE (`eu-west-1`) |
| Functional Software Inc. (Sentry), si se activa | Errores de la aplicación | Región UE de Sentry |

---

## Lista de comprobación del primer despliegue

- [ ] Proyecto de Neon en Fráncfort con 7 días de historial; ramas `main` y `staging`.
- [ ] Buckets de R2 (UE) con tokens, CORS y reglas de ciclo de vida.
- [ ] Proyecto de Vercel Pro en `fra1` con dominios, comando de build y variables.
- [ ] `npm run check:env` en verde con las variables de producción.
- [ ] Primer despliegue: migraciones aplicadas y datos base creados (lo hace el build).
- [ ] Cuenta de administración: regístrate en `/registro` y ejecuta `npm run admin:promote -- tu@email`
      contra la base de datos de producción.
- [ ] Prueba completa en staging: subir una foto y un PDF, comprar con tarjeta de prueba,
      descargar, ver un vídeo del curso.
- [ ] Primera copia manual con `scripts/backup-db.sh` y primer simulacro de restauración.
- [ ] DPA firmados con Vercel, Neon, Cloudflare, Stripe y Resend.
