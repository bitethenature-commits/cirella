# Tu web personal con Cirella («modo personal»)

Esta guía es para poner Cirella en internet **solo para ti**: una única web, tu enlace de la bio,
sin comisiones ni planes. Primero la publicas sin cobros dentro de la web y, cuando quieras,
activas los cobros con tarjeta (Stripe) y PayPal con tus propias cuentas
([cobros-stripe-paypal.md](cobros-stripe-paypal.md)). Está escrita para hacerla sin
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
- **Cobros en tu web con tarjeta y PayPal** (cuando los actives, con tus cuentas de Stripe y
  PayPal): cursos, descargas, lecturas con fecha y membresías que se pagan aquí y se desbloquean
  solas, con su email, renovaciones y reembolsos ([cobros-stripe-paypal.md](cobros-stripe-paypal.md)).
- **Productos de pago que se cobran fuera** (Hotmart, Calendly…): la ficha
  enseña el precio y un botón que lleva a esa web. Si el contenido está alojado aquí (por ejemplo
  un curso), desde tu panel le das acceso a quien te haya pagado.
- **Publicaciones con fecha** (novedades, tipo blog) y **códigos de descuento** de otras marcas,
  con botón «Copiar código».
- **Tu propia newsletter** (sin MailerLite ni nada aparte): formulario en tu página, lista de
  suscriptoras con doble confirmación, campañas con un editor visual, y los emails automáticos
  (bienvenida, compra, recordatorios…) escritos con tus palabras ([Tu newsletter](#tu-newsletter)).
- **Tu panel** (`/panel`) para gestionarlo todo desde el móvil, y una **administración** mínima
  (`/admin`) para ver si algún email no ha llegado.

Lo que **no** hay en modo personal: registro de otras creadoras, planes, comisiones de la web,
el «Powered by Cirella» ni las páginas legales de la plataforma. Tu web enseña tu nombre (el de tu
página) en todas partes. El IVA y las facturas solo aparecen si activas los cobros en tu web.

---

## Qué cuesta

| Servicio | Para qué | Precio |
|---|---|---|
| **Railway** (plan Hobby) | Donde vive la web y la base de datos (tus productos, alumnas, publicaciones…), y la copia de seguridad diaria | 5 $ al mes, que incluyen 5 $ de uso; una web personal suele quedarse ahí |
| **Cloudflare R2** | Fotos, archivos (PDF, audios…), los vídeos si los subes y las copias de seguridad | Gratis hasta 10 GB; después, unos 0,015 $ por GB al mes, y descargar no cuesta nada (pide una tarjeta para activarlo, pero no cobra si no pasas del límite) |
| **Resend** | Los emails (enlaces de acceso, avisos) | Gratis hasta 3.000 emails al mes (máximo 100 al día) |
| **cron-job.org** | Despertar las tareas automáticas cada 5 minutos | Gratis |
| **Tu dominio** | `tudominio.com` | Lo que cueste en tu proveedor (unos 10–15 € al año) |

**Sobre Railway.** El plan Hobby cuesta 5 $ al mes, y esos 5 $ se van gastando en uso: lo que
consumen la web y la base de datos encendidas todo el mes. Si algún mes se gastara más, la
diferencia se cobra aparte; con una web personal y pocas visitas, lo normal es quedarse en esos
5 $. El plan gratuito de Railway (1 $ de crédito al mes) no llega. En el paso 4 pondrás un
**límite de gasto** (por ejemplo, 10 $) para que no haya sorpresas.

**Vídeos de los cursos:** lo más barato es subirlos a **YouTube como «oculto»** o a **Vimeo** y
pegar el enlace en la lección. Así no pagas almacenamiento por los vídeos (R2 gratis llega de
sobra para fotos y PDF). Si prefieres subirlos aquí, se guardan en R2: por ejemplo, 500 vídeos
de unos 200 MB son unos 100 GB, alrededor de 1,5 $ al mes.

---

## Antes de empezar

1. Abre una **nota segura** (o tu gestor de contraseñas). Durante la guía vas a copiar unos
   cuantos valores (direcciones, claves); apúntalos ahí con su nombre en MAYÚSCULAS tal y como
   aparecen en esta guía. **No los compartas ni los pegues en ningún sitio público.**
2. Decide tu **usuario**: una palabra en minúsculas, sin espacios ni acentos (por ejemplo
   `analuna`). Es interno: tus productos estarán en `tudominio.com/analuna/nombre-del-producto`.
   En esta guía lo llamamos `OWNER_USERNAME`.
3. Ten a mano tu **dominio**. Si aún no tienes, cómpralo en cualquier proveedor de dominios.
4. Crea una cuenta en **GitHub** (github.com) si no tienes. La persona que tiene el código de
   Cirella te lo pasará a tu cuenta (un *fork* o una copia del repositorio). Railway lo leerá de
   ahí. La copia tiene que incluir la rama **`main`**: si haces un *fork*, quita la marca de
   «Copy the … branch only» (o pide a quien te pasa el código que ponga `main` como rama
   principal antes).
5. Ten a mano una **tarjeta**: Railway y Cloudflare te la pedirán al darte de alta.

---

## Atajo: publícala primero sin dominio

Si aún no tienes dominio, o quieres verla funcionando antes de decidir, puedes publicarla en una
dirección gratuita de Railway (`algo.up.railway.app`) y añadir tu dominio más adelante. Sigue los
pasos normales con estos cambios:

- **Paso 1 (R2):** deja la regla CORS para el final del paso 5, cuando sepas tu dirección de
  Railway, y pon esa en `AllowedOrigins` (por ejemplo `"https://mi-web.up.railway.app"`).
- **Paso 2 (Resend):** crea la cuenta **con tu email** y salta lo del dominio (puntos 2 y 3). Crea
  la clave (punto 4) y usa este remitente, que funciona sin dominio:
  `EMAIL_FROM="Tu Nombre <onboarding@resend.dev>"`. Mientras no verifiques un dominio, Resend solo
  entrega emails **a tu propio email** (el de tu cuenta de Resend): pon ese en `OWNER_EMAIL`. Tú
  podrás entrar y probarlo todo; los emails a otras personas (por ejemplo, el de acceso a un curso
  gratis) no saldrán hasta que pongas el dominio.
- **Paso 5 (Railway):** antes de conectar el código, en **Settings → Networking** pulsa
  **Generate Domain** y copia la dirección que te da: es tu `APP_URL`
  (`https://mi-web.up.railway.app`, sin barra al final). Si todavía no te deja generarla, conecta
  el código igualmente, genérala, pon `APP_URL` y pulsa **Deploy** otra vez.
- **Salta el paso 6 (dominio)** y, si quieres, el 9 (copias) hasta que la uses de verdad. El paso 8
  (tareas automáticas) hazlo igualmente: son dos minutos.
- En todos los pasos, donde ponga `https://tudominio.com` usa tu dirección de Railway.

**Cuando tengas dominio:** haz el paso 6, verifica el dominio en Resend (paso 2, puntos 2 y 3) y
cambia en Railway `APP_URL` por `https://tudominio.com` y `EMAIL_FROM` por un remitente de tu
dominio; en R2 añade el dominio a la regla CORS, y en cron-job.org cambia la dirección. Pulsa
**Deploy** y listo: tu contenido sigue ahí.

---

## Paso 1 · Archivos (Cloudflare R2)

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
   el dominio por el tuyo (las dos veces: con y sin www):

   ```json
   [{ "AllowedOrigins": ["https://tudominio.com", "https://www.tudominio.com"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```

   Sin esto, las fotos y archivos no se podrán subir desde tu panel.
6. En **Settings → Object lifecycle rules → Add rule**: prefijo `incoming/`, borrar a **1 día**
   (son fotos que se empezaron a subir y no se terminaron).
   Añade otra regla, sin prefijo: **Abort incomplete multipart uploads** a **1 día** (los vídeos
   grandes se suben por partes; si una subida se corta y no se reintenta, sus partes se borran
   solas). La regla CORS de arriba no cambia: las partes también se suben con `PUT`.
7. No actives el acceso público del bucket: la web sirve las imágenes ella misma.

En el paso 9 crearás un segundo bucket, solo para las copias de seguridad.

**Comprobación:** tienes `S3_ENDPOINT` (con `.eu.`), `S3_BUCKET`, `S3_ACCESS_KEY_ID` y
`S3_SECRET_ACCESS_KEY`.

---

## Paso 2 · Emails (Resend)

1. Entra en [resend.com](https://resend.com) y crea una cuenta.
2. **Domains → Add Domain**: escribe tu dominio y elige la región **Ireland (eu-west-1)**.
3. Resend te enseña unos registros DNS (tipo TXT y MX). Cópialos en el panel de tu proveedor de
   dominio (apartado «DNS»). Vuelve a Resend y pulsa **Verify**. Puede tardar unos minutos (a
   veces una hora). Si en el paso 6 acabas llevando el DNS de tu dominio a Cloudflare, estos
   registros tendrán que estar también allí (te lo recordamos en ese paso).
4. **API Keys → Create API Key** (permiso *Sending access*). Apunta la clave como
   **`RESEND_API_KEY`** (empieza por `re_`).
5. Decide el remitente de tus emails y apúntalo como **`EMAIL_FROM`**, con tu nombre y una
   dirección de tu dominio, así: `Ana Luna <hola@tudominio.com>`.

**Comprobación:** el dominio aparece como **Verified** en Resend.

---

## Paso 3 · Dos claves secretas

La web necesita dos claves largas y aleatorias, **distintas entre sí**:

- **`APP_SECRET`**: firma los enlaces personales de acceso.
- **`CRON_SECRET`**: protege las tareas automáticas.

Genera cada una con tu gestor de contraseñas (64 caracteres, solo letras y números) o, si
tienes un ordenador con Mac o Linux, con el comando `openssl rand -hex 32` en la Terminal.
Tienen que tener **al menos 32 caracteres**.

**Comprobación:** tienes apuntadas `APP_SECRET` y `CRON_SECRET`, distintas y de al menos 32
caracteres cada una.

---

## Paso 4 · Railway: tu cuenta y la base de datos

1. Entra en [railway.com](https://railway.com) y crea una cuenta **con tu cuenta de GitHub**
   (así después podrá leer el código).
2. Elige el plan **Hobby** (5 $ al mes) y añade tu tarjeta.
3. **Pon un límite de gasto.** En los ajustes de tu espacio de trabajo (*workspace*), en el
   apartado de uso (*Usage*), pon un límite de, por ejemplo, **10 $** al mes. Si algún mes se
   llegara a él, Railway pararía la web en vez de seguir cobrando; con una web personal no
   debería pasar.
4. Crea un **proyecto nuevo** y, como primera pieza, añade la base de datos **PostgreSQL**
   (Railway la ofrece ya preparada, entre sus opciones de base de datos). En tu proyecto
   aparece un recuadro (un *servicio*) que se llama **Postgres**.
5. Abre **Postgres → Settings → Deploy → Region** y elige **EU West (Amsterdam)**: es la más
   cercana a España. Si en tu plan no aparece esa opción, deja la que venga: funciona igual,
   solo un poco más lento desde España. Si Railway te enseña arriba una barra con cambios
   pendientes, pulsa su botón **Deploy** para aplicarlos.

**Comprobación:** en tu proyecto está el servicio **Postgres** y, en su pestaña **Variables**,
aparecen (entre otras) `DATABASE_URL` y `DATABASE_PUBLIC_URL`. No hace falta copiarlas: la web
leerá la primera por su nombre (la segunda solo hace falta para la alternativa del paso 7).

---

## Paso 5 · La web (Railway)

**El orden importa.** Railway construye la web con sus variables, y algunas (como la dirección
de tu web) quedan grabadas al construirla. Por eso primero se ponen las variables y **al final**
se conecta el código.

1. En el mismo proyecto, usa el botón para añadir un servicio (arriba a la derecha, «+ Create» o
   «New») y elige **Empty Service** (un servicio vacío). Ábrelo y, en **Settings**, cámbiale el
   nombre a `web`.
2. Abre su pestaña **Variables**, pulsa **Raw Editor** (para pegarlas todas de una vez) y pega
   este bloque. Antes, cambia cada `PEGA_AQUI_…` por el valor que apuntaste con ese nombre, y
   `tudominio.com`, `analuna`, `tu@email.com`, `Ana Luna` y `mi-web-archivos` por los tuyos. Deja las comillas
   y no toques las líneas de `DATABASE_URL` y `DIRECT_URL`. Después, guarda.

   ```bash
   APP_ENV="production"
   APP_URL="https://tudominio.com"
   SITE_MODE="personal"
   OWNER_USERNAME="analuna"
   OWNER_EMAIL="tu@email.com"
   OWNER_NAME="Ana Luna"
   PAYMENT_PROVIDER="none"
   DEMO_MODE="false"
   DATABASE_URL="${{Postgres.DATABASE_URL}}"
   DIRECT_URL="${{Postgres.DATABASE_URL}}"
   APP_SECRET="PEGA_AQUI_TU_APP_SECRET"
   CRON_SECRET="PEGA_AQUI_TU_CRON_SECRET"
   EMAIL_PROVIDER="resend"
   RESEND_API_KEY="PEGA_AQUI_TU_RESEND_API_KEY"
   EMAIL_FROM="Ana Luna <hola@tudominio.com>"
   STORAGE_DRIVER="s3"
   S3_ENDPOINT="PEGA_AQUI_TU_S3_ENDPOINT"
   S3_BUCKET="mi-web-archivos"
   S3_ACCESS_KEY_ID="PEGA_AQUI_TU_S3_ACCESS_KEY_ID"
   S3_SECRET_ACCESS_KEY="PEGA_AQUI_TU_S3_SECRET_ACCESS_KEY"
   CLIENT_IP_HEADER="x-real-ip"
   ```

   Qué es cada una:

   | Variable | Valor |
   |---|---|
   | `APP_ENV` | `production` |
   | `APP_URL` | `https://tudominio.com`: tu dominio de verdad, sin barra al final |
   | `SITE_MODE` | `personal` |
   | `OWNER_USERNAME` | tu usuario (paso «Antes de empezar»), p. ej. `analuna` |
   | `OWNER_EMAIL` | tu email: con él entrarás en tu panel (paso 7) |
   | `OWNER_NAME` | tu nombre, el que se verá en tu página (lo puedes cambiar después) |
   | `PAYMENT_PROVIDER` | `none` (sin cobros en la web; cuando tengas Stripe y PayPal, `stripe,paypal`: ver [cobros-stripe-paypal.md](cobros-stripe-paypal.md)) |
   | `DEMO_MODE` | `false` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}`, escrito tal cual |
   | `DIRECT_URL` | `${{Postgres.DATABASE_URL}}`, la misma |
   | `APP_SECRET` | la primera clave del paso 3 |
   | `CRON_SECRET` | la segunda clave del paso 3 |
   | `EMAIL_PROVIDER` | `resend` |
   | `RESEND_API_KEY` | la de Resend (paso 2) |
   | `EMAIL_FROM` | p. ej. `Ana Luna <hola@tudominio.com>` |
   | `STORAGE_DRIVER` | `s3` |
   | `S3_ENDPOINT` | la de R2 con `.eu.` (paso 1) |
   | `S3_BUCKET` | el nombre del bucket (paso 1) |
   | `S3_ACCESS_KEY_ID` | la de R2 (paso 1) |
   | `S3_SECRET_ACCESS_KEY` | la de R2 (paso 1) |
   | `CLIENT_IP_HEADER` | `x-real-ip` |

   - `${{Postgres.DATABASE_URL}}` no es un valor que tengas que buscar: Railway lo rellena solo
     con la dirección interna de tu base de datos (por su red privada, así que las dos líneas
     llevan lo mismo). Si tu servicio de base de datos no se llama `Postgres`, cambia esa
     palabra por su nombre.
   - `CLIENT_IP_HEADER` le dice a la web dónde mira Railway la dirección (IP) de cada visita;
     Railway la pone siempre él mismo, así que nadie la puede falsear. Sirve para frenar a
     quien intente adivinar contraseñas.
   - Con `PAYMENT_PROVIDER="none"` no hacen falta las claves de Stripe, PayPal ni Turnstile. Los
     cobros se activan después, cuando quieras ([cobros-stripe-paypal.md](cobros-stripe-paypal.md)).
   - El archivo `vercel.json` que hay en el código es para otro hosting: Railway no lo usa y no
     hay que tocarlo.

   Si Railway te enseña arriba una barra con cambios pendientes y un botón **Deploy**, puedes
   dejarla para el final.

3. En **Settings → Deploy → Pre-deploy Command**, pega:

   ```bash
   npm run deploy
   ```

   Se ejecuta cada vez, después de construir la web y antes de ponerla en marcha: comprueba que
   la configuración está bien, prepara la base de datos y crea los datos base. Si falta o sobra
   algo, la versión nueva no arranca (si ya había una, sigue funcionando la anterior) y el
   registro dice exactamente qué variable revisar.

   No hace falta escribir nada más: Railway detecta solo que es una web de Node, la construye
   con `npm run build` y la arranca con `npm run start`.
4. En **Settings → Deploy → Region**, elige **EU West (Amsterdam)**, igual que la base de datos
   (o deja la que venga si no aparece).

   Si los puntos 3 o 4 no te aparecen todavía, hazlos justo después del siguiente.
5. En **Settings → Source**, conecta tu repositorio de GitHub (el de Cirella) y comprueba que la
   rama es **`main`** (si no aparece, tu copia no la tiene: mira el punto 4 de «Antes de
   empezar»). Si Railway te pide permiso para ver tus repositorios de GitHub, dáselo (basta con
   el de Cirella).

   Railway solo publica esa rama: cada vez que cambie en GitHub, vuelve a publicar la web él
   solo. Lo que se pruebe en otras ramas no se publica ni toca tu base de datos.
6. Pulsa **Deploy** en la barra de cambios pendientes y espera (unos 3–5 minutos). Lo puedes
   seguir en la pestaña **Deployments**.

   > Si Railway llegó a desplegar antes de tener las variables, ese primer intento falla a
   > propósito (la comprobación lo para). Es normal: con las variables ya puestas, pulsa
   > **Deploy** en la barra de cambios pendientes y vuelve a construir la web, ahora con ellas.
7. En **Settings → Networking**, pulsa **Generate Domain**. Railway le da a tu web una dirección
   provisional que termina en `.up.railway.app` (si te pregunta por un puerto, deja el que te
   propone). Apúntala: sirve para comprobar que todo va bien mientras preparas tu dominio.

**Comprobación:** en **Deployments**, el último despliegue sale en verde. Abre
`https://<tu-dirección>.up.railway.app/api/health`: tiene que poner `"db":"ok"` (la web habla
con la base de datos). De momento verás también `"ok":false` y `"retrasado"`: es normal hasta
el paso 8. Si abres esa dirección sin más, verás tu página, todavía con el contenido de ejemplo
(en el registro del despliegue sale «✓ Cuenta de tu@email.com y página … creadas y publicadas»).

Si el despliegue sale en rojo, ábrelo en **Deployments → View logs**: al final del registro
está qué variable revisar. Corrígela en **Variables** y pulsa **Deploy** otra vez.

---

## Paso 6 · Tu dominio

1. En el servicio **web**, abre **Settings → Networking → Custom Domain** y escribe
   `tudominio.com`. Railway te enseña el registro DNS que tienes que crear: un **CNAME** (con su
   nombre y su valor) y, a veces, también un **TXT** para comprobar que el dominio es tuyo.
2. Crea esos registros, tal cual, en el panel de tu proveedor de dominio (apartado «DNS»).
3. Haz lo mismo con `www.tudominio.com` (otro *Custom Domain*, con su propio registro), para
   que quien lo escriba con www también llegue.
4. Espera a que Railway dé el dominio por bueno: pueden ser unos minutos o unas horas. El
   candado (`https`) lo pone Railway solo.

**Si tu proveedor no te deja crear el CNAME** en el dominio «a secas» (sin www; el nombre suele
ser `@` o quedar vacío) y te da un error o no te ofrece la opción, no te preocupes: muchos no
lo permiten. Lo más fácil es llevar el DNS de tu dominio a **Cloudflare**, que es gratis, sí lo
permite y ya tienes la cuenta del paso 1:

1. En Cloudflare, añade tu dominio (la opción para añadir un dominio o un sitio, en la página
   de inicio) y elige el plan **Free**. Cloudflare copia los registros que ya tenías.
2. Revisa la lista que te enseña: tienen que estar los registros de Resend (paso 2) y, si
   tienes correo con tu dominio, los de tu correo. Si falta alguno, añádelo (los de Resend los
   vuelves a ver en Resend → **Domains** → tu dominio).
3. Cloudflare te da **dos servidores DNS** (*nameservers*). En tu proveedor de dominio, cambia
   los que hay por esos dos. El cambio puede tardar unas horas; Cloudflare te avisa por email
   cuando está activo.
4. En Cloudflare → **DNS → Records**, crea los registros que te pide Railway (el CNAME con el
   nombre `@`, el de `www` y el TXT si lo hay). Deja cada CNAME en **«DNS only» (nube gris)**,
   no en «Proxied» (nube naranja): así Cloudflare solo indica dónde está tu web y no se pone en
   medio.

Para entrar en tu panel usa `https://tudominio.com`, sin www: es la dirección que llevan tus
emails y la de tu enlace de la bio. (Con www también funciona, pero tendrías que volver a entrar
con tu contraseña, porque para el navegador son dos webs distintas.)

**Comprobación:** `https://tudominio.com/api/health` se abre con el candado y pone `"db":"ok"`.

---

## Paso 7 · Entrar por primera vez

No tienes que instalar nada: tu cuenta se crea sola en el primer despliegue (con `OWNER_EMAIL` y
`OWNER_NAME` del paso 5). Eres la administradora, tu página está publicada y tienes el plan
«Personal» (comisión 0 y todas las funciones). Los despliegues siguientes ya no la tocan.

1. Abre `https://tudominio.com/entrar` y pulsa **«Pide un enlace para entrar»**.
2. Escribe tu email (el de `OWNER_EMAIL`) y abre el email que te llega: el botón te deja dentro
   de tu panel.
3. Si quieres entrar también con contraseña: **Ajustes → Contraseña → Crear contraseña**.
4. Recomendado: activa la **verificación en dos pasos** (**Ajustes → Seguridad**), un código de
   tu móvil además de la contraseña o del enlace. Cómo se configura en el iPhone y qué hacer si
   pierdes el móvil: [seguridad-dos-pasos.md](seguridad-dos-pasos.md).

**Comprobación:** estás en tu panel y tu página se ve en `https://tudominio.com` (todavía con
el contenido de ejemplo: en el paso 10 la preparas).

> El usuario de tu página es el de `OWNER_USERNAME` y no se cambia desde el panel. Si algún día
> quieres otro, cámbialo en Railway (servicio **web** → **Variables**) y pulsa **Deploy**: con
> `OWNER_EMAIL` puesto, tu página pasa al usuario nuevo con todo su contenido. Los enlaces a tus
> productos cambian (`tudominio.com/<usuario nuevo>/…`): actualiza los que tengas compartidos.

<details>
<summary>Alternativa: crear la cuenta desde tu ordenador (con contraseña)</summary>

Solo si prefieres no usar `OWNER_EMAIL`. Sirve también para cambiar la contraseña si no puedes
entrar por email.

1. Instala **Node.js** (versión «LTS») desde [nodejs.org](https://nodejs.org).
2. Descarga el código: en GitHub, en tu repositorio, botón verde **Code → Download ZIP**.
   Descomprímelo en una carpeta.
3. En Railway, abre **Postgres → Variables** y copia el valor de **`DATABASE_PUBLIC_URL`**. Es
   la dirección de tu base de datos para conectarte desde fuera de Railway (la otra,
   `DATABASE_URL`, solo funciona dentro de Railway).
4. Abre una terminal en la carpeta del código (Mac: clic derecho sobre la carpeta → *Nuevo
   terminal en la carpeta*; Windows: dentro de la carpeta, escribe `cmd` en la barra de
   direcciones y pulsa Intro).
5. Crea en esa carpeta un archivo de texto llamado exactamente **`.env`** (con el punto delante y
   nada detrás):
   - **Mac**: en la terminal escribe `touch .env && open -e .env`. Se abre vacío en TextEdit, ya
     como texto simple.
   - **Windows**: en la terminal escribe `notepad .env` y di que sí cuando pregunte si quieres
     crearlo.

   **Pega** (no lo escribas a mano: TextEdit cambia las comillas) estas cinco líneas, cambia los
   valores por los tuyos y guarda (Cmd+S o Ctrl+S):

   ```bash
   DATABASE_URL="la DATABASE_PUBLIC_URL de Railway"
   DIRECT_URL="la DATABASE_PUBLIC_URL de Railway (otra vez la misma)"
   SITE_MODE="personal"
   OWNER_USERNAME="analuna"
   APP_URL="https://tudominio.com"
   ```

6. En la misma terminal escribe:

   ```bash
   npm install
   npm run personal:setup -- --email tu@email.com --name "Tu Nombre"
   ```

   Te pedirá una **contraseña** (mínimo 8 caracteres) dos veces. Mientras la escribes no se ve
   nada en la pantalla: es normal.
7. Verás tres líneas con ✓. **Borra el archivo `.env`** cuando termines (tiene la dirección de tu
   base de datos): en la misma terminal, `rm .env` en Mac o `del .env` en Windows.

</details>

---

## Paso 8 · Tareas automáticas (cron-job.org)

La web tiene tareas que se ejecutan solas: enviar los emails y reintentar los que fallan, los
recordatorios de las sesiones, borrar los enlaces de acceso caducados… Alguien tiene que
«despertarla» cada 5 minutos para que las haga. Railway no tiene una forma gratuita más sencilla
de hacerlo, así que usamos un servicio gratuito:

1. Crea una cuenta en [cron-job.org](https://cron-job.org).
2. **Create cronjob**:
   - *Title*: `Mi web`.
   - *URL*: `https://tudominio.com/api/cron`
   - *Execution schedule*: **Every 5 minutes**.
   - Pestaña **Advanced → Headers → Add**: *Key* `Authorization`, *Value* `Bearer ` seguido de tu
     `CRON_SECRET` (la palabra Bearer, un espacio y la clave).
3. Guarda y pulsa **Test run**: la respuesta tiene que ser **200**. Si dice 401, revisa la
   cabecera (la palabra `Bearer`, el espacio y la clave exacta).

**Comprobación:** en `https://tudominio.com/admin` no aparece el aviso «Las tareas automáticas
están paradas» (puede tardar unos minutos en irse la primera vez) y
`https://tudominio.com/api/health` ya pone `"ok":true`.

---

## Paso 9 · Copia de seguridad diaria

Tu base de datos guarda todo lo que no son archivos: tus productos, tus alumnas, quién tiene
acceso a qué… En el plan Hobby, Railway no te hace copias programadas de ella, así que vamos a
montar una **copia diaria** que se guarda en R2. Se hace con una plantilla oficial de Railway,
**Postgres S3 Backups**: un pequeño servicio que, a la hora que le digas, hace una copia de la
base de datos y la sube a un bucket. Es muy recomendable y gasta muy poco.

1. **Un bucket aparte para las copias.** En Cloudflare R2, **Create bucket**:
   - *Name*: `mi-web-copias`.
   - *Location*: **Specify jurisdiction → European Union (EU)**.

   Va separado del de la web a propósito: con su propia clave, aunque alguien consiguiera la de
   la web, no podría borrar tus copias.
2. En ese bucket, **Settings → Object lifecycle rules → Add rule**: sin prefijo (para todo el
   bucket), borrar a **30 días**. Así guardas las copias del último mes y no se acumulan.
3. **Manage API tokens → Create API token**:
   - *Permissions*: **Object Read & Write**.
   - *Specify bucket*: **solo** `mi-web-copias`.
   - Apunta las dos claves (solo se muestran una vez) como **`COPIAS_ACCESS_KEY_ID`** y
     **`COPIAS_SECRET_ACCESS_KEY`**.
4. **Mira la versión de tu Postgres.** En Railway, abre el servicio **Postgres**: el nombre de
   su imagen termina en el número de versión (por ejemplo, `…postgres-ssl:17` es la 17). Lo ves
   en sus ajustes, en el apartado del origen (*Source*); si no, en sus registros (*logs*), donde
   aparece la versión al arrancar.
5. En tu proyecto, usa el botón para añadir un servicio («+ Create» o «New»), elige plantilla
   (*Template*) y busca **Postgres S3 Backups** (la oficial de Railway,
   `railwayapp-templates/postgres-s3-backups`). Railway te pedirá sus variables; si no te las
   pide, añádelas después en su pestaña **Variables**:

   | Variable | Valor |
   |---|---|
   | `AWS_ACCESS_KEY_ID` | tu `COPIAS_ACCESS_KEY_ID` |
   | `AWS_SECRET_ACCESS_KEY` | tu `COPIAS_SECRET_ACCESS_KEY` |
   | `AWS_S3_BUCKET` | `mi-web-copias` |
   | `AWS_S3_REGION` | `auto` |
   | `AWS_S3_ENDPOINT` | tu `S3_ENDPOINT` (la misma dirección del paso 1, con `.eu.`) |
   | `BACKUP_DATABASE_URL` | `${{Postgres.DATABASE_URL}}`, escrito tal cual |
   | `BACKUP_CRON_SCHEDULE` | `0 4 * * *` (todos los días a las 4:00 UTC: las 5 de la mañana en invierno y las 6 en verano, hora de España) |
   | `RUN_ON_STARTUP` | `true` (hace una copia nada más arrancar, para que la puedas comprobar ya) |
   | `PG_VERSION` | solo si tu Postgres es la 17 o más nueva: ese número |
   | `NODE_VERSION` | `22`, solo si has puesto `PG_VERSION` |

   La copia tiene que hacerse con la misma versión que tu base de datos. La plantilla viene
   preparada para la 16: si tu Postgres es la 16, no pongas `PG_VERSION` ni `NODE_VERSION`. Si
   es la 17 o más nueva, pon las dos (así lo indican las instrucciones de la plantilla).
6. Despliégalo (con el botón **Deploy** de la plantilla o el de la barra de cambios pendientes).

**Comprobación:** a los pocos minutos, en R2 → `mi-web-copias` aparece un archivo con la fecha
que termina en `.tar.gz`. A partir de ahí, aparecerá uno nuevo cada día. Si no aparece, abre ese
servicio en Railway → **Deployments → View logs**: el registro dice qué falla (casi siempre una
clave o la versión de `PG_VERSION`).

**Restaurar una copia** es una tarea técnica. Si algún día hace falta, quien te ayude descarga
de `mi-web-copias` el archivo `.tar.gz` del día que quieras, lo descomprime y lo vuelca con un
`pg_restore` de la misma versión que tu Postgres (o más nueva), usando tu `DATABASE_PUBLIC_URL`:

```bash
gunzip backup-….tar.gz
pg_restore --clean --if-exists --no-owner -d "tu DATABASE_PUBLIC_URL" backup-….tar
```

(La copia es un `pg_dump` en formato *tar*: con `psql` no se puede restaurar.)

---

## Paso 10 · Prepara tu página

Desde tu panel (`https://tudominio.com/panel`, también en el móvil):

1. **Ajustes → Datos legales**: tu nombre, NIF, dirección y email. Es obligatorio en una web
   con actividad profesional y sale en tu **aviso legal y privacidad**
   (`tudominio.com/<tu usuario>/legal`), que se enlaza en el pie de tu página. La privacidad
   parte de una plantilla que puedes adaptar; revísala con tu asesoría.
2. **Mi página**: foto, nombre, frase, enlaces, redes, bloques (textos, imágenes, galerías y
   vídeos; ver «Tu página: imágenes de Canva, vídeos y páginas extra») y el diseño. El nombre de tu página es el que se ve en el login, el panel y los emails. Al
   pulsar **Publicar** también pasa a la página «no encontrada» (la que sale si alguien escribe
   mal una dirección). Tras cada actualización de la web, esa página se pone al día sola en
   unos minutos (con las tareas automáticas del paso 8).
3. **Productos**: elige cómo se consigue cada uno:
   - **Gratis con email**: un curso, una guía, una meditación… La persona deja su nombre y su
     email y entra al momento. Hasta que completes el punto 1 (datos legales) el formulario no
     aparece y nadie puede apuntarse; el panel te avisa. Si marca la casilla de novedades, solo
     cuenta cuando lo confirma con el botón que le llega en el email de acceso.
   - **Pago en otra web**: pega el enlace (Hotmart, PayPal, Calendly…) y el texto del botón
     (por ejemplo «Comprar en Hotmart» o «Reservar en Calendly»). El precio es opcional. Si el
     contenido está aquí (un curso), en la ficha del producto usa **«Dar acceso a una persona»**
     cuando alguien te pague fuera: le llega un email con su acceso.
4. **Publicaciones**: tus novedades con fecha. En tu página salen las tres últimas.
5. **Códigos**: los descuentos de otras marcas (marca, código, descripción, enlace y, si
   quieres, caducidad). Los caducados se ocultan solos.
6. **Inscripciones**: quién se ha apuntado a qué y quién ha confirmado que quiere tus novedades.
7. Copia tu enlace (**Ajustes → Comparte tu página**) y ponlo en tu bio.

**Comprobación:** abre `https://tudominio.com` en el móvil, en una ventana de incógnito, y ves
tu página como la verá cualquiera. Apúntate a un producto gratis con otro email tuyo: te llega
el email con el enlace de acceso.

### Tus lecturas y tu calendario

Con los cobros activados, tus sesiones se reservan y se pagan en tu web, con tu propio calendario:
no hace falta Calendly ni Google Calendar. Tú trabajas con tu enlace de Zoom y todo se avisa por email.

1. **Tu horario** (**Reservas → Tu horario**): las franjas de cada día de la semana y tu zona
   horaria. Si viajas, en **Fechas especiales** pon desde qué día hasta cuál trabajas y en qué
   horas, en la zona del sitio donde estés («de 9:00 a 13:00, hora de Bali»): esos días no se usa
   tu horario semanal. Para unas vacaciones, **Bloquear días** (desde–hasta); para un médico,
   **Bloquear unas horas**. Si tu móvil está en otra zona, el panel te lo recuerda.
2. **Tu enlace de Zoom**: en la app de Zoom, **Reuniones → tu sala personal → Copiar
   invitación**, y pega solo el enlace (`https://…zoom.us/j/…`) en cada sesión (**Productos →
   la sesión → Enlace de Zoom**). Le llega a tu clienta con la confirmación y los recordatorios.
   En cada reserva puedes poner otro y marcar «Avisar por email».
3. **Datos de nacimiento**: en cada sesión o lectura, **Datos que pides**: fecha, hora y lugar de
   nacimiento (no / opcional / obligatorio) y hasta 8 preguntas tuyas. Se piden al pagar; tu
   clienta los puede corregir desde su área y tú los ves en la reserva con **Copiar** (para tu
   programa de astrología). Si tu texto de privacidad es personalizado, añade que los pides.
4. **Cuánto por delante**: en cada sesión, **Se puede reservar hasta** (2 semanas a 6 meses).
5. **Dar una sesión** (**Reservas → Dar una sesión o lectura**): para un regalo o algo que te
   pagaron por Bizum o transferencia (la factura la emites tú). Elige un hueco de tu agenda,
   cualquier otra hora o «que la elija ella». Le llega el email con su enlace.
6. **Enviar una lectura grabada**: en la reserva, **Enviar la grabación** (o en **Reservas →
   Lecturas por entregar**). Sube el audio o el vídeo desde **Fotos** o **Archivos** del iPhone
   (hasta 4 GB; no cierres la pantalla mientras sube), escribe un mensaje y pulsa **Enviar**. Tu
   clienta la escucha en su área y le llega «Tu lectura está lista».
7. **Talleres**: **Productos → Nuevo → Taller en directo**: fecha, hora, plazas y Zoom. Ves las
   asistentes en el producto; después sube la grabación y pulsa **Avisar de la grabación**.
8. **Avisos** (**Automatizaciones**): «Aviso de reservas» (te avisa de cada reserva, cambio de
   fecha y datos nuevos) y «Segundo recordatorio» (60 minutos antes, con el Zoom) vienen
   activados; puedes cambiar los minutos o desactivarlos.

9. **El calendario** (arriba en **Reservas**): el mes en tu zona horaria con lo que hay cada día
   (sesiones, talleres, tus notas, días y horas bloqueados) y el cielo: lunas nuevas 🌑 y llenas 🌕,
   eclipses, conjunciones ☌ (Sol, Luna, planetas, Quirón, Ceres, Palas, Juno, Vesta, Eris, Nodo
   Norte medio y Lilith media) y cuando un planeta se pone retrógrado o directo ℞. Toca un día para
   ver todo con la hora, el signo y el grado, lo que va retrógrado y dónde está cada cosa («Hoy en
   el cielo»), y para escribir tu nota del día (se guarda sola; solo la ves tú). Las conjunciones de
   la Luna y las estaciones de los asteroides solo salen al abrir el día. Con **Qué mostrar**
   (Planetas · Luna · Asteroides · Puntos) escondes lo que no quieras ver; se recuerda en ese móvil
   u ordenador.

Mientras una clienta está pagando en Stripe o PayPal, esa hora queda guardada (hasta unos 30
minutos): así dos personas no pagan la misma hora. Si el pago falla, la hora vuelve a estar libre.

### Tu página: imágenes de Canva, vídeos y páginas extra

En **Mi página → Bloques** (y en cada página extra) añades, en el orden que quieras:

- **Imagen**: un gráfico de Canva (**Compartir → Descargar → PNG**, mejor de 1080 px de ancho o
  más). En «Descripción de la imagen» escribe el texto que sale en el gráfico: así lo leen Google
  y quien usa lector de pantalla. Si no le pones enlace, al tocarla se abre en grande para leerla.
- **Galería**: hasta 12 imágenes, en carrusel (se desliza) o en cuadrícula.
- **Vídeo**: súbelo desde Fotos o Archivos (MP4 o MOV hasta 1 GB) o pega un enlace de YouTube o
  Vimeo. Para un vídeo de bienvenida: menos de 2 minutos, el iPhone en **Más compatible** y
  exportado a **1080p**. La portada sale sola de un fotograma; puedes cambiarla. Nunca se
  reproduce solo: tu página abre rápido desde Instagram.

**Páginas extra** (**Páginas → Nueva página**): «Sobre mí», «Preguntas frecuentes» o en blanco,
con los mismos bloques. Cada una tiene su dirección (por ejemplo `tudominio.com/sobre-mi`, en
**Ajustes** con «Copiar enlace»), su borrador y su **Publicar**. Las publicadas salen en el pie de
tu web; con **«Añadir un botón a esta página en mi portada»** sale también arriba, entre tus
botones. Pega `tudominio.com/sobre-mi` en tu bio o en una historia.

### Vídeos y audios desde el iPhone

- **Formato**: en el iPhone, **Ajustes → Cámara → Formatos → Más compatible** y **Vídeo HDR**
  desactivado. Así graba en MP4 (H.264), que se ve en todos los navegadores. Si un vídeo sale
  con el aviso **«HEVC»** en Materiales, se ve en iPhone, iPad y Mac pero puede no verse en
  algunos navegadores de ordenador o Android: expórtalo con **InShot** (MP4) o vuelve a grabarlo
  con «Más compatible».
- **Peso**: el aviso **«Muy pesado para el móvil»** sale cuando el vídeo pasa de unos 12 Mbps
  (por ejemplo 2,3 GB en 10 minutos). Exporta en **1080p** (o 720p) con InShot: tus alumnas lo
  verán sin cortes con datos.
- **Subir**: hasta 4 GB por vídeo. Mejor desde la app **Archivos** o desde el Mac, con wifi; no
  bloquees el iPhone ni cambies de app mientras sube (la barra lo recuerda y tiene «Cancelar»).
- **Audio**: mejor M4A o MP3 que WAV (una hora en WAV son unos 635 MB).
- **Vimeo**: para un vídeo oculto, copia el enlace completo (**Compartir → Copiar enlace**, con el
  código del final) y en Vimeo → **Privacidad → Dónde se puede insertar** permite tu dominio.
  Cualquier otro enlace (Loom, Drive…) se guarda, pero tus alumnas verán un botón «Abrir el vídeo».

---

## Cómo entran tus alumnas

- **Dónde está el botón**: arriba a la derecha de tu página (y de cada producto, checkout y
  confirmación) hay un botón **«Entrar»**; si ya ha entrado antes en ese móvil, pone **«Mi área»**.
  En el pie también: «¿Ya tienes acceso? Entra en tu área · ¿Aún no tienes cuenta? Créala». Los
  emails que les llegan (accesos, recibos, recordatorios…) terminan con «Tu área: tudominio.com/cuenta».
- **Crear su cuenta**: en «Entrar» hay una segunda pestaña, **«Crear mi cuenta»**: nombre, email y
  la casilla (sin marcar) de tus novedades. Le llega un email «Confirma tu email para entrar»;
  al pulsar «Confirmar y entrar» entra en su área y puede crear una contraseña si quiere. Nada se
  crea hasta que confirma el email. Aparece en **Clientes** con «Se registró» y recibe tu email de
  bienvenida (Automatizaciones), si lo tienes activado.
- **Entrar**: con un enlace por email (sin contraseña) o con su contraseña, si se la ha creado.
- **Sus compras e inscripciones**: todo lo que consiga con el mismo email aparece en su área,
  también lo de antes de crear la cuenta.
- **Su perfil** (**Mi perfil**): nombre, foto (opcional), cambiar el email (se confirma desde el
  email nuevo y avisamos al de antes), contraseña y tus novedades (apuntarse o darse de baja).
  Si quiere que se borren sus datos (RGPD), te escribe: el borrado desde su área aún no existe.

## Tu comunidad

En **Productos → tu membresía → Publicaciones de la comunidad → Nueva publicación**:

- Escribe el texto y añade **audios, vídeos, PDF o imágenes** (hasta 10) con «Añadir audio, vídeo,
  PDF o imagen». Solo los ven tus miembros.
- **Cuándo**: «Publicar ahora», «Programar» (eliges día y hora; se publica sola) o «Borrador».
  Puedes editarla, cambiar la hora o borrarla cuando quieras. «Vista previa» te enseña cómo la ven.
- **Avisar por email**: cada miembro recibe un email con el principio de la publicación y su
  enlace directo. Quien no quiera más avisos se da de baja con el enlace del email (o desde su
  comunidad). Con el plan gratuito de Resend (100 emails al día) caben unos 80 miembros por
  publicación: si tienes más, pasa a Resend Pro o desmarca «Avisar por email».
- **Comentarios**: tus miembros comentan y dan «me gusta»; tú respondes (sale «Autora»), borras
  cualquier comentario o dejas sin comentar a alguien desde la publicación en el panel. Te llega un
  email con cada comentario (lo puedes apagar en Automatizaciones → «Comentarios nuevos»).
- **Qué incluye esta membresía**: marca tus cursos y tus miembros los tendrán en «Mis cursos»
  mientras su membresía esté activa. Al terminar, dejan de verlos.
- **Acceso con fecha de fin** (un programa de 3 meses, alguien que te paga por Bizum, un regalo):
  en «Personas con acceso» elige «Duración del acceso». Le avisamos 7 días antes y ese día se cierra
  solo; tú recibes un aviso con «Ampliar su acceso». «Cambiar fecha» la alarga o la quita.
- Las membresías de pago terminan solas al final del periodo pagado si la cancelan, o si no se
  puede cobrar la renovación.

Te recomendamos añadir a tu texto de privacidad que en la comunidad se muestra tu nombre y el de
quien comenta (nombre e inicial) y que enviamos avisos por email de las publicaciones.

---

## Tu newsletter

Tu newsletter sale **desde tu dominio, con Resend** (la misma cuenta del paso 2), sin ninguna
herramienta más. Todo está en **Panel → Newsletter**:

- **Campañas**: «Nueva newsletter» → asunto, «Texto de vista previa» y los bloques (título, texto
  con negrita, listas y enlaces, imagen, botón, separador y espacio). Las imágenes de Canva se
  suben desde Fotos o Archivos y se guardan en JPEG o PNG (Outlook no enseña WebP). Escribe
  `{nombre}` y saldrá el nombre de cada persona (si no lo sabemos, «Hola, {nombre}» queda «Hola»).
  «Vista previa» enseña el email tal cual (móvil y ordenador), «Enviarme una prueba» te lo manda a
  ti con «[Prueba]» en el asunto, «A quién» elige todas, una etiqueta, quien compró un producto o
  los miembros de la comunidad, y luego «Enviar ahora» o «Programar» (día y hora de Madrid).
  Antes de enviar te dice a cuántas personas va y qué día terminará con tu límite diario.
- **Editor visual**: además de esos bloques, **Portada** (foto de fondo con una capa de color,
  título, subtítulo y botón), **Destacado** (un recuadro de color con icono para lo importante),
  **Vídeo**, **Dos columnas** (imagen y texto; en el móvil se ponen una encima de otra) y **Redes
  sociales**. Cada bloque tiene «Colores y letra» (color, tamaño, alineación y tipo de letra) y los
  botones, su forma (redondo, recto o solo borde) y «Todo el ancho». En **«Estilo del email»**
  eliges los fondos, los colores del texto, los títulos, los enlaces y los botones, los tipos de
  letra, las esquinas y el ancho; los colores de tu marca (Mi página) salen los primeros y, si un
  texto no se va a leer bien sobre su fondo, te avisa. **«Plantillas»** te da tres diseños de
  partida con tus colores: «Luna llena», «Novedades» y «Lanzamiento».
- **Qué ve cada buzón**: los buzones no reproducen vídeo; en el email sale su portada con un ▶ y,
  al pulsarla, se abre YouTube/Vimeo o, si lo subiste aquí, una página de tu web que lo reproduce
  (con una dirección imposible de adivinar). La miniatura de YouTube y Vimeo se trae sola; si no se
  puede, sube tú una portada. Los tipos de letra con ✦ (Playfair, Cormorant, Lora, Montserrat) se
  ven en el Mail del iPhone y en Apple Mail; Gmail y Outlook enseñan uno parecido (Georgia o
  Helvetica). Outlook de escritorio no redondea esquinas y a veces no enseña la capa de color de la
  portada: por eso la portada siempre lleva su color de reserva. Cada email sale también en texto
  plano (mejora la entrega).
- **Suscriptoras**: quién está, desde cuándo y con qué texto aceptó (la prueba que pide el RGPD),
  etiquetas, «Añadir a mano» (le llega un email para confirmar), **Importar CSV** de tu
  herramienta anterior (columnas `email`, `nombre`, `fecha_consentimiento`, `etiquetas`; sin fecha
  de consentimiento no se importa) y **Exportar CSV**.
- **Emails automáticos**: la bienvenida, el email de compra, el de acceso a lo gratis, el del curso,
  la confirmación de reserva, los recordatorios, el de compra abandonada y la bienvenida a la
  newsletter. Cambias asunto y texto con el mismo editor (con `{nombre}`, `{producto}`, `{fecha}`…),
  ves la vista previa con datos de ejemplo y, si te arrepientes, **«Restaurar el original»**. Lo
  importante (el botón de acceso, el recibo, la fecha de la sesión, los enlaces legales) se añade
  solo.
- **El formulario para apuntarse**: Mi página → Secciones → activa **«Newsletter»** (y, si quieres,
  «También en el pie de todas mis páginas»). Quien se apunta recibe «Confirma que quieres recibir la
  newsletter» y no cuenta hasta que pulsa «Sí, quiero recibirla» (doble opt-in). Quien marca la
  casilla de novedades al crear su cuenta, al pagar o en lo gratis también entra en la lista.

### Los registros DNS en united-domains

Tu correo está en united-domains y **sigue allí**: no toques tus registros MX ni el SPF que ya
tiene tu dominio. Resend usa un subdominio propio (`send`) para los rebotes, así que no choca con tu
buzón. En el paso 2 ya añadiste tu dominio a Resend; si no lo hiciste, hazlo ahora (**Domains → Add
Domain**, región **Ireland (eu-west-1)**). Resend te enseña exactamente estos registros; cópialos
en united-domains → **Portfolio** (tus dominios) → tu dominio → **DNS** (o «DNS-Einstellungen»)
→ **Añadir registro**. En «Subdominio» (o «Host») va solo la parte de delante, sin tu dominio:

| Tipo | Subdominio | Valor | Para qué |
|---|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSq…` (la clave larga que te da Resend) | **DKIM**: firma tus emails |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` (prioridad **10**) | rebotes (*Return-Path*) |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | **SPF** del subdominio de envío |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hola@tudominio.com` | **DMARC** (Gmail y Yahoo lo exigen) |

- Si Resend te enseña el DKIM como **CNAME** (algunas cuentas lo tienen así), crea los CNAME que
  te dé, tal cual, en lugar del TXT.
- **DMARC**: si ya tienes un registro `_dmarc`, no crees otro (solo puede haber uno). Empieza con
  `p=none`; cuando lleves unas semanas enviando sin problemas puedes subirlo a `p=quarantine`.
- **SPF**: el `include:amazonses.com` va en `send`, **no** en el registro de tu dominio a secas
  (allí está el de tu correo de united-domains; solo puede haber un SPF por nombre).
- Vuelve a Resend y pulsa **Verify**. Puede tardar de minutos a una hora. Cuando ponga
  **Verified**, ya está.

**Respuestas a tu buzón**: los emails salen desde la dirección de `EMAIL_FROM` (por ejemplo
`Ana Luna <hola@tudominio.com>`) y llevan como *Responder a* tu **email de contacto**
(Ajustes). Pon ahí tu buzón de united-domains y las respuestas a cualquier newsletter o email
automático te llegarán a él.

**Remitente propio para la newsletter (opcional)**: añade en Railway la variable
`NEWSLETTER_FROM`, por ejemplo `Ana Luna <newsletter@tudominio.com>`, y la newsletter saldrá desde
ahí (los emails de acceso y recibos siguen saliendo desde `EMAIL_FROM`). Con el plan gratuito de
Resend usa una dirección del **mismo dominio** (solo admite un dominio); con Resend Pro puedes
verificar un subdominio aparte (`news.tudominio.com`, con sus propios registros) para que una
newsletter marcada como spam nunca afecte a tus emails de acceso.

### Rebotes y quejas (webhook de Resend)

Para que las direcciones que no existen y quien marca «es spam» se den de baja solas:

1. Resend → **Webhooks → Add Endpoint**. URL: `https://tudominio.com/api/webhooks/resend`.
   Eventos: `email.delivered`, `email.bounced` y `email.complained`.
2. Abre el webhook y copia su **Signing Secret** (empieza por `whsec_`).
3. En Railway, servicio **web** → **Variables**: `RESEND_WEBHOOK_SECRET` = ese valor. Se vuelve
   a publicar sola.

Con el webhook, cada campaña enseña **Entregadas, Rebotadas, Quejas y Bajas** (las bajas se cuentan
siempre, con o sin webhook). Panel → Newsletter → **Envío** te dice si está activado.

**Aperturas y clics**: vienen **desactivados**, a propósito. Medirlos usa un píxel y enlaces de
seguimiento, que en España y Alemania necesitan el consentimiento expreso de quien lee (y Apple
Mail abre todos los emails solo, así que las aperturas no dicen mucho). Si aun así los quieres,
actívalos en Resend → tu dominio → *Open/Click tracking*, añade los eventos `email.opened` y
`email.clicked` al webhook y menciónalo en tu texto de privacidad: el panel los enseñará.

### Cuánto puedes enviar (plan gratuito de Resend)

- **100 emails al día y 3000 al mes**, contando **todos** (accesos, recibos, recordatorios y
  newsletter), **un dominio** y unas **2 peticiones por segundo**.
- La web no se pasa: la newsletter sale **por tandas** dentro de un **límite diario de 100**, del
  que siempre deja **20 para los emails importantes** (enlaces para entrar, accesos, recibos), que
  nunca esperan. Lo que no cabe hoy sale mañana, solo (con las tareas automáticas del paso 8), y
  entre email y email espera medio segundo para no pasar del límite por segundo de Resend.
- Con 80 al día, una lista de 400 personas tarda 5 días. Cuando la lista crezca, **Resend Pro**
  (unos 20 $/mes, 50 000 al mes, sin límite diario) y en Panel → Newsletter → **Envío** sube el
  límite (o ponlo a 0: sin límite).
- Los avisos de la comunidad y las invitaciones a confirmar de una importación también van por
  tandas, dentro del mismo límite.

### Lo legal

- **Doble opt-in** en el formulario y en lo que añades a mano o importas sin prueba; se guarda la
  fecha, el texto exacto que aceptó y desde dónde (lo ves en cada suscriptora).
- **Cada newsletter lleva** «Darme de baja» en el pie y el botón «Cancelar suscripción» del propio
  Gmail o Apple Mail (baja en un clic), y **quién la envía**: tu nombre legal, tu dirección y tu
  email de Ajustes → **Datos legales**. Si facturas con una empresa (una LLC, una SL), pon ahí su
  nombre y su dirección y saldrán en el pie de cada newsletter.
- **Importar**: solo personas que aceptaron recibir tu newsletter y con la fecha en que lo hicieron.
  Quien se dio de baja, rebotó o se quejó no se vuelve a añadir nunca.
- **Tu texto de privacidad**: añade que usas el email de quien se apunta para enviarle tu newsletter
  (base legal: su consentimiento), que se envía con Resend (proveedor de envío de emails, con los
  datos en su región de Irlanda) y que puede darse de baja en
  cualquier momento con el enlace de cada email.
- Lo gratis **nunca** depende de apuntarse a la newsletter: la casilla es aparte y sin marcar.

---

## Tu panel a tu gusto

En **Ajustes → Personalizar mi panel** cambias los colores **de tu panel** (tu web no cambia): el
acento (botones y la sección en la que estás), el fondo (claro, crema u oscuro) y la barra lateral
del ordenador, con cuatro estilos listos («Luna», «Tierra», «Lavanda» y «Noche») o tus colores. El
texto encima se elige solo para que se lea. Mientras eliges, el panel entero ya se ve así; pulsa
**«Guardar mi panel»** y se verá igual en el móvil y en el ordenador.

Debajo ordenas el menú con ↑ y ↓ y ocultas con el ojo las secciones que no uses (Inicio y Ajustes
no se pueden ocultar). En el móvil, **las 4 primeras van a la barra de abajo** y el resto, a
«Más». También puedes ordenar las tarjetas de Inicio. **«Restaurar»** lo deja todo como venía.

## Mantenimiento

- **Actualizaciones**: cuando el código cambie en la rama `main` de tu repositorio de GitHub,
  Railway vuelve a publicar la web solo y, antes de ponerla en marcha, aplica los cambios de la
  base de datos (el *Pre-deploy Command* del paso 5). Si algo falla, sigue funcionando la
  versión anterior.
- **Algún email no ha llegado**: `/admin` → **Envíos fallidos**. Desde ahí se reintenta.
- **¿Va todo bien?**: `https://tudominio.com/api/health` tiene que decir `"ok":true`. Si dice
  `"retrasado"`, las tareas automáticas llevan más de 20 minutos sin ejecutarse (y en `/admin`
  verás «Las tareas automáticas están paradas»): revisa el paso 8.
- **Ver qué ha pasado**: en Railway, servicio **web** → **Deployments** → **View logs**. Es el
  registro de la web, con los errores si los hay.
- **Copias de seguridad**: cada día aparece una nueva en `mi-web-copias` (paso 9). Échale un
  vistazo de vez en cuando.
- **Lo que gastas**: en Railway, en el apartado de uso (*Usage*) de tu espacio de trabajo, ves
  lo que llevas este mes.

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

Cuando quieras abrir Cirella a otras creadoras: en Railway, en las **Variables** del servicio
**web**, cambia `SITE_MODE` a `platform` (o bórrala), configura Stripe (`PAYMENT_PROVIDER=stripe`
y sus claves, ver [pagos-stripe.md](pagos-stripe.md)), revisa los datos legales de la plataforma
en `/admin` y pulsa **Deploy** en la barra de cambios pendientes. Railway vuelve a construir la
web, que es lo que hace falta porque `SITE_MODE` se usa al construirla. Tu página pasará a estar
en `tudominio.com/<tu usuario>` y la portada será la de la plataforma. La plataforma necesita las
tareas automáticas cada 5 minutos: cron-job.org ya lo hace (paso 8).
