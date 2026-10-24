# Verificación en dos pasos

Además de tu contraseña (o del enlace «Pide un enlace para entrar»), tu panel puede pedirte un
**código de 6 cifras** de una app de tu móvil. Así, aunque alguien consiga tu contraseña o entre
en tu email, no puede abrir tu panel. Es opcional y la activas tú; nunca se activa sola.

## Activarla (iPhone)

1. En tu panel: **Ajustes → Seguridad → Activar** (o el aviso «Protege tu panel» → **Activarla**).
2. Pulsa **Empezar** y después **Abrir en mi app de códigos**. El iPhone te ofrece guardarlo en
   **Contraseñas** (Ajustes → Contraseñas → tu web → *Código de verificación*) o en la app que
   tengas (Google Authenticator, Authy, 1Password…).
   - ¿Lo configuras desde el ordenador? Abre **«Escanea el código QR»** y escanéalo con el móvil.
   - ¿Prefieres escribirla? Copia la **clave** que aparece debajo.
3. Escribe el código de 6 cifras que te enseña la app y pulsa **Activar**.
4. Te enseñamos **10 códigos de recuperación**. Guárdalos (botón **Descargar** o **Copiar** y
   pégalos en Notas, o imprímelos): cada uno sirve **una vez** si pierdes el móvil. Marca «Los he
   guardado» y pulsa **Terminar**.

Al activarla se cierran tus demás sesiones y te llega un email avisando.

## Entrar

Después de la contraseña o del enlace te pediremos el código de la app. En el iPhone, con
Contraseñas, el código aparece encima del teclado. Si marcas **«Recordar este dispositivo 30
días»**, en ese navegador no te lo volveremos a pedir durante un mes (la contraseña o el enlace,
sí). Cada acceso nuevo a tu panel desde un dispositivo no recordado te llega por email.

## Si pierdes el móvil

1. En la pantalla del código pulsa **«¿No tienes el móvil? Usa un código de recuperación»** y
   escribe uno de tus códigos (da igual mayúsculas, espacios o guiones).
2. Entrarás en **Ajustes → Seguridad**. Pulsa **Configurar de nuevo (móvil nuevo)**: te pedirá
   otro código de recuperación (y tu contraseña, si tienes) y empezarás otra vez con el móvil
   nuevo y **códigos nuevos**.

## Si has perdido el móvil y los códigos

Quien gestiona tu servidor puede desactivarla. No hay forma de hacerlo desde la web (así nadie
puede pedirlo haciéndose pasar por ti):

- **Render**: servicio web → **Shell** y escribe
  `npm run auth:reset-2fa -- tu@email.com --yes`
- **Railway** (o desde tu ordenador, con el `.env` del «Paso 7 · Alternativa» de
  [modo-personal.md](modo-personal.md) y además tu `APP_SECRET`): en la carpeta del código,
  `npm run auth:reset-2fa -- tu@email.com --yes`

Se desactiva la verificación, se borran los códigos y los dispositivos recordados, se cierran
**todas** tus sesiones y te llega un email. Entra con tu contraseña o con un enlace y vuelve a
activarla en **Ajustes → Seguridad**.

## Desactivarla, códigos nuevos y dispositivos

En **Ajustes → Seguridad**:

- **Generar códigos nuevos**: los anteriores dejan de valer.
- **Olvidar** un dispositivo, u **Olvidar todos**.
- **Desactivar la verificación en dos pasos**.

Desactivar, generar códigos y olvidar todos piden un código de tu app (o de recuperación) y tu
contraseña si tienes una: alguien con tu sesión abierta no puede quitarla. Cambiar la contraseña
también olvida los dispositivos recordados.

## Detalles técnicos

- Códigos TOTP estándar (RFC 6238: SHA-1, 6 cifras, 30 s, ±30 s de margen). Cada código vale una
  sola vez. Si la app da códigos que no funcionan, comprueba que la hora del móvil es automática.
- La clave de la app se guarda cifrada con una clave derivada de **`APP_SECRET`**. **Si cambias
  `APP_SECRET`, nadie podrá entrar con su código**: haz el reinicio de arriba para cada cuenta
  que la tenga activada y que la vuelvan a activar.
- Límites: 5 códigos cada 15 minutos y 20 al día por cuenta, 30 cada 15 minutos por conexión, y
  5 por intento de entrada. Al 3.er código fallado te avisamos por email.
- Las alumnas no tienen verificación en dos pasos (un móvil perdido sería un reinicio en el
  servidor para ti). Las admins sin página la tienen en **Administración → Seguridad**.
