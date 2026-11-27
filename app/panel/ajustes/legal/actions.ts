"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeTaxId, SESSION_CHANGE_NOTICE_HOURS, validatePostalCode, validateTaxId } from "@/lib/legal";
import { currentLegalKind } from "@/lib/commerce";
import { renderCreatorLegalTemplates, renderPersonalPrivacy, renderPersonalSalesTemplates, type CreatorLegalDocs } from "@/lib/legal-templates";
import { paymentProviderKeys } from "@/lib/payments";
import { legalIdentityOf } from "@/lib/legal-snapshot";
import { getSettings } from "@/lib/settings";

type Result = { ok: true } | { ok: false; error: string };

const back = (k: "ok" | "error", msg: string) => redirect(`/panel/ajustes/legal?${k}=${encodeURIComponent(msg)}`);

const identitySchema = z.object({
  legalEntityType: z.enum(["INDIVIDUAL", "COMPANY"], { error: "Elige si eres persona física o empresa" }),
  legalName: z.string().trim().min(3, "Escribe tu nombre fiscal completo").max(120, "Escribe tu nombre fiscal completo"),
  legalTaxId: z.string(),
  legalAddress: z.string().trim().min(5, "Escribe tu dirección").max(160, "Escribe tu dirección"),
  legalPostalCode: z.string().trim(),
  legalCity: z.string().trim().min(2, "Escribe la ciudad").max(80, "Escribe la ciudad"),
  legalCountry: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Elige el país"),
  legalEmail: z.string().trim().toLowerCase().email("Email no válido"),
  legalRegistry: z.string().trim().max(300, "Los datos registrales son demasiado largos").optional(),
});

/** Valida la identidad legal de un formulario (panel u onboarding) y la guarda en la creadora. */
export async function saveLegalIdentity(form: FormData): Promise<Result> {
  const { creator } = await requireCreator({ allowIncompleteOnboarding: true });
  const raw = Object.fromEntries(form);
  // «Otro» país: el código va en su propio campo.
  if (raw.legalCountry === "OTHER") raw.legalCountry = String(raw.legalCountryOther ?? "");
  const parsed = identitySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const taxError = validateTaxId(d.legalCountry, d.legalEntityType, d.legalTaxId);
  if (taxError) return { ok: false, error: taxError };
  const postalError = validatePostalCode(d.legalCountry, d.legalPostalCode);
  if (postalError) return { ok: false, error: postalError };

  // La fila de la creadora es el propio tenant: se actualiza por su id.
  await prisma.creator.update({
    where: { id: creator.id },
    data: {
      legalEntityType: d.legalEntityType,
      legalName: d.legalName,
      legalTaxId: normalizeTaxId(d.legalTaxId),
      legalAddress: d.legalAddress,
      legalPostalCode: d.legalPostalCode.toUpperCase(),
      legalCity: d.legalCity,
      legalCountry: d.legalCountry,
      legalEmail: d.legalEmail,
      legalRegistry: d.legalRegistry || null,
    },
  });
  revalidatePath("/panel", "layout");
  revalidatePath(`/${creator.username}`, "layout");
  return { ok: true };
}

/** Versión para <form action> del panel: vuelve a la página con el mensaje. */
export async function saveLegalIdentityForm(form: FormData) {
  const r = await saveLegalIdentity(form);
  if (!r.ok) back("error", r.error);
  back("ok", "Datos legales guardados");
}

const DOC_KEYS = ["terms", "refunds", "privacy"] as const satisfies readonly (keyof CreatorLegalDocs)[];
const DOC_FIELD = { terms: "legalTerms", refunds: "legalRefunds", privacy: "legalPrivacy" } as const;
const MAX_DOC_LENGTH = 20_000;

/**
 * Guarda los textos legales. Un texto igual a la plantilla se guarda como null para que siga las
 * mejoras de la plantilla; «Restaurar plantilla» (reset=terms|refunds|privacy) vuelve a ella.
 */
export async function saveLegalDocs(form: FormData) {
  const { creator } = await requireCreator();
  const { platformName } = await getSettings();
  // Plantillas de la web: la de la plataforma, la personal que cobra (sin plataforma) o, si no cobra,
  // solo la privacidad personal (sin plataforma ni pagos aquí).
  const kind = currentLegalKind();
  const template =
    kind === "personal-sales"
      ? renderPersonalSalesTemplates({ displayName: creator.displayName, changeNoticeHours: SESSION_CHANGE_NOTICE_HOURS, paymentKeys: paymentProviderKeys() })
      : renderCreatorLegalTemplates({
          identity: legalIdentityOf(creator),
          displayName: creator.displayName,
          platformName,
          changeNoticeHours: SESSION_CHANGE_NOTICE_HOURS,
        });
  if (kind === "personal") template.privacy = renderPersonalPrivacy({ displayName: creator.displayName });
  const reset = String(form.get("reset") ?? "");
  if (reset) {
    const key = DOC_KEYS.find((k) => k === reset);
    if (!key) back("error", "Texto no válido");
    await prisma.creator.update({ where: { id: creator.id }, data: { [DOC_FIELD[key!]]: null } });
  } else {
    const data: Partial<Record<(typeof DOC_FIELD)[keyof typeof DOC_FIELD], string | null>> = {};
    for (const key of DOC_KEYS) {
      const value = form.get(key);
      if (typeof value !== "string") continue;
      const text = value.replace(/\r\n/g, "\n").trim();
      if (text.length > MAX_DOC_LENGTH) back("error", "Uno de los textos es demasiado largo (máximo 20.000 caracteres)");
      data[DOC_FIELD[key]] = !text || text === template[key].trim() ? null : text;
    }
    await prisma.creator.update({ where: { id: creator.id }, data });
  }
  revalidatePath("/panel/ajustes/legal");
  revalidatePath(`/${creator.username}`, "layout");
  back("ok", reset ? "Plantilla restaurada" : "Textos guardados");
}
