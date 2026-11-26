/**
 * Niveles de la comunidad: una membresía puede incluir otras membresías (los niveles de abajo) y
 * cursos, con ProductInclusion. La herencia es transitiva: «Luna completa» incluye «Plena», que
 * incluye «Esencia», así que quien está en «Luna completa» lee también lo de «Esencia». Puro (sin BD):
 * lo usan lib/membership-access.ts, el panel (para no crear ciclos) y las pruebas unitarias.
 *
 * Los ciclos no deberían existir (el panel los rechaza), pero si un dato antiguo o manual los tuviera,
 * los recorridos se paran en lo ya visto: nunca un bucle infinito.
 */

export type InclusionEdge = { productId: string; includedProductId: string };

function walk(edges: InclusionEdge[], start: string, next: (e: InclusionEdge) => [string, string]): string[] {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const [from, to] = next(e);
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push(to);
  }
  const seen = new Set<string>([start]);
  const out: string[] = [];
  const queue = [start];
  while (queue.length) {
    const id = queue.shift()!;
    for (const to of adj.get(id) ?? []) {
      if (seen.has(to)) continue;
      seen.add(to);
      out.push(to);
      queue.push(to);
    }
  }
  return out;
}

/** Todo lo que incluye un producto, directa o indirectamente (sin él mismo), del más cercano al más lejano. */
export function descendantsOf(edges: InclusionEdge[], productId: string): string[] {
  return walk(edges, productId, (e) => [e.productId, e.includedProductId]);
}

/** Todas las membresías que lo incluyen, directa o indirectamente (sin él mismo). */
export function ancestorsOf(edges: InclusionEdge[], productId: string): string[] {
  return walk(edges, productId, (e) => [e.includedProductId, e.productId]);
}

/**
 * ¿Hacer que `productId` incluya `includedId` crearía un ciclo? Sí si es él mismo o si `includedId`
 * ya incluye (directa o indirectamente) a `productId`.
 */
export function wouldCreateCycle(edges: InclusionEdge[], productId: string, includedId: string): boolean {
  if (productId === includedId) return true;
  return descendantsOf(edges, includedId).includes(productId);
}

/**
 * Nivel de cada membresía (1 = la de abajo): cuántas membresías incluye por debajo, más uno. Sirve
 * para ordenar los niveles en /membership de menor a mayor.
 */
export function tierLevel(edges: InclusionEdge[], membershipId: string, memberships: Set<string>): number {
  return descendantsOf(edges, membershipId).filter((id) => memberships.has(id)).length + 1;
}

/**
 * Orden de los niveles para enseñarlos uno al lado del otro: de menos a más incluido y, a igualdad,
 * por precio. Para cada uno, el nivel inmediatamente anterior que incluye («Todo lo de Esencia»).
 */
export function orderTiers<T extends { id: string; priceCents: number }>(tiers: T[], edges: InclusionEdge[]): { tier: T; level: number; includesPrevious: T | null }[] {
  const ids = new Set(tiers.map((t) => t.id));
  const levels = new Map(tiers.map((t) => [t.id, tierLevel(edges, t.id, ids)]));
  const sorted = [...tiers].sort((a, b) => levels.get(a.id)! - levels.get(b.id)! || a.priceCents - b.priceCents);
  return sorted.map((tier) => {
    // El nivel incluido más alto (el de nivel mayor entre los que incluye).
    const included = descendantsOf(edges, tier.id).filter((id) => ids.has(id));
    const best = included.map((id) => sorted.find((t) => t.id === id)!).sort((a, b) => levels.get(b.id)! - levels.get(a.id)!)[0] ?? null;
    return { tier, level: levels.get(tier.id)!, includesPrevious: best };
  });
}
