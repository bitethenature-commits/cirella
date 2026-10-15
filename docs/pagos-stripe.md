# Pagos con Stripe Connect

Cómo cobra Cirella las ventas de las creadoras, qué hay que configurar en Stripe antes de lanzar,
cómo se prueba y qué decisiones quedan pendientes. El código está en `lib/payments/` (pasarelas),
`lib/payouts.ts` (cuentas de cobro), `lib/payments/events.ts` (avisos de Stripe) y `lib/dac7*.ts`
(declaración a Hacienda).

---

## Cómo funciona

**Venta (Checkout alojado + cargos de destino)**

1. La compradora rellena nombre y email en el checkout de la creadora y pulsa «Pagar».
   `startOrderPayment` (lib/orders.ts) crea una sesión de **Stripe Checkout** y la lleva a la
   página de Stripe: tarjeta, Apple Pay y Google Pay. 3D Secure lo resuelve Stripe y ningún dato de
   tarjeta pasa por nuestro servidor (nada de PCI más allá del SAQ A).
2. El cobro es un **cargo de destino**: lo cobra la cuenta de plataforma de Cirella,
   `application_fee_amount` es la comisión de Cirella (`Order.platformFeeCents`) y el resto se
   transfiere a la cuenta Express de la creadora (`transfer_data.destination`).
3. Stripe avisa por webhook (`/api/webhooks/stripe`) y la compradora vuelve por
   `/api/payments/return?ref=cs_…`. Las dos vías acaban en `applyPaymentUpdate`, que comprueba
   **importe, moneda y cuenta de destino** contra el pedido y entrega con `fulfillOrder`. Llegue
   primero lo que llegue, la venta se entrega una sola vez (fila bloqueada `FOR UPDATE`).
4. Si el banco tarda («pago pendiente»), el pedido queda `PROCESSING` y la página de gracias dice
   «Pago pendiente de confirmar» y se refresca sola. Si al final falla, la compradora recibe un
   email con «Intentarlo de nuevo».
5. Un segundo cobro de un pedido ya pagado (dos pestañas, doble clic) se **reembolsa solo**.

**Membresías**: el primer pago guarda la tarjeta (`setup_future_usage=off_session`). Cada
renovación es un cargo sin la clienta delante (`chargeSaved`, con clave de idempotencia
`renewal:<sub>:<periodo>:<intento>`). Si falla: `PAST_DUE`, reintentos a +1 y +3 días, acceso
mientras tanto y email con «Pagar ahora»; al tercer fallo se cancela.

**Cuenta de cobro de la creadora (Connect Express)**: «Conectar con Stripe» crea la cuenta
Express y abre el formulario de Stripe (identidad, IBAN, dirección). El estado se guarda en
`Creator.payoutStatus` (NONE → PENDING → VERIFYING → ACTION_REQUIRED → ACTIVE / REJECTED) a partir
de `account.updated` y de la vuelta del formulario. **Solo se puede vender con la cuenta activa**
(`canAcceptPayments`: Stripe permite cobrar y la cuenta es de la pasarela actual). El embudo está
en /admin/creadoras.

**Reembolsos y contracargos**: los reembolsos se piden desde el panel (`refundOrder`,
lib/refunds.ts) y sus avisos (`refund.*`) actualizan su estado; los hechos directamente en el panel
de Stripe y los contracargos perdidos se registran como reembolsos de la pasarela
(`syncProviderRefund`), con los mismos efectos (acceso, sesión, libro y estadísticas). Los
contracargos se anotan en el pedido (`disputeStatus`) y se avisa por email a la creadora y a las
administradoras.

Las **renovaciones** de membresía no tienen pedido: un reembolso hecho en el panel de Stripe o un
contracargo perdido sobre una renovación se contabiliza contra su movimiento RENEWAL (fila REFUND,
rectificativa de su factura y, si se devuelve entera la renovación en curso, fin de la membresía),
y un contracargo abierto avisa igual a la creadora y a las administradoras. Un **contracargo
perdido** se carga en el libro a la creadora; como con cargos de destino Stripe se lo cobra a
Cirella y no revierte la transferencia, se recupera su parte con una reversión de la
transferencia (`recoverDispute`, clave `dispute-reversal:<id>`); si no se puede, alerta para
hacerlo a mano. Un **segundo cobro del mismo periodo** de renovación («Pagar ahora» a la vez que
el reintento automático, o pagar una suscripción que acaba de cancelarse) se devuelve solo
(`settleRenewalCharge`), y una segunda membresía pagada por la misma persona (dos páginas de pago
abiertas) no crea otra suscripción: ese pedido se reembolsa entero.

