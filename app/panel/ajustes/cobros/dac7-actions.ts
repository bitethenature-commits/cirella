"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { isValidIban, normalizeIban } from "@/lib/dac7";
import { prisma } from "@/lib/db";
import { isPersonalMode } from "@/lib/site-mode";

const back = (k: "ok" | "error", msg: string) => redirect(`/panel/ajustes/cobros?${k}=${encodeURIComponent(msg)}#datos-fiscales`);

const YEAR_MS = 365.25 * 86_400_000;

/** «YYYY-MM-DD» entre 1900 y hace 18 años; vacío = no cambia. */
function parseBirthDate(raw: string): Date | null | "invalid" {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "invalid";
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1900 || Date.now() - d.getTime() < 18 * YEAR_MS) return "invalid";
  return d;
}

const schema = z.object({
  birthDate: z.string().trim().max(10).default(""),
  iban: z.string().trim().max(42).default(""),
  confirm: z.literal("on").optional(),
});

/** Datos de DAC7 que no están en los datos legales: fecha de nacimiento, IBAN y la confirmación. */
export async function saveDac7Data(form: FormData) {
  if (isPersonalMode()) redirect("/panel/ajustes");
  const { creator } = await requireCreator();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) back("error", parsed.error.issues[0].message);
  const d = parsed.data!;
  const birthDate = parseBirthDate(d.birthDate);
  if (birthDate === "invalid") back("error", "Revisa tu fecha de nacimiento");
  // El IBAN guardado nunca se muestra: si se deja vacío, se conserva el que había.
  if (d.iban && !isValidIban(d.iban)) back("error", "Revisa el IBAN: no parece correcto.");
  const iban = d.iban ? normalizeIban(d.iban) : creator.iban;
  await prisma.creator.update({
    where: { id: creator.id },
    data: {
      birthDate: (birthDate as Date | null) ?? creator.birthDate,
      iban,
      dac7ConfirmedAt: d.confirm ? new Date() : null,
    },
  });
  back("ok", "Datos fiscales guardados");
}
