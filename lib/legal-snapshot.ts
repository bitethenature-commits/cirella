import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { LEGAL_TEMPLATE_VERSION, type LegalIdentity } from "./legal";
import { acceptedLegalDocs } from "./legal-templates";
import { getSettings } from "./settings";
import { isPersonalMode } from "./site-mode";
import { tenantDb } from "./tenant";

/** Lo que aceptó la compradora: identidad de la vendedora y textos exactos en ese momento. */
export type LegalSnapshotContent = {
  identity: LegalIdentity;
  terms: string;
  refunds: string;
  privacy: string;
  templateVersion: string;
  /** Aceptada en la web personal: solo aviso legal y privacidad (la página legal la pinta así). */
  personal?: boolean;
};

/** Identidad campo a campo y en orden fijo: el hash depende del orden de las claves. */
export function legalIdentityOf(c: LegalIdentity): LegalIdentity {
  return {
    legalEntityType: c.legalEntityType,
    legalName: c.legalName,
    legalTaxId: c.legalTaxId,
    legalAddress: c.legalAddress,
    legalPostalCode: c.legalPostalCode,
    legalCity: c.legalCity,
    legalCountry: c.legalCountry,
    legalEmail: c.legalEmail,
    legalRegistry: c.legalRegistry,
  };
}

/**
 * Copia fija de las condiciones vigentes de una creadora, direccionada por contenido: si nada ha
 * cambiado desde la última compra se reutiliza la misma fila. La enlaza cada pedido
 * (Order.legalSnapshotId) y se puede ver en /{usuario}/legal?v={id}.
 * En la web personal guarda la privacidad que se ve allí (y la marca `personal`, que cambia el hash:
 * nunca reutiliza una versión de la plataforma).
 */
export async function ensureLegalSnapshot(creatorId: string): Promise<{ id: string; content: LegalSnapshotContent }> {
  const [c, { platformName }] = await Promise.all([prisma.creator.findUniqueOrThrow({ where: { id: creatorId } }), getSettings()]);
  const personal = isPersonalMode();
  const docs = acceptedLegalDocs(c, platformName, personal);
  const content: LegalSnapshotContent = {
    identity: legalIdentityOf(c),
    terms: docs.terms,
    refunds: docs.refunds,
    privacy: docs.privacy,
    templateVersion: LEGAL_TEMPLATE_VERSION,
    // Solo en la web personal: las versiones de la plataforma conservan su hash de siempre.
    ...(personal ? { personal: true } : {}),
  };
  const hash = createHash("sha256").update(JSON.stringify(content)).digest("hex");
  const db = tenantDb(creatorId);
  try {
    const row = await db.legalSnapshot.upsert({
      where: { creatorId_hash: { creatorId, hash } },
      create: { creatorId, hash, content: content as unknown as Prisma.InputJsonValue },
      update: {},
      select: { id: true },
    });
    return { id: row.id, content };
  } catch (e) {
    // Dos primeras compras a la vez: la otra ya ha creado la fila.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    const row = await db.legalSnapshot.findUniqueOrThrow({ where: { creatorId_hash: { creatorId, hash } }, select: { id: true } });
    return { id: row.id, content };
  }
}

/** Versión aceptada en una compra; solo de esa creadora (el id de otra devuelve null). */
export async function getLegalSnapshot(creatorId: string, id: string): Promise<(LegalSnapshotContent & { createdAt: Date }) | null> {
  const row = await tenantDb(creatorId).legalSnapshot.findFirst({ where: { id } });
  if (!row) return null;
  return { ...(row.content as unknown as LegalSnapshotContent), createdAt: row.createdAt };
}
