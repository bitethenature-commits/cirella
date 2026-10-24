import { isLocalDevIp } from "./client-ip";
import { isPersonalMode } from "./site-mode";
import { hit, peek, resetKey, retryAfterText, rlKey, type Rule } from "./rate-limit";
import { turnstileEnabled, turnstileSiteKey, verifyTurnstile } from "./turnstile";

/**
 * Límites de intentos: la tabla de políticas y las guardas que usan el login, los enlaces de
 * acceso, el checkout, las visitas, los horarios y las subidas. Los contadores van en Postgres
 * (lib/rate-limit.ts) con claves HMAC: ni IP ni emails en claro.
 *
 * Las guardas «por conexión» reciben el hash de la IP (lib/client-ip.ts). Fuera de producción no
 * cuentan las peticiones desde localhost (ver isLocalDevIp); los límites por email sí.
 */

const MIN = 60;
const HOUR = 3600;

export const RULES = {
  // Login con contraseña: por email (adivinar una contraseña) y por conexión (probar muchos emails).
  loginEmail: { limit: 5, windowSec: 15 * MIN },
  loginIp: { limit: 30, windowSec: 15 * MIN },
  // Enlaces de acceso por email: cada uno sale al momento hacia cualquier buzón.
  magicEmail: { limit: 3, windowSec: HOUR },
  magicIp: { limit: 10, windowSec: HOUR },
  // Altas de cuenta nuevas.
  signupIp: { limit: 10, windowSec: HOUR },
  // Intentos de pago. El de conexión es holgado: con el CGNAT de las operadoras móviles muchas
  // compradoras comparten IP. Lo que de verdad frena el probar tarjetas son los rechazos.
  checkoutEmail: { limit: 5, windowSec: 10 * MIN },
  checkoutIp: { limit: 20, windowSec: 10 * MIN },
  // Pagos rechazados: bloqueo al llegar a 5, por conexión y por email.
  checkoutFail: { limit: 5, windowSec: 10 * MIN },
  // Subidas por creadora (montar un curso con muchas lecciones son muchas subidas seguidas).
  uploadCreator: { limit: 30, windowSec: HOUR },
  // Web personal: una sola dueña que paga su propio R2 y monta cursos enteros de una sentada.
  uploadCreatorPersonal: { limit: 120, windowSec: HOUR },
  // Partes de las subidas por partes (web personal): un vídeo de 4 GB son 256 partes.
  uploadParts: { limit: 600, windowSec: HOUR },
  // Horarios de una sesión (calcula 28 días de huecos en cada petición).
  slotsIp: { limit: 60, windowSec: MIN },
  // Visitas: el mismo evento de la misma persona cuenta una vez cada 30 minutos…
  trackDedupe: { limit: 1, windowSec: 30 * MIN },
  // …y como mucho 300 eventos por hora desde una conexión a una creadora.
  trackIpCreator: { limit: 300, windowSec: HOUR },
  // Email de compra abandonada: uno por destinatario cada 24 h, sea de la creadora que sea.
  recoveryRecipient: { limit: 1, windowSec: 24 * HOUR },
  // Acceso gratis con email (formulario de la ficha): cada intento manda un email a cualquier buzón.
  // Por email: el primero da el acceso y los siguientes reenvían el enlace. Por conexión, holgado
  // (CGNAT de las operadoras móviles, una clase que se apunta desde la misma wifi).
  freeClaimEmail: { limit: 5, windowSec: HOUR },
  freeClaimIp: { limit: 20, windowSec: HOUR },
  // Comunidad: comentarios y «me gusta» por persona.
  commentUser: { limit: 20, windowSec: HOUR },
  likeUser: { limit: 300, windowSec: HOUR },
} satisfies Record<string, Rule>;

/** Pagos rechazados a partir de los cuales el checkout pide el captcha (si está configurado). */
export const CAPTCHA_AFTER_FAILURES = 2;

export type Verdict = { ok: true } | { ok: false; message: string; retryAfterSec: number };
export type CheckoutVerdict = { ok: true } | { ok: false; message: string; needsCaptcha?: boolean; captchaSiteKey?: string };

const OK = { ok: true } as const;
const denied = (message: (t: string) => string, retryAfterSec: number): Verdict => ({ ok: false, message: message(retryAfterText(retryAfterSec)), retryAfterSec });

/** Cuenta un intento por conexión (no cuenta desde localhost fuera de producción). */
async function hitConnection(scope: string, ipHash: string, rule: Rule, ...parts: string[]) {
  if (isLocalDevIp(ipHash)) return { ok: true, count: 0, retryAfterSec: 0 };
  return hit(rlKey(scope, ...parts, ipHash), rule);
}

