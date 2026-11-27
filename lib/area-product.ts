import { redirect } from "next/navigation";
import { prisma } from "./db";
import { areaProductPath } from "./public-paths";
import { getOwnerCreator, isPersonalMode } from "./site-mode";

type Query = Record<string, string | string[] | undefined>;

function queryString(q: Query | undefined, extra = ""): string {
  const list = Object.entries(q ?? {}).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v == null ? [] : [[k, v]]));
  const s = new URLSearchParams(list).toString();
  return `${extra}${s ? `?${s}` : ""}`;
}

/**
 * El curso o la membresía de una dirección del área (/area/courses/<ref>, /area/membership/<ref>[/<publicación>]).
 * En la web personal <ref> es su nombre (el de su dirección en la web); si llega su código (los enlaces de antes y
 * los de los emails), lleva a la dirección con el nombre, con lo que haya detrás (`rest`) y la misma query.
 * En la plataforma, <ref> es su código. Devuelve el id, o null si no hay ninguno así.
 */
export async function areaProductId(ref: string, type: "COURSE" | "MEMBERSHIP", opts: { query?: Query; rest?: string } = {}): Promise<string | null> {
  if (!isPersonalMode()) return ref;
  const owner = await getOwnerCreator();
  if (owner) {
    const bySlug = await prisma.product.findFirst({ where: { creatorId: owner.id, slug: ref, type }, select: { id: true } });
    if (bySlug) return bySlug.id;
  }
  const byId = await prisma.product.findUnique({ where: { id: ref }, select: { id: true, slug: true, type: true } });
  if (!byId || byId.type !== type) return null;
  redirect(`${areaProductPath(byId)}${queryString(opts.query, opts.rest ?? "")}`);
}