Los avisos `checkout.session.*` llegan sin el PaymentIntent expandido: `parseWebhook` pide la
sesión con `expand: ['payment_intent']` para saber la tarjeta guardada de las membresías (si Stripe
no responde, el aviso devuelve 500 y Stripe lo reintenta). Las sesiones de Checkout caducan a los
31 minutos: Stripe exige al menos 30 desde su propia hora de creación.

---

## Configuración en Stripe (antes de lanzar)

1. Crea la cuenta de Stripe de Cirella (España) y verifica la empresa.
2. **Connect** → activa Connect con cuentas **Express** y cargos de destino. Completa el perfil de
   plataforma y la marca de Express (logo, color, nombre «Cirella»): es lo que verán las creadoras.
3. Copia la clave secreta → `STRIPE_SECRET_KEY` (y la publicable → `STRIPE_PUBLISHABLE_KEY`).
4. **Desarrolladores → Webhooks**: crea **dos** endpoints con la misma URL,
   `https://<dominio>/api/webhooks/stripe`, y la versión de API que fija `stripe@22.6.2`:

   | Endpoint | Escucha | Secreto |
   |---|---|---|
   | Plataforma | Eventos de tu cuenta | `STRIPE_WEBHOOK_SECRET` |
   | Connect | «Eventos en cuentas conectadas» | `STRIPE_CONNECT_WEBHOOK_SECRET` |

   Eventos del endpoint de plataforma:
   `payment_intent.succeeded`, `payment_intent.processing`, `payment_intent.payment_failed`,
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`,
   `refund.created`, `refund.updated`, `refund.failed`,
   `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`.

   Eventos del endpoint de Connect: `account.updated`, `account.application.deauthorized`.

5. Variables (ver README, tabla «Configuración»): `PAYMENT_PROVIDER=stripe`, las tres claves
   anteriores, `STRIPE_CONNECT_WEBHOOK_SECRET` y, si se decide así, `STRIPE_ON_BEHALF_OF=true`.
   La app valida al arrancar que estén y tengan el formato correcto.

Cada aviso se guarda en la tabla `PaymentEvent` (tipo, estado, error, intentos): un aviso repetido
no se aplica dos veces y, si algo falla, se responde 500 para que Stripe lo reintente.

---

## Pruebas

**Sin red (lo que se ejecuta en CI)**: Stripe no es accesible desde el contenedor de desarrollo.
`createStripeProvider(clienteFalso)` permite probar los parámetros que se envían, y las firmas de
los webhooks se generan con `stripe.webhooks.generateTestHeaderString`
(`scripts/unit/payments.test.ts`).

**Con Stripe en modo prueba (obligatorio antes de lanzar)**:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe            # copia el whsec_ → STRIPE_WEBHOOK_SECRET
stripe listen --forward-connect-to localhost:3000/api/webhooks/stripe    # → STRIPE_CONNECT_WEBHOOK_SECRET
PAYMENT_PROVIDER=stripe npm run dev
```

Tarjetas de prueba de Stripe: `4242 4242 4242 4242` (aprobada), `4000 0027 6000 3184` (pide 3D
Secure), `4000 0000 0000 0002` (rechazada), `4000 0000 0000 0341` (se guarda pero falla al
renovar). En el formulario de Express, el código de verificación SMS de prueba es `000 000`.

**Simulador (demo y desarrollo, `PAYMENT_PROVIDER=simulated`)**: el mismo ciclo de vida sin
dinero. En el checkout se escribe la tarjeta: `4242…` se aprueba al momento, `…0002` se rechaza,
`4000 0027 6000 3184` lleva a `/pago-simulado/<ref>` («Confirmar el pago», «El banco tarda»,
«Cancelar») y `…0341` falla en la renovación. «Conectar con Stripe» lleva a
`/pago-simulado/cuenta` («Verificar al instante», «Dejar en verificación», «Falta un documento»).
Esas páginas no existen con Stripe real.

---

## Decisiones pendientes (fundadora + asesoría)

- **Quién es el comerciante.** Lo construido son cargos de destino: la cuenta de Cirella es la que
  cobra, paga las comisiones de Stripe y responde en primera instancia de reembolsos y
  contracargos (los reembolsos se recuperan de la creadora con `reverse_transfer`; los
  contracargos perdidos, con una reversión de la transferencia por su parte; la tarifa de Stripe
  por contracargo, ≈ 15 €, la absorbe Cirella). Con Express, Cirella responde además de los saldos negativos
  de las cuentas conectadas. `STRIPE_ON_BEHALF_OF=true` hace a la creadora comerciante de
  liquidación (su nombre en el extracto). Si la asesoría quiere que la creadora sea la
  comerciante completa (cargos directos), es otro cambio y no está hecho.