// ── Login, enlaces de acceso y registro ──

export async function limitLogin(email: string, ipHash: string): Promise<Verdict> {
  const ip = await hitConnection("login-ip", ipHash, RULES.loginIp);
  if (!ip.ok) return denied((t) => `Demasiados intentos desde esta conexión. Espera ${t} y vuelve a probar.`, ip.retryAfterSec);
  const byEmail = await hit(rlKey("login-email", email), RULES.loginEmail);
  if (!byEmail.ok) return denied((t) => `Demasiados intentos con este email. Espera ${t} o entra con un enlace mágico.`, byEmail.retryAfterSec);
  return OK;
}

/** Al acertar la contraseña, el contador del email vuelve a cero. */
export async function clearLoginLimit(email: string): Promise<void> {
  await resetKey(rlKey("login-email", email));
}

export async function limitMagicLink(email: string, ipHash: string): Promise<Verdict> {
  const ip = await hitConnection("magic-ip", ipHash, RULES.magicIp);
  if (!ip.ok) return denied((t) => `Demasiadas solicitudes desde esta conexión. Prueba de nuevo en ${t}.`, ip.retryAfterSec);
  const byEmail = await hit(rlKey("magic-email", email), RULES.magicEmail);
  if (!byEmail.ok)
    return denied((t) => `Ya te hemos enviado varios enlaces. Revisa tu bandeja de entrada y la carpeta de spam, o pide otro en ${t}.`, byEmail.retryAfterSec);
  return OK;
}

export async function limitSignup(ipHash: string): Promise<Verdict> {
  const ip = await hitConnection("signup-ip", ipHash, RULES.signupIp);
  if (!ip.ok) return denied((t) => `Demasiados registros desde esta conexión. Prueba de nuevo en ${t}.`, ip.retryAfterSec);
  return OK;
}

// ── Checkout ──

export function captchaRequired(failures: number, enabled: boolean): boolean {
  return enabled && failures >= CAPTCHA_AFTER_FAILURES;
}

const failIpKey = (ipHash: string) => rlKey("checkout-fail-ip", ipHash);
const failEmailKey = (email: string) => rlKey("checkout-fail-email", email);

/** Pagos rechazados recientes de esta conexión o de este email (el mayor de los dos). */
async function recentFailures(email: string, ipHash: string) {
  const [byIp, byEmail] = await Promise.all([
    isLocalDevIp(ipHash) ? { count: 0, retryAfterSec: 0 } : peek(failIpKey(ipHash)),
    peek(failEmailKey(email)),
  ]);
  return byIp.count >= byEmail.count ? byIp : byEmail;
}

/**
 * Antes de cada intento de pago:
 *   a) bloqueo tras 5 rechazos en 10 minutos (por conexión o por email);
 *   b) a partir del 2.º rechazo, el captcha de Turnstile si está configurado. Va antes de gastar
 *      intentos; si Cloudflare no responde, se deja pasar (siguen los límites duros);
 *   c) los intentos por conexión y por email.
 */
export async function checkoutGate(i: { email: string; ip: string; ipHash: string; turnstileToken?: string | null }): Promise<CheckoutVerdict> {
  const fails = await recentFailures(i.email, i.ipHash);
  if (fails.count >= RULES.checkoutFail.limit)
    return { ok: false, message: `Demasiados pagos rechazados. Por seguridad, espera ${retryAfterText(fails.retryAfterSec)} antes de volver a intentarlo.` };

  if (captchaRequired(fails.count, turnstileEnabled())) {
    const captcha = await verifyTurnstile(i.turnstileToken, i.ip);
    if (captcha === "invalid")
      return {
        ok: false,
        needsCaptcha: true,
        captchaSiteKey: turnstileSiteKey() ?? undefined,
        message: i.turnstileToken
          ? "No hemos podido comprobar que eres una persona. Vuelve a intentarlo."
          : "Por seguridad, espera a que termine la comprobación y vuelve a pulsar el botón de pago.",
      };
  }

  const ip = await hitConnection("checkout-ip", i.ipHash, RULES.checkoutIp);
  if (!ip.ok) return { ok: false, message: `Demasiados intentos de pago desde esta conexión. Espera ${retryAfterText(ip.retryAfterSec)}.` };
  const byEmail = await hit(rlKey("checkout-email", i.email), RULES.checkoutEmail);
  if (!byEmail.ok)
    return { ok: false, message: `Demasiados intentos de pago con este email. Espera ${retryAfterText(byEmail.retryAfterSec)} y vuelve a intentarlo.` };
  return OK;
}

