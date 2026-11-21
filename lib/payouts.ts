import { createHash } from "node:crypto";
import { Prisma, type Creator } from "@prisma/client";
import { prisma } from "./db";
import { appUrl } from "./env";
import { enqueueEmail } from "./email/outbox";
import { payoutActionRequiredEmail, payoutActiveEmail, payoutRejectedEmail } from "./email/templates";
import { isPaymentProviderEnabled, paymentProvider, paymentProviderKey } from "./payments";
import type { PayoutAccountSnapshot } from "./payments/provider";
import { getSettings, SETTING_DEFAULTS } from "./settings";
import { siteMode, type SiteMode } from "./site-mode";

/**
 * Cuenta de cobro de cada creadora (Stripe Connect Express, o el simulador en demo).
 *
 * La creadora rellena el formulario de Stripe (identidad, IBAN, dirección). Stripe verifica y nos
 * avisa (webhook account.updated) o lo consultamos al volver del formulario; syncPayoutAccount
 * guarda el estado derivado. Solo se puede vender con canAcceptPayments(): Stripe permite cobrar
 * (charges_enabled) y la cuenta es de la pasarela actual (una cuenta del simulador nunca vende
 * en producción).
 *
 *   NONE            sin cuenta
 *   PENDING         cuenta creada, formulario sin terminar
 *   VERIFYING       datos enviados, Stripe revisando (minutos o un par de días hábiles)
 *   ACTION_REQUIRED Stripe pide algo más (un documento, el IBAN…)
 *   ACTIVE          puede cobrar (aunque Stripe pida algo para más adelante)
 *   REJECTED        Stripe ha rechazado la cuenta
 */
export type PayoutStatus = "NONE" | "PENDING" | "VERIFYING" | "ACTION_REQUIRED" | "ACTIVE" | "REJECTED";

export function derivePayoutStatus(s: PayoutAccountSnapshot | null): PayoutStatus {
  if (!s) return "NONE";
  if (s.disabledReason?.startsWith("rejected")) return "REJECTED";
  // Requisitos con fecha futura no paran los cobros: se muestran como aviso, no como estado.
  if (s.chargesEnabled) return "ACTIVE";
  const blockedByRequirements =
    s.currentlyDue.length > 0 ||
    s.pastDue.length > 0 ||
    (!!s.disabledReason?.startsWith("requirements.") && s.disabledReason !== "requirements.pending_verification");
  if (blockedByRequirements) return s.detailsSubmitted ? "ACTION_REQUIRED" : "PENDING";
  return s.detailsSubmitted ? "VERIFYING" : "PENDING";
}

/** Requisitos de Stripe → frases para la creadora (por prefijo, sin repetir y en orden). */
const REQUIREMENT_COPY: [prefix: string, text: string][] = [
  ["individual.verification.additional_document", "un justificante de domicilio"],
  ["individual.verification.document", "una foto de tu DNI, NIE o pasaporte"],
  ["individual.verification", "una foto de tu DNI, NIE o pasaporte"],
  ["external_account", "tu cuenta bancaria (IBAN)"],
  ["individual.dob", "tu fecha de nacimiento"],
  ["individual.address", "tu dirección"],
  ["individual.id_number", "tu NIF o NIE"],
  ["individual.first_name", "tu nombre completo"],
  ["individual.last_name", "tu nombre completo"],
  ["individual.phone", "tu teléfono"],
  ["individual.email", "tu email"],
  ["tos_acceptance", "aceptar las condiciones de Stripe"],
  ["business_profile", "la web y la actividad de tu negocio"],
  ["company.", "los datos de tu empresa"],
  ["representative", "los datos de la persona responsable de la empresa"],
  ["owners", "los datos de la persona responsable de la empresa"],
  ["directors", "los datos de la persona responsable de la empresa"],
  ["executives", "los datos de la persona responsable de la empresa"],
];
const OTHER_REQUIREMENT = "un dato más que pide Stripe";

