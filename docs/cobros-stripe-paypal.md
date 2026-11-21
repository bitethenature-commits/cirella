# Cobrar en tu web con tarjeta (Stripe) y PayPal

Con esto, quien compra en tu web paga allí mismo, con tarjeta (también Apple Pay y Google Pay) o
con PayPal, y **todo lo demás pasa solo**:

- el acceso al curso, la descarga o la membresía se abre al momento;
- le llega el email de compra con su enlace para entrar (sin contraseña);
- una sesión o lectura queda reservada en la fecha que eligió, y las dos recibís el aviso;
- las membresías se renuevan solas cada mes o cada año y, si se cancela o falla el pago, el
  acceso se corta al final del periodo pagado;
- los reembolsos se hacen desde **Ventas** en tu panel, con un botón;
- tu web no se queda ninguna comisión. Solo pagas la de Stripe o la de PayPal.

Guía para hacerlo sin saber programar. Calcula **una hora**. Sigue los pasos en orden: al final
pegarás 6 valores en tu hosting (Railway o Render).

> **Antes de nada, el IVA.** Cobrando en tu web, quien vende eres tú (tu LLC). Si vendes cursos,
> descargas o membresías a personas de la Unión Europea, el IVA europeo se debe desde el primer
> euro, aunque tu empresa sea de EE. UU. Para eso existe la «ventanilla única no Unión»
> (non-Union OSS). Tu web ya sabe cobrarlo por países (paso 5), pero **decide con tu asesor
> fiscal** si te das de alta. Mientras no lo actives, los precios no llevan IVA.

---

## Paso 1 · Stripe (tarjeta, Apple Pay y Google Pay)

