# Tu web personal con Cirella («modo personal»)

Esta guía es para poner Cirella en internet **solo para ti**: una única web, tu enlace de la bio,
sin comisiones, sin planes, sin IVA y sin cobros dentro de la web. Está escrita para hacerla sin
saber programar. Calcula **una tarde** la primera vez y ve paso a paso: cada apartado termina
con una comprobación para que sepas que va bien.

> **Nada del resto de Cirella se borra.** El modo personal es un interruptor
> (`SITE_MODE=personal`). Si un día quieres abrir la plataforma a otras creadoras, se cambia el
> interruptor y todo lo demás sigue ahí (último apartado).

---

## Qué tendrás

- **Tu página en la raíz de tu dominio** (`https://tudominio.com`): tu foto, tus enlaces, tus
  bloques de texto (sobre mí, servicios…), tus productos, tus publicaciones y tus códigos de
  descuento. Es el enlace que pones en Instagram, TikTok o Telegram.
- **Cursos y contenidos gratis con email**: la persona deja su nombre y su email, entra al
  momento y le llega un email con su enlace de acceso.
- **Productos de pago que se cobran fuera** (Hotmart, PayPal, Bizum, Calendly…): la ficha
  enseña el precio y un botón que lleva a esa web. Si el contenido está alojado aquí (por ejemplo
  un curso), desde tu panel le das acceso a quien te haya pagado.
- **Publicaciones con fecha** (novedades, tipo blog) y **códigos de descuento** de otras marcas,
  con botón «Copiar código».
- **Tu panel** (`/panel`) para gestionarlo todo desde el móvil, y una **administración** mínima
  (`/admin`) para ver si algún email no ha llegado.

Lo que **no** hay en modo personal: registro de otras creadoras, planes, comisiones, IVA,
facturas, Stripe, el «Powered by Cirella» ni las páginas legales de la plataforma. Tu web enseña
tu nombre (el de tu página) en todas partes.

---

## Qué cuesta

| Servicio | Para qué | Precio para empezar |
|---|---|---|
| **Neon** | La base de datos (tus productos, alumnas, publicaciones…) | Gratis (plan Free) |
| **Cloudflare R2** | Fotos y archivos (PDF, audios…) | Gratis hasta 10 GB (pide una tarjeta para activarlo, pero no cobra si no pasas del límite) |
| **Resend** | Los emails (enlaces de acceso, avisos) | Gratis hasta 3.000 emails al mes (máximo 100 al día) |
| **Vercel** | Donde vive la web | Gratis (plan Hobby) — lee el aviso de abajo |
| **cron-job.org** | Despertar las tareas automáticas cada 15 minutos | Gratis |
| **Tu dominio** | `tudominio.com` | Lo que cueste en tu proveedor (unos 10–15 € al año) |

> **Aviso sobre Vercel Hobby.** Las condiciones de Vercel dicen que el plan gratuito es para uso
> personal y **no comercial**. Si tu web es la de tu negocio (aunque cobres fuera), lo correcto
> según sus condiciones es el plan **Pro** (unos 20 $ al mes). Revísalo antes de decidir; todo lo
> demás de esta guía es igual en los dos planes.

**Vídeos de los cursos:** súbelos a **YouTube como «oculto»** o a **Vimeo** y pega el enlace en
la lección. Así no pagas almacenamiento ni ancho de banda por los vídeos (R2 gratis llega de sobra
para fotos y PDF).

---

## Antes de empezar

1. Abre una **nota segura** (o tu gestor de contraseñas). Durante la guía vas a copiar unos
   cuantos valores (direcciones, claves); apúntalos ahí con su nombre en MAYÚSCULAS tal y como
   aparecen en esta guía. **No los compartas ni los pegues en ningún sitio público.**
2. Decide tu **usuario**: una palabra en minúsculas, sin espacios ni acentos (por ejemplo
   `analuna`). Es interno: tus productos estarán en `tudominio.com/analuna/nombre-del-producto`.
   En esta guía lo llamamos `OWNER_USERNAME`.
3. Ten a mano tu **dominio** (si aún no tienes, cómpralo en tu proveedor favorito o en la propia
   Vercel al llegar a ese paso).
4. Crea una cuenta en **GitHub** (github.com) si no tienes. La persona que tiene el código de
   Cirella te lo pasará a tu cuenta (un *fork* o una copia del repositorio). Vercel lo leerá de ahí.

---

## Paso 1 · Base de datos (Neon)