export function describeRequirements(keys: string[]): string[] {
  const out: string[] = [];
  for (const key of keys) {
    const text = REQUIREMENT_COPY.find(([prefix]) => key.startsWith(prefix))?.[1] ?? OTHER_REQUIREMENT;
    if (!out.includes(text)) out.push(text);
  }
  return out;
}

/** «a, b y c» */
export function listEs(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

type PayoutFields = Pick<Creator, "status" | "payoutProvider" | "payoutStatus" | "payoutChargesEnabled" | "payoutPayoutsEnabled" | "payoutRequirements">;

/**
 * ¿Puede vender? La creadora está activa, Stripe le permite cobrar y su cuenta es de la pasarela
 * con la que cobramos ahora (las cuentas simuladas del seed nunca venden con Stripe). Sin pasarela
 * (PAYMENT_PROVIDER=none) ninguna cuenta coincide: nadie puede cobrar.
 * En la web personal no hay cuentas de cobro: cobra la dueña con sus propias cuentas de Stripe y/o
 * PayPal, así que basta con que esté activa y la pasarela también.
 */
export function canAcceptPayments(
  c: { payoutChargesEnabled: boolean; payoutProvider: string | null; status: string },
  providerKey: string = paymentProviderKey(),
  mode: SiteMode = siteMode(),
): boolean {
  if (mode === "personal") return c.status === "ACTIVE" && providerKey !== "none" && isPaymentProviderEnabled(providerKey);
  return c.status === "ACTIVE" && c.payoutChargesEnabled && c.payoutProvider === providerKey;
}

/**
 * Adónde va un cobro con esta pasarela: la cuenta Express de la creadora (plataforma, cargos de
 * destino) o, en la web personal, ninguna (`null`: cobro directo en la cuenta de la dueña).
 * null si ahora no puede cobrar con ella.
 */
export function chargeDestination(
  c: { payoutAccountId: string | null; payoutChargesEnabled: boolean; payoutProvider: string | null; status: string },
  providerKey: string,
  mode: SiteMode = siteMode(),
): { destination: string | null } | null {
  if (!canAcceptPayments(c, providerKey, mode)) return null;
  if (mode === "personal") return { destination: null };
  return c.payoutAccountId ? { destination: c.payoutAccountId } : null;
}

/** Requisitos guardados (instantánea de la pasarela sin el id de cuenta). */
export function storedRequirements(c: Pick<Creator, "payoutRequirements">): Omit<PayoutAccountSnapshot, "accountId" | "chargesEnabled" | "payoutsEnabled"> {
  const r = (c.payoutRequirements ?? {}) as Partial<PayoutAccountSnapshot>;
  return {
    detailsSubmitted: !!r.detailsSubmitted,
    currentlyDue: r.currentlyDue ?? [],
    pastDue: r.pastDue ?? [],
    eventuallyDue: r.eventuallyDue ?? [],
    pendingVerification: r.pendingVerification ?? [],
    disabledReason: r.disabledReason ?? null,
    currentDeadline: r.currentDeadline ?? null,
  };
}

export type PayoutView = {
  status: PayoutStatus;
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
  title: string;
  body: string;
  missing: string[];
  cta: string | null;
  canSell: boolean;
};

export const PAYOUT_STATUSES: PayoutStatus[] = ["NONE", "PENDING", "VERIFYING", "ACTION_REQUIRED", "ACTIVE", "REJECTED"];

function asPayoutStatus(s: string): PayoutStatus {
  return (PAYOUT_STATUSES as string[]).includes(s) ? (s as PayoutStatus) : "NONE";
}

const formatDeadline = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" });

/** Textos del estado de la cuenta de cobro (panel, onboarding y avisos). Pura. */
export function payoutView(c: PayoutFields, opts: { supportEmail?: string; providerKey?: string } = {}): PayoutView {
  const status = asPayoutStatus(c.payoutStatus);
  const req = storedRequirements(c);
  const due = describeRequirements([...req.pastDue, ...req.currentlyDue]);
  const canSell = canAcceptPayments(c, opts.providerKey);
  const base = { status, canSell, missing: [] as string[] };
  switch (status) {
    case "NONE":
      return {
        ...base,
        label: "Sin conectar",
        tone: "neutral",
        title: "Sin conectar",
        body: "Conecta tu cuenta de cobro para empezar a vender. El dinero llega directamente a tu banco.",
        cta: "Conectar con Stripe",
      };
    case "PENDING":
      return {
        ...base,
        label: "Pendiente",
        tone: "warning",
        title: "Pendiente",
        body: "Empezaste a conectar tu cuenta, pero falta terminar el formulario de Stripe.",
        missing: due,
        cta: "Continuar con Stripe",
      };
    case "VERIFYING":
      return {
        ...base,
        label: "Verificando",
        tone: "warning",
        title: "Verificación en curso",
        body: "Stripe está revisando tus datos. Suele tardar unos minutos y, como mucho, un par de días hábiles. Te avisaremos por email; mientras tanto nadie puede comprar.",
        cta: null,
      };
    case "ACTION_REQUIRED":
      return {
        ...base,
        label: "Falta algo",
        tone: "danger",
        title: "Te falta un paso",
        body: `Te falta subir ${listEs(due.length ? due : [OTHER_REQUIREMENT])}. Hasta entonces nadie puede comprar tus productos.`,
        missing: due,
        cta: "Completar en Stripe",
      };
    case "ACTIVE": {
      let body = "Ya puedes recibir pagos. Stripe envía el dinero a tu banco automáticamente (el primer ingreso suele tardar unos 7 días).";
      let cta: string | null = null;
      if (due.length) {
        body += ` ${req.currentDeadline ? `Antes del ${formatDeadline(req.currentDeadline)}` : "Pronto"} Stripe necesita ${listEs(due)}; si no, pausará tus cobros.`;
        cta = "Completar en Stripe";
      }
      if (!c.payoutPayoutsEnabled) {
        body += ` Stripe retendrá tus transferencias al banco hasta que completes ${listEs(due.length ? due : ["tus datos"])}.`;
        cta = "Completar en Stripe";
      }
      return { ...base, label: "Activada", tone: "success", title: "Activada", body, missing: due, cta };
    }
    case "REJECTED":
      return {
        ...base,
        label: "Rechazada",
        tone: "danger",
        title: "Cuenta rechazada",
        body: `Stripe no ha podido verificar tu cuenta. Escríbenos a ${opts.supportEmail ?? SETTING_DEFAULTS.supportEmail} y lo revisamos contigo.`,
        cta: null,
      };
  }
}

/**
 * Guarda el estado de la cuenta de cobro. Sin `snapshot` lo consulta a la pasarela, así que los
 * avisos que llegan desordenados no importan: siempre se guarda el estado actual.
 * Al cambiar de estado avisa a la creadora por email (con dedupeKey). Devuelve el estado o null
 * si la cuenta no es de ninguna creadora.
 */
export async function syncPayoutAccount(accountId: string, snapshot?: PayoutAccountSnapshot): Promise<PayoutStatus | null> {
  const creator = await prisma.creator.findUnique({ where: { payoutAccountId: accountId }, include: { user: { select: { email: true } } } });
  if (!creator) return null;
  const snap = snapshot ?? (await paymentProvider().getPayoutAccount(accountId));
  const status = derivePayoutStatus(snap);
  const now = new Date();
  const { accountId: _id, chargesEnabled, payoutsEnabled, ...requirements } = snap;
  await prisma.creator.update({
    where: { id: creator.id },
    data: {
      payoutStatus: status,
      payoutChargesEnabled: chargesEnabled,
      payoutPayoutsEnabled: payoutsEnabled,
      payoutRequirements: requirements as Prisma.InputJsonObject,
      payoutStatusUpdatedAt: now,
      payoutConnectedAt: status === "ACTIVE" ? (creator.payoutConnectedAt ?? now) : undefined,
    },
  });
  if (status !== creator.payoutStatus) await notifyPayoutStatus(creator, status, snap);
  return status;
}

async function notifyPayoutStatus(creator: Creator & { user: { email: string } }, status: PayoutStatus, snap: PayoutAccountSnapshot) {
  const base = { to: creator.user.email, creatorId: creator.id, userId: creator.userId, fromName: null, replyTo: null };
  const url = `${appUrl()}/panel/ajustes/cobros`;
  if (status === "ACTIVE") {
    await enqueueEmail({ ...base, template: "PAYOUT_ACTIVE", dedupeKey: `payout:${creator.id}:active`, ...payoutActiveEmail({ name: creator.displayName, panelUrl: url }) });
  } else if (status === "ACTION_REQUIRED") {
    const keys = [...snap.pastDue, ...snap.currentlyDue].sort();
    const hash = createHash("sha256").update(keys.join(",")).digest("hex").slice(0, 12);
    await enqueueEmail({
      ...base,
      template: "PAYOUT_ACTION_REQUIRED",
      dedupeKey: `payout:${creator.id}:action:${hash}`,
      ...payoutActionRequiredEmail({
        name: creator.displayName,
        missing: describeRequirements(keys),
        deadline: snap.currentDeadline ? formatDeadline(snap.currentDeadline) : null,
        url,
      }),
    });
  } else if (status === "REJECTED") {
    const { supportEmail } = await getSettings();
    await enqueueEmail({ ...base, template: "PAYOUT_REJECTED", dedupeKey: `payout:${creator.id}:rejected`, ...payoutRejectedEmail({ name: creator.displayName, supportEmail }) });
  }
}

/**
 * Enlace al formulario de Stripe para dar de alta o completar la cuenta. Crea la cuenta Express
 * si no la tiene (o si la que tiene es de otra pasarela, p. ej. del simulador).
 */
export async function payoutOnboardingLink(creatorId: string, from: "onboarding" | "panel"): Promise<string> {
  const provider = paymentProvider();
  const creator = await prisma.creator.findUniqueOrThrow({ where: { id: creatorId }, include: { user: { select: { email: true } } } });
  let accountId = creator.payoutAccountId;
  if (!accountId || creator.payoutProvider !== provider.key) {
    ({ accountId } = await provider.createPayoutAccount({
      creatorId: creator.id,
      email: creator.contactEmail ?? creator.user.email,
      country: creator.legalCountry || "ES",
      pageUrl: `${appUrl()}/${creator.username}`,
    }));
    await prisma.creator.update({
      where: { id: creator.id },
      data: {
        payoutProvider: provider.key,
        payoutAccountId: accountId,
        payoutStatus: "PENDING",
        payoutChargesEnabled: false,
        payoutPayoutsEnabled: false,
        payoutRequirements: Prisma.DbNull,
        payoutStatusUpdatedAt: new Date(),
      },
    });
  }
  return provider.payoutOnboardingUrl({
    accountId,
    returnUrl: `${appUrl()}/api/payments/connect/return?desde=${from}`,
    refreshUrl: `${appUrl()}/api/payments/connect/refresh?desde=${from}`,
  });
}

const RETURN_MESSAGE: Record<PayoutStatus, string> = {
  ACTIVE: "Cuenta de cobro activada: ya puedes vender",
  VERIFYING: "Datos enviados: Stripe está verificando tu cuenta",
  ACTION_REQUIRED: "Stripe necesita un dato más para activar tus cobros",
  PENDING: "Aún falta terminar el formulario de Stripe",
  NONE: "Cuenta de cobro actualizada",
  REJECTED: "Stripe no ha podido verificar tu cuenta",
};

/**
 * Adónde vuelve la creadora tras el formulario de Stripe: al onboarding si venía de él (y no lo ha
 * terminado) o a /panel/ajustes/cobros con un mensaje según el estado de la cuenta.
 */
export function payoutReturnPath(status: string | null, from: string | null, onboarded: boolean) {
  if (from === "onboarding" && !onboarded) return "/onboarding";
  return `/panel/ajustes/cobros?ok=${encodeURIComponent(RETURN_MESSAGE[asPayoutStatus(status ?? "NONE")])}`;
}
