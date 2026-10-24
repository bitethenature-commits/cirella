/**
 * Una página extra que no existe (o en borrador) da el 404 general de la web, el mismo que antes:
 * en la web personal también llegan aquí, por el rewrite de /<tramo> (middleware.ts), las
 * direcciones de otras usuarias (/maria), que tienen que verse exactamente como siempre.
 */
export { default } from "../../../not-found";
