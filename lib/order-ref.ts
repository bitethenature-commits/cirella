/**
 * Referencia corta de un pedido para mostrar a personas: los últimos 10 caracteres del id, en
 * mayúsculas. Es la misma en la página de gracias, /cuenta/pedidos, el justificante, el email de
 * recibo y el CSV de ventas, así la clienta y la creadora hablan del mismo «Pedido …».
 */
export const ORDER_REF_LENGTH = 10;

export function orderRef(id: string): string {
  return id.slice(-ORDER_REF_LENGTH).toUpperCase();
}
