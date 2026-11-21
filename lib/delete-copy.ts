/** El aviso antes de borrar algo que puede tener ventas (lib/hard-delete.ts). */
export function deleteMessage(what: string, sales = 0) {
  if (sales <= 0) return `¿Borrar ${what}? No se puede deshacer.`;
  const n = sales === 1 ? "su venta o inscripción" : `sus ${sales} ventas e inscripciones`;
  return `¿Borrar ${what}? También se borran ${n}, y quien lo tenía pierde el acceso. No se puede deshacer.`;
}