1. Entra en [neon.tech](https://neon.tech) y crea una cuenta.
2. Pulsa **New Project**:
   - *Project name*: el que quieras (por ejemplo `mi-web`).
   - *Postgres version*: **16**.
   - *Region*: **AWS Europe Central 1 (Frankfurt)**. Así tus datos se quedan en la Unión Europea.
3. Cuando esté creado, pulsa **Connect** (arriba a la derecha). Verás una dirección que empieza
   por `postgresql://`.
   - Con la opción **Connection pooling** activada, copia la dirección, añádele al final
     `&pgbouncer=true` (si ya lleva `?sslmode=require`) y apúntala como **`DATABASE_URL`**.
   - Desactiva **Connection pooling**, copia la dirección otra vez (ahora sin `-pooler` en el
     nombre) y apúntala como **`DIRECT_URL`**.

**Comprobación:** tienes dos direcciones que empiezan por `postgresql://`; la de `DATABASE_URL`
lleva `-pooler` y termina en `pgbouncer=true`.

---

## Paso 2 · Archivos (Cloudflare R2)

1. Entra en [cloudflare.com](https://dash.cloudflare.com) y crea una cuenta. En el menú de la
   izquierda abre **R2 Object Storage** y actívalo (te pedirá una tarjeta; con el uso de una web
   personal no se cobra nada).
2. **Create bucket**:
   - *Name*: `mi-web-archivos` (o el que quieras). Apúntalo como **`S3_BUCKET`**.
   - *Location*: **Specify jurisdiction → European Union (EU)**.
3. En la página de R2, a la derecha, copia el **Account ID**. Tu dirección es
   `https://<Account ID>.eu.r2.cloudflarestorage.com` (fíjate en el `.eu.`). Apúntala como
   **`S3_ENDPOINT`**.
4. **Manage API tokens → Create API token**:
   - *Permissions*: **Object Read & Write**.
   - *Specify bucket*: solo el bucket que acabas de crear.
   - Al crearlo verás dos claves que **solo se muestran una vez**: *Access Key ID* →
     **`S3_ACCESS_KEY_ID`** y *Secret Access Key* → **`S3_SECRET_ACCESS_KEY`**.
5. Abre tu bucket → **Settings → CORS Policy → Add CORS policy** y pega esto, cambiando
   el dominio por el tuyo:

   ```json
   [{ "AllowedOrigins": ["https://tudominio.com"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```

   Sin esto, las fotos y archivos no se podrán subir desde tu panel.
6. En **Settings → Object lifecycle rules → Add rule**: prefijo `incoming/`, borrar a **1 día**
   (son fotos que se empezaron a subir y no se terminaron).
7. No actives el acceso público del bucket: la web sirve las imágenes ella misma.

**Comprobación:** tienes `S3_ENDPOINT` (con `.eu.`), `S3_BUCKET`, `S3_ACCESS_KEY_ID` y
`S3_SECRET_ACCESS_KEY`.

---

## Paso 3 · Emails (Resend)

1. Entra en [resend.com](https://resend.com) y crea una cuenta.
2. **Domains → Add Domain**: escribe tu dominio y elige la región **Ireland (eu-west-1)**.
3. Resend te enseña unos registros DNS (tipo TXT y MX). Cópialos en el panel de tu proveedor de
   dominio (apartado «DNS»). Vuelve a Resend y pulsa **Verify**. Puede tardar unos minutos (a
   veces una hora).
4. **API Keys → Create API Key** (permiso *Sending access*). Apunta la clave como
   **`RESEND_API_KEY`** (empieza por `re_`).
5. Decide el remitente de tus emails y apúntalo como **`EMAIL_FROM`**, con tu nombre y una
   dirección de tu dominio, así: `Ana Luna <hola@tudominio.com>`.

**Comprobación:** el dominio aparece como **Verified** en Resend.

---

## Paso 4 · Dos claves secretas

La web necesita dos claves largas y aleatorias, **distintas entre sí**:

- **`APP_SECRET`**: firma los enlaces personales de acceso.
- **`CRON_SECRET`**: protege las tareas automáticas.

Genera cada una con tu gestor de contraseñas (64 caracteres, solo letras y números) o, si
tienes un ordenador con Mac o Linux, con el comando `openssl rand -hex 32` en la Terminal.
Tienen que tener **al menos 32 caracteres**.

---

## Paso 5 · La web (Vercel)

1. Entra en [vercel.com](https://vercel.com) con tu cuenta de GitHub.
2. **Add New → Project** → elige el repositorio de Cirella → **Import**. Antes de pulsar
   *Deploy*, abre **Environment Variables** y añade estas, una a una (*Key* a la izquierda,
   *Value* a la derecha):

| Variable | Valor |
|---|---|
| `APP_ENV` | `production` |
| `APP_URL` | `https://tudominio.com` (sin barra al final) |
| `SITE_MODE` | `personal` |
| `OWNER_USERNAME` | tu usuario (paso «Antes de empezar»), p. ej. `analuna` |
| `PAYMENT_PROVIDER` | `none` |
| `DEMO_MODE` | `false` |
| `DATABASE_URL` | la de Neon con pooler (paso 1) |
| `DIRECT_URL` | la de Neon sin pooler (paso 1) |
| `APP_SECRET` | la primera clave del paso 4 |
| `CRON_SECRET` | la segunda clave del paso 4 |
| `EMAIL_PROVIDER` | `resend` |
| `RESEND_API_KEY` | la de Resend (paso 3) |
| `EMAIL_FROM` | p. ej. `Ana Luna <hola@tudominio.com>` |
| `STORAGE_DRIVER` | `s3` |
| `S3_ENDPOINT` | la de R2 con `.eu.` (paso 2) |
| `S3_BUCKET` | el nombre del bucket (paso 2) |
| `S3_ACCESS_KEY_ID` | la de R2 (paso 2) |
| `S3_SECRET_ACCESS_KEY` | la de R2 (paso 2) |
| `CLIENT_IP_HEADER` | `x-real-ip` |

   No hacen falta las claves de Stripe ni de Turnstile.

3. Abre **Build and Output Settings** (o, después, *Settings → Build and Deployment*) y en
   **Build Command** activa *Override* y pega:

   ```bash
   npm run deploy && npm run build
   ```

   `npm run deploy` comprueba que la configuración está bien, prepara la base de datos y crea los
   datos base. Si falta o sobra algo, el despliegue se para y el registro (*Build Logs*) dice
   exactamente qué variable revisar.

   Después, en *Settings → Git → Ignored Build Step* elige *Custom* y pega esto, para que solo se
   publique la rama principal (las pruebas de otras ramas no tocan tu base de datos):

   ```bash
   if [ "$VERCEL_ENV" = production ]; then exit 1; else exit 0; fi
   ```
4. Pulsa **Deploy** y espera (unos 3–5 minutos).
5. **Dominio**: *Settings → Domains → Add* → escribe `tudominio.com` y sigue las instrucciones
   (Vercel te dice qué registro DNS poner en tu proveedor). Añade también `www.tudominio.com`
   para que redirija al principal.
6. En *Settings → Functions* comprueba que la región es **Frankfurt (fra1)** (el archivo
   `vercel.json` ya la elige).

**Comprobación:** el despliegue termina en verde. Si abres tu dominio verás una página de «no
encontrada»: es normal, tu cuenta todavía no existe (paso siguiente).

---

## Paso 6 · Crear tu cuenta

Esto se hace **una vez**, desde tu ordenador. Crea tu usuario (con tu contraseña), te hace
administradora, crea tu página publicada y te pone el plan «Personal» (comisión 0 y todas las
funciones). Se puede repetir sin miedo: no duplica nada (sirve también para cambiar la contraseña).

1. Instala **Node.js** (versión «LTS») desde [nodejs.org](https://nodejs.org).
2. Descarga el código: en GitHub, en tu repositorio, botón verde **Code → Download ZIP**.
   Descomprímelo en una carpeta.
3. Dentro de esa carpeta crea un archivo de texto llamado exactamente **`.env`** (con el punto
   delante, sin `.txt` al final; en el Bloc de notas de Windows, *Guardar como* → tipo *Todos los
   archivos*) con estas cinco líneas, con tus valores:

   ```bash
   DATABASE_URL="la de Neon con pooler"
   DIRECT_URL="la de Neon sin pooler"
   SITE_MODE="personal"
   OWNER_USERNAME="analuna"
   APP_URL="https://tudominio.com"
   ```

4. Abre una terminal en esa carpeta (Mac: clic derecho sobre la carpeta → *Nuevo terminal en la
   carpeta*; Windows: dentro de la carpeta, escribe `cmd` en la barra de direcciones y pulsa
   Intro) y escribe:

   ```bash
   npm install
   npm run personal:setup -- --email tu@email.com --name "Tu Nombre"
   ```

   Te pedirá una **contraseña** (mínimo 8 caracteres) dos veces. Mientras la escribes no se ve
   nada en la pantalla: es normal.
5. Verás tres líneas con ✓. **Borra el archivo `.env`** de tu ordenador cuando termines (tiene la
   dirección de tu base de datos).

**Comprobación:** entra en `https://tudominio.com/entrar` con tu email y tu contraseña. Llegas a
tu panel. Tu página ya se ve en `https://tudominio.com`.

> El usuario de tu página es el de `OWNER_USERNAME` y no se cambia desde el panel. Si algún día
> quieres otro, cambia la variable en Vercel, vuelve a ejecutar este paso con el mismo email y
> vuelve a desplegar.

---

## Paso 7 · Tareas automáticas (cron-job.org)

La web tiene tareas que se ejecutan solas: reintentar un email que falló, los recordatorios de
las sesiones, borrar los enlaces de acceso caducados… Vercel gratuito solo las lanza **una vez al día** (ya está configurado
en `vercel.json`), así que las despertamos cada 15 minutos con un servicio gratuito:

1. Crea una cuenta en [cron-job.org](https://cron-job.org).
2. **Create cronjob**:
   - *Title*: `Mi web`.
   - *URL*: `https://tudominio.com/api/cron`
   - *Execution schedule*: **Every 15 minutes**.
   - Pestaña **Advanced → Headers → Add**: *Key* `Authorization`, *Value* `Bearer ` seguido de tu
     `CRON_SECRET` (la palabra Bearer, un espacio y la clave).
3. Guarda y pulsa **Test run**: la respuesta tiene que ser **200**. Si dice 401, revisa la
   cabecera (la palabra `Bearer`, el espacio y la clave exacta).

**Comprobación:** en `https://tudominio.com/admin` no aparece el aviso «Las tareas automáticas
están paradas» (puede tardar 15 minutos en irse la primera vez).

---

## Paso 8 · Prepara tu página

Desde tu panel (`https://tudominio.com/panel`, también en el móvil):

1. **Ajustes → Datos legales**: tu nombre, NIF, dirección y email. Es obligatorio en una web
   con actividad profesional y sale en tu **aviso legal y privacidad**
   (`tudominio.com/<tu usuario>/legal`), que se enlaza en el pie de tu página. La privacidad
   parte de una plantilla que puedes adaptar; revísala con tu asesoría.
2. **Mi página**: foto, nombre, frase, enlaces, redes, bloques de texto (sobre mí, servicios…) y
   el diseño. El nombre de tu página es el que se ve en el login, el panel y los emails.
3. **Productos**: elige cómo se consigue cada uno:
   - **Gratis con email**: un curso, una guía, una meditación… La persona deja su nombre y su
     email y entra al momento.
   - **Pago en otra web**: pega el enlace (Hotmart, PayPal, Calendly…) y el texto del botón
     (por ejemplo «Comprar en Hotmart» o «Reservar en Calendly»). El precio es opcional. Si el
     contenido está aquí (un curso), en la ficha del producto usa **«Dar acceso a una persona»**
     cuando alguien te pague fuera: le llega un email con su acceso.
4. **Publicaciones**: tus novedades con fecha. En tu página salen las tres últimas.
5. **Códigos**: los descuentos de otras marcas (marca, código, descripción, enlace y, si
   quieres, caducidad). Los caducados se ocultan solos.
6. **Inscripciones**: quién se ha apuntado a qué.
7. Copia tu enlace (**Ajustes → Comparte tu página**) y ponlo en tu bio.

---

## Mantenimiento

- **Algún email no ha llegado**: `/admin` → **Envíos fallidos**. Desde ahí se reintenta.
- **¿Va todo bien?**: `https://tudominio.com/api/health` tiene que decir `"ok":true`. Si dice `"retrasado"`, la tarea automática no se está ejecutando: revisa el paso 7.
- **Copias de seguridad**: Neon guarda el historial de la base de datos (en el plan gratuito,
  pocas horas; en los de pago, días). Si borras algo por error, en Neon → *Branches* → *Restore*
  puedes volver a un momento anterior. Para tener una copia propia, ver «Copias de seguridad» en
  [despliegue.md](despliegue.md).
- **Actualizaciones**: cuando el código cambie en tu repositorio de GitHub, Vercel vuelve a
  desplegar solo (y aplica los cambios de la base de datos).

---

## Probarlo antes en tu ordenador (opcional)

Con los datos de demostración (la página de ejemplo de Ana Luna) y Postgres en local (ver el
README, «Puesta en marcha»), añade a tu `.env`:

```bash
SITE_MODE="personal"
OWNER_USERNAME="ana"
PAYMENT_PROVIDER="none"
```

y arranca con `npm run setup && npm run dev`. En `http://localhost:3000` verás la página de Ana
como portada; entra en `/entrar` con «Ana Luna» (acceso de demostración).

---

## Volver a la plataforma más adelante

Cuando quieras abrir Cirella a otras creadoras: en Vercel cambia `SITE_MODE` a `platform` (o
bórrala), configura Stripe (`PAYMENT_PROVIDER=stripe` y sus claves, ver
[pagos-stripe.md](pagos-stripe.md)), revisa los datos legales de la plataforma en `/admin` y
vuelve a desplegar. Tu página pasará a estar en `tudominio.com/<tu usuario>` y la portada será
la de la plataforma. Para el cron de cada 5 minutos que necesita la plataforma, ver
[despliegue.md](despliegue.md).