/**
 * Anota un pago rechazado (en el checkout, o desde el aviso de la pasarela con Order.ipHash) y dice
 * si el siguiente intento necesitará el captcha. Un pago que queda pendiente no es un rechazo.
 */
export async function noteCheckoutFailure(i: { email: string; ipHash: string | null }): Promise<{ needsCaptcha: boolean; captchaSiteKey?: string }> {
  const byEmail = await hit(failEmailKey(i.email), RULES.checkoutFail);
  const byIp = i.ipHash && !isLocalDevIp(i.ipHash) ? await hit(failIpKey(i.ipHash), RULES.checkoutFail) : null;
  const needsCaptcha = captchaRequired(Math.max(byEmail.count, byIp?.count ?? 0), turnstileEnabled());
  return needsCaptcha ? { needsCaptcha, captchaSiteKey: turnstileSiteKey() ?? undefined } : { needsCaptcha };
}

// ── Acceso gratis con email ──

/** Antes de cada «Quiero el acceso» de la ficha: por conexión y por email (en todos los productos). */
export async function limitFreeClaim(email: string, ipHash: string): Promise<Verdict> {
  const ip = await hitConnection("free-claim-ip", ipHash, RULES.freeClaimIp);
  if (!ip.ok) return denied((t) => `Demasiadas solicitudes desde esta conexión. Prueba de nuevo en ${t}.`, ip.retryAfterSec);
  const byEmail = await hit(rlKey("free-claim-email", email), RULES.freeClaimEmail);
  if (!byEmail.ok)
    return denied((t) => `Ya te hemos enviado el enlace varias veces. Revisa tu bandeja de entrada y la carpeta de spam, o vuelve a pedirlo en ${t}.`, byEmail.retryAfterSec);
  return OK;
}

// ── Comunidad ──

export async function limitComment(userId: string): Promise<Verdict> {
  const r = await hit(rlKey("comment", userId), RULES.commentUser);
  if (!r.ok) return denied((t) => `Has comentado mucho en poco tiempo. Espera ${t}.`, r.retryAfterSec);
  return OK;
}

export async function limitLike(userId: string): Promise<Verdict> {
  const r = await hit(rlKey("like", userId), RULES.likeUser);
  if (!r.ok) return denied((t) => `Demasiados «me gusta» seguidos. Espera ${t}.`, r.retryAfterSec);
  return OK;
}

// ── Subidas, horarios y visitas ──

/** Se cuenta al pedir la URL de subida (/api/upload/sign), no al completarla. */
export async function limitUpload(creatorId: string): Promise<Verdict> {
  const r = await hit(rlKey("upload", creatorId), isPersonalMode() ? RULES.uploadCreatorPersonal : RULES.uploadCreator);
  if (!r.ok) return denied((t) => `Has subido muchos archivos en poco tiempo. Espera ${t} y sigue subiendo.`, r.retryAfterSec);
  return OK;
}

/** Firmas de partes de una subida por partes (web personal). */
export async function limitUploadParts(creatorId: string): Promise<Verdict> {
  const r = await hit(rlKey("upload-parts", creatorId), RULES.uploadParts);
  if (!r.ok) return denied((t) => `Demasiadas partes en poco tiempo. Espera ${t} y vuelve a intentarlo.`, r.retryAfterSec);
  return OK;
}

export async function limitSlots(ipHash: string): Promise<Verdict> {
  const r = await hitConnection("slots-ip", ipHash, RULES.slotsIp);
  if (!r.ok) return { ok: false, message: "Demasiadas peticiones. Espera un momento.", retryAfterSec: r.retryAfterSec };
  return OK;
}

/**
 * ¿Se registra este evento de métricas? La misma persona (IP + navegador) no cuenta dos veces el
 * mismo evento en 30 minutos; la cookie no sirve porque la controla el cliente. Y una conexión no
 * puede mandar más de 300 eventos por hora a una creadora.
 */
export async function shouldRecordTrack(i: { creatorId: string; type: string; productId?: string | null; ipHash: string; ua: string }): Promise<boolean> {
  const cap = await hitConnection("track-ip", i.ipHash, RULES.trackIpCreator, i.creatorId);
  if (!cap.ok) return false;
  const once = await hit(rlKey("track", i.creatorId, i.type, i.productId ?? "-", i.ipHash, i.ua), RULES.trackDedupe);
  return once.ok;
}
