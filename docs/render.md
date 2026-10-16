# Publicar tu web en Render

Render no admite subir un archivo: lee el código de tu repositorio de GitHub (el de Cirella). No
hace falta que uses la web de GitHub: Render te pide permiso para leerlo y ya está. Con el archivo
`render.yaml` que va en el código, Render crea la web y la base de datos él solo.

Antes, ten a mano lo de los pasos 1 a 3 de [modo-personal.md](modo-personal.md): las 4 claves de
Cloudflare R2 (archivos) y la clave de Resend (emails). Las dos claves secretas no hacen falta:
Render las genera solo.

## Pasos

1. Entra en [render.com](https://render.com) y crea una cuenta con **«Continue with GitHub»**
   (así Render puede leer tu repositorio).
2. Arriba a la derecha: **New → Blueprint**. Elige tu repositorio de Cirella y la rama **main**.
3. Render lee `render.yaml` y te pide estos valores:

   | Variable | Qué poner |
   |---|---|
   | `OWNER_USERNAME` | tu usuario, en minúsculas y sin espacios (p. ej. `analuna`) |
   | `OWNER_EMAIL` | tu email: con él entrarás en tu panel |
   | `OWNER_NAME` | tu nombre, el que se verá en tu página |
   | `RESEND_API_KEY` | la clave de Resend (empieza por `re_`) |
   | `EMAIL_FROM` | sin dominio: `Tu Nombre <onboarding@resend.dev>`; con dominio: `Tu Nombre <hola@tudominio.com>` |
   | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | las de Cloudflare R2 |

4. Pulsa **Apply** (o **Deploy Blueprint**) y espera unos minutos.
5. Abre el servicio **mi-web**: arriba verás su dirección (`https://mi-web-xxxx.onrender.com`).
   Ponla en la regla CORS de R2 (paso 1 de la guía), en lugar de `https://tudominio.com`.
6. Abre esa dirección y entra en `/entrar` → **«Pide un enlace para entrar»** con tu email. Te
   llega un email y estás en tu panel.

Sin dominio, Resend solo entrega emails a tu propio email (el de tu cuenta de Resend): tú puedes
entrar y probarlo todo, pero tus alumnas no recibirían su acceso hasta que pongas el dominio.

## Lo que conviene saber

- **Gratis para probar, de pago para usarla.** La web gratuita se duerme tras 15 minutos sin
  visitas (la primera visita después tarda en abrir) y la base de datos gratuita **se borra a los
  30 días**. Antes de usarla de verdad, en Render cambia la web a **Starter** y la base de datos a
  **Basic** (en total, unos 13 $ al mes). Railway (la guía principal) sale más barato: unos 5 $.
- **Tareas automáticas:** igual que en el paso 8 de la guía, con cron-job.org. La clave
  `CRON_SECRET` la ves en Render → **mi-web → Environment**.
- **Tu dominio:** Render → **mi-web → Settings → Custom Domains**. Después añade en
  **Environment** la variable `APP_URL` con `https://tudominio.com`, cambia `EMAIL_FROM` a tu
  dominio (verificado en Resend) y añade el dominio a la regla CORS de R2.
- **Actualizaciones:** cada cambio en la rama `main` se publica solo.