1. Entra en [dashboard.stripe.com/register](https://dashboard.stripe.com/register) y crea la
   cuenta **a nombre de tu LLC**: país **Estados Unidos**, tipo de empresa **LLC**, su número
   fiscal (**EIN**) y la cuenta bancaria de la empresa. Stripe te pedirá también tus datos como
   representante. Acaba la activación hasta que ponga que puedes aceptar pagos.
2. **Settings → Payment methods**: deja activadas las **tarjetas**, **Apple Pay** y **Google Pay**.
3. **Settings → Public details**: pon el nombre que verán tus clientas en su extracto bancario
   (por ejemplo `CIRELLA SCHAFER`) y tu email de soporte.
4. **Developers → API keys**: en **Secret key** pulsa «Reveal» y copia la clave (empieza por
   `sk_live_`). Apúntala como `STRIPE_SECRET_KEY`.
5. **Developers → Webhooks → Add endpoint**:
   - **Endpoint URL**: `https://tudominio.com/api/webhooks/stripe` (sin dominio todavía: tu
     dirección de Railway o Render seguida de `/api/webhooks/stripe`).
   - **Events**: añade estos 13:
     `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`,
     `payment_intent.succeeded`, `payment_intent.processing`, `payment_intent.payment_failed`,
     `refund.created`, `refund.updated`, `refund.failed`,
     `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`.
   - Guarda y, en la página del endpoint, copia el **Signing secret** (empieza por `whsec_`).
     Apúntalo como `STRIPE_WEBHOOK_SECRET`.

Tus precios están en euros. Una cuenta de Stripe de EE. UU. cobra en euros y te paga en dólares:
Stripe convierte y cobra un pequeño porcentaje por ello (mira
[stripe.com/pricing](https://stripe.com/pricing)).

> **¿Por qué PayPal no va dentro de Stripe?** Stripe solo ofrece PayPal en su página de pago a
> cuentas de Europa. Tu LLC tiene una cuenta de EE. UU., así que tu web se conecta a PayPal
> directamente (paso 2). Para tus clientas es igual de fácil: eligen «PayPal», pagan en PayPal y
> vuelven a tu web con todo desbloqueado.

---

## Paso 2 · PayPal

1. Necesitas una cuenta **PayPal Business** a nombre de tu LLC. Si tienes una personal, en
   PayPal puedes pasarla a Business, o crea una nueva en
   [paypal.com/business](https://www.paypal.com/business).
2. Entra en [developer.paypal.com](https://developer.paypal.com) con esa misma cuenta.
3. **Apps & Credentials**, arriba elige **Live** (no Sandbox) y pulsa **Create App**: ponle un
   nombre (por ejemplo `Mi web`), tipo **Merchant**, y créala.
4. En la app verás **Client ID** y **Secret** (pulsa «Show»). Apúntalos como
   `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET`.
5. En la misma app, en **Features**, marca **Save payment methods** (guardar la forma de pago):
   así las membresías pagadas con PayPal se renuevan solas. Si PayPal no te deja activarlo, no
   pasa nada: las membresías con PayPal se pagan igual, y cada mes tu clienta recibe un email con
   el botón «Pagar ahora».
6. Más abajo, en **Webhooks → Add Webhook**:
   - **Webhook URL**: `https://tudominio.com/api/webhooks/paypal`.
   - **Event types**: marca estos 9: *Checkout order approved*, *Payment capture completed*,
     *Payment capture pending*, *Payment capture denied*, *Payment capture declined*,
     *Payment capture refunded*, *Customer dispute created*, *Customer dispute updated* y
     *Customer dispute resolved*.
   - Guarda y copia el **Webhook ID** que aparece en la lista. Apúntalo como `PAYPAL_WEBHOOK_ID`.

---

## Paso 3 · Pegar los valores en tu hosting

En **Railway** (servicio **web → Variables**) o en **Render** (**mi-web → Environment**), cambia
`PAYMENT_PROVIDER` y añade las demás:

```bash
PAYMENT_PROVIDER="stripe,paypal"
STRIPE_SECRET_KEY="PEGA_AQUI_TU_STRIPE_SECRET_KEY"
STRIPE_WEBHOOK_SECRET="PEGA_AQUI_TU_STRIPE_WEBHOOK_SECRET"
PAYPAL_CLIENT_ID="PEGA_AQUI_TU_PAYPAL_CLIENT_ID"
PAYPAL_CLIENT_SECRET="PEGA_AQUI_TU_PAYPAL_CLIENT_SECRET"
PAYPAL_WEBHOOK_ID="PEGA_AQUI_TU_PAYPAL_WEBHOOK_ID"
PAYPAL_ENV="live"
```

- ¿Solo uno de los dos? `PAYMENT_PROVIDER="stripe"` o `PAYMENT_PROVIDER="paypal"`, y solo sus
  variables.
- Guarda y vuelve a desplegar (Railway: **Deploy**; Render lo hace solo). Si falta o sobra algo,
  el despliegue se para y el registro dice exactamente qué variable revisar.

**Comprobación:** en tu panel, **Ajustes** enseña la tarjeta **«Cobros en tu web»** con los dos
métodos en verde y la dirección de sus avisos (la misma que pegaste en Stripe y PayPal). El menú
dice **Ventas** en vez de «Inscripciones».

---

## Paso 4 · Tus datos legales

En **Ajustes → Datos legales**, el titular es tu LLC: su nombre completo (con «LLC»), su EIN en
el campo del número fiscal, su dirección y tu email de contacto. Salen en tu aviso legal, en las
condiciones de venta y en cada compra (la ley de consumo lo exige).

Tu web ya tiene, en **Ajustes → Datos legales**, unas **condiciones de venta**, una **política de
cambios y reembolsos** (con el formulario de desistimiento) y una **privacidad** que nombra a
Stripe y PayPal. Son borradores: revísalos con tu asesoría y cámbialos si hace falta.

---

## Paso 5 · El IVA

En **Ajustes → IVA** elige una:

- **No cobro IVA**: los precios no llevan IVA. Es lo que tienes hasta que tu asesor diga otra cosa.
- **Mi empresa es de fuera de la UE y está dada de alta en la ventanilla única «no Unión»**: cada
  clienta de la UE paga el IVA de su país en cursos, descargas y membresías (por ejemplo, 21 % en
  España o 19 % en Alemania), **incluido en el precio** que ves. Fuera de la UE y en las sesiones o
  lecturas en directo, sin IVA europeo. Cada factura lleva su IVA y la web guarda el país de cada
  compra, que es lo que declaras cada trimestre en la ventanilla única.

Tu precio no cambia: si un curso cuesta 50 €, la clienta paga 50 € y, con IVA, una parte de esos
50 € es el impuesto.

---

## Paso 6 · Prueba con una compra de verdad

1. Crea un producto de prueba a **1 €** (Productos → Nuevo → «Pago en la web») y publícalo.
2. Cómpralo tú desde el móvil con tarjeta, y otra vez con PayPal.
3. Comprueba que: te llega el email de compra, el producto aparece en el área de alumna y la venta
   sale en **Ventas**.
4. Desde **Ventas → la venta → Reembolsar**, devuélvelo. Te llega el email de reembolso y el
   dinero vuelve a tu tarjeta o a tu PayPal en unos días.
5. Archiva el producto de prueba.

---

## Qué pasa en cada caso

| Situación | Qué hace la web sola |
|---|---|
| Compra con tarjeta o PayPal | Abre el acceso, envía el email de compra y, si es una sesión, confirma la fecha |
| La compradora cierra la pestaña de PayPal después de pagar | PayPal avisa a la web y la compra se entrega igual |
| La compradora vuelve atrás y paga de otra forma | El primer pago no se cobra: nadie paga dos veces |
| Pago rechazado | Vuelve a la página de pago con el motivo, para intentarlo otra vez |
| Renovación de una membresía | Se cobra sola el día que toca. Si falla, se reintenta al día siguiente y a los 3 días, con un email «Pagar ahora»; al tercer fallo se cancela y el acceso se corta |
| La clienta cancela su membresía | Mantiene el acceso hasta el final del periodo pagado y luego se corta |
| Reembolso desde tu panel | Devuelve el dinero por donde se pagó, quita el acceso si es total y envía el email |
| Reclamación (contracargo o disputa de PayPal) | Te avisa por email para que respondas en Stripe o PayPal; si la pierdes, la anota como reembolso |

Los avisos de Stripe y PayPal se comprueban con su firma: nadie puede desbloquear un curso
fingiendo un pago.