- **Economía.** La comisión de Stripe (≈ 1,5 % + 0,25 € con tarjetas del EEE) sale de la comisión
  de Cirella. Con el plan Pro (2 %) y tickets pequeños Cirella pierde dinero: en una venta de 10 €
  la comisión es 0,20 € y Stripe cobra ≈ 0,40 €. Decidir comisión mínima por venta, otra comisión o
  repercutir la tarifa.
- **Reembolsos** (lib/refunds.ts): hoy Cirella devuelve su comisión en proporción
  (`refund_application_fee: true`) y `reverse_transfer` va siempre activado. Stripe no devuelve su
  propia tarifa: con cargos de destino la pierde Cirella. Decidir si se mantiene, si la comisión se
  queda en los reembolsos que inicia la creadora y quién absorbe la tarifa de Stripe. Fuera de
  alcance por ahora: un botón para reembolsar renovaciones de membresía desde el panel (los
  reembolsos hechos en Stripe sí se contabilizan) y reembolsos desde /admin.
- **Desistimiento (abogada)**: reglas en `withdrawalEligibility` (lib/refund-math.ts): 14 días
  naturales desde el pago; no cabe si la sesión ya empezó o se hizo, ni en digital/cursos/membresías
  con renuncia expresa en el checkout (`Order.waiverAcceptedAt`, punto #3) una vez empezado el
  acceso (primera descarga, reproducción o visita a las publicaciones: `Order.metadata.firstAccessAt`);
  los productos digitales que prepara la creadora («Lo preparo yo») no piden renuncia; si cabe, se devuelve todo
  lo que queda (también en membresías, sin prorrateo: el art. 108.3 TRLGDCU permitiría cobrar la
  parte disfrutada). Confirmar también si la creadora puede «Cancelar sin reembolso» una sesión
  pagada (hoy sí, con motivo obligatorio y aviso) o solo cuando la clienta no se presentó.
- **Factura rectificativa (asesoría, punto #4)**: cada reembolso completado emite el evento
  `order.refunded` {orderId, refundId} para engancharla.
- **Bizum**: Stripe no lo ofrece. Lo construido es tarjeta + Apple Pay + Google Pay (sin SEPA:
  una reserva no puede esperar días). Bizum necesitaría Redsys más adelante; el estado
  «pago pendiente» ya lo admitiría.
- **Cuotas de los planes de las creadoras**: siguen simuladas (fuera de este punto). Podrían ir con
  Stripe Billing en la cuenta de plataforma.
- **Textos legales (#3)**: las condiciones de las creadoras deben enlazar el *Connected Account
  Agreement* de Stripe y decir que los pagos los procesa Stripe; las de compra, que la tarjeta se
  guarda para renovar las membresías.

### DAC7 (modelo 238)

Cirella, como plataforma, informa cada año a la AEAT de lo que cobra cada vendedora por
«servicios personales». Lo construido:

- Datos que faltan: nombre legal, NIF y dirección (página de datos legales), fecha de nacimiento,
  IBAN (validado y siempre enmascarado) y confirmación, en /panel/ajustes/cobros. Stripe Express
  **no** nos da el IBAN ni el documento de la creadora, por eso se piden aquí.
- Recordatorios diarios en el cron: petición con la primera venta declarable del año y
  recordatorios a los 20 y 40 días. A los 60 días, con dos recordatorios y datos incompletos, se
  **pausan las ventas** de productos declarables (no las demás).
- Informe por trimestres (hora de España) en /admin/reportes/dac7 y CSV con los campos del
  modelo 238.

Pendiente de confirmar con la asesoría:

1. Qué tipos de producto son «servicios personales» (por defecto, solo sesiones; se cambia en
   /admin/reportes/dac7). ¿Cursos con directos? ¿Membresías con llamadas?
2. Contraprestación = importe neto de la comisión de Cirella, comisiones aparte, reembolsos
   restados en el trimestre en que ocurren, trimestres en hora de España.
3. Si el IBAN es obligatorio para nosotros.
4. La sanción elegida (pausar ventas a los 60 días). La alternativa legal es retener los cobros
   (posible con pagos manuales de Stripe; no está hecha).
5. Alta de Cirella como operador de plataforma en la AEAT y presentación del modelo 238 antes del
   31 de enero. El CSV no es el fichero oficial: lo prepara la asesoría.
6. Enviar a cada vendedora sus datos en el mismo plazo (el panel ya muestra «Lo que declararemos a
   Hacienda»).
7. Cuánto tiempo se guardan NIF, fecha de nacimiento e IBAN (registro de actividades del RGPD).
   Se guardan en columnas normales y dependen del cifrado en reposo del Postgres gestionado; nunca
   se muestran completos ni se envían a Sentry.
