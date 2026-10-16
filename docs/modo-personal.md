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
   | `PAYMENT_PROVIDER` | `none` |
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
   - No hacen falta las claves de Stripe ni de Turnstile.
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
2. **Mi página**: foto, nombre, frase, enlaces, redes, bloques de texto (sobre mí, servicios…) y
   el diseño. El nombre de tu página es el que se ve en el login, el panel y los emails. Al
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

---

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
