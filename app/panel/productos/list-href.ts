/**
 * Ya no hay página «Productos»: cada cosa se lleva desde su sitio. Lecturas y sesiones 1:1 en
 * «Sesiones y lecturas», los círculos en «Círculos de la Luna», los cursos en Cursos y las membresías
 * en Comunidad. Aquí, adónde vuelve cada producto.
 */
export function productListHref(p: { type: string; groupSession?: boolean | null }): string {
  if (p.type === "COURSE") return "/panel/cursos";
  if (p.type === "MEMBERSHIP") return "/panel/comunidad";
  if (p.type === "SESSION" && p.groupSession) return "/panel/circulos";
  return "/panel/sesiones";
}

export function productListLabel(p: { type: string; groupSession?: boolean | null }): string {
  const labels: Record<string, string> = { "/panel/cursos": "Cursos", "/panel/comunidad": "Membresía", "/panel/circulos": "Círculos de la Luna", "/panel/sesiones": "Sesiones y lecturas" };
  return labels[productListHref(p)] ?? "Volver";
}
