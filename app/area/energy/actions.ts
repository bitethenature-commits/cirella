"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BIRTH_PROFILES_MAX, birthProfileInputSchema, profileColumns, toSavedProfile, type BirthProfileInput, type SavedBirthProfile } from "@/lib/birth-profiles-rules";
import { energyAccess } from "@/lib/birth-profiles";
import { isValidZone } from "@/lib/natal-chart";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/lib/tenant";

/**
 * Guardar, cambiar y borrar perfiles de nacimiento («Mi energía» y el «Guardar» de los modelos de las
 * páginas). Solo quien tiene el acceso (sesión de cuenta verificada y suscriptora confirmada de la
 * newsletter de la dueña: la regla del portal) y siempre sobre SUS filas: creatorId por tenantDb y
 * userId de la sesión en cada consulta. Cada guardado exige la casilla de consentimiento.
 */

export type ProfileActionResult = { ok: true; profile: SavedBirthProfile } | { ok: false; error: string };

type Guard = { ok: false; error: string } | { ok: true; userId: string; creatorId: string };

async function guard(): Promise<Guard> {
  const access = await energyAccess();
  if (!access) return { ok: false, error: "Esta parte no está disponible." };
  const { viewer, owner } = access;
  if (!viewer.userId) return { ok: false, error: "Entra en tu cuenta para guardar datos." };
  if (!viewer.sessionVerified) return { ok: false, error: "Confirma tu email para guardar datos." };
  if (!viewer.unlocked)
    return {
      ok: false,
      error: "Suscríbete a la newsletter para guardar datos.",
    };
  return { ok: true, userId: viewer.userId, creatorId: owner.id };
}

function revalidate() {
  revalidatePath("/area/energy", "layout");
}

export async function saveBirthProfile(input: BirthProfileInput): Promise<ProfileActionResult> {
  const g = await guard();
  if (!g.ok) return g;
  const parsed = birthProfileInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revisa los datos",
    };
  const d = parsed.data;
  if (!isValidZone(d.place.tz)) return { ok: false, error: "Esa zona horaria no se reconoce" };
  const data = { ...profileColumns(d), consentAt: new Date() };

  // Dentro de la transacción no hay tenantDb: creatorId y userId van escritos en cada consulta.
  const mineWhere = { creatorId: g.creatorId, userId: g.userId };
  const row = await prisma.$transaction(async (tx) => {
    if (d.id) {
      const mine = await tx.birthProfile.findFirst({
        where: { id: d.id, ...mineWhere },
        select: { id: true },
      });
      if (!mine) return null;
    } else if ((await tx.birthProfile.count({ where: mineWhere })) >= BIRTH_PROFILES_MAX) {
      return "full" as const;
    }
    // Como mucho un perfil propio: al marcar este, los demás dejan de serlo.
    if (d.isOwn)
      await tx.birthProfile.updateMany({
        where: {
          ...mineWhere,
          isOwn: true,
          ...(d.id ? { NOT: { id: d.id } } : {}),
        },
        data: { isOwn: false, relation: null },
      });
    if (d.id) {
      await tx.birthProfile.updateMany({
        where: { id: d.id, ...mineWhere },
        data,
      });
      return tx.birthProfile.findFirst({ where: { id: d.id, ...mineWhere } });
    }
    return tx.birthProfile.create({ data: { ...data, ...mineWhere } });
  });
  if (row === "full")
    return {
      ok: false,
      error: `Puedes guardar hasta ${BIRTH_PROFILES_MAX} personas. Borra alguna para añadir otra.`,
    };
  if (!row) return { ok: false, error: "No hemos encontrado esos datos." };
  revalidate();
  return { ok: true, profile: toSavedProfile(row) };
}

export async function deleteBirthProfile(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const g = await guard();
  if (!g.ok) return g;
  const parsed = z.string().min(1).max(40).safeParse(id);
  if (!parsed.success) return { ok: false, error: "No hemos encontrado esos datos." };
  // Borrar es borrar: la fila desaparece (no hay papelera).
  const { count } = await tenantDb(g.creatorId).birthProfile.deleteMany({
    where: { id: parsed.data, userId: g.userId },
  });
  if (!count) return { ok: false, error: "No hemos encontrado esos datos." };
  revalidate();
  return { ok: true };
}
