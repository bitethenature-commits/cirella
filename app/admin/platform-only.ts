import { notFound } from "next/navigation";
import { isPersonalMode } from "@/lib/site-mode";

/**
 * Secciones de la administración que solo tienen sentido en la plataforma (creadoras, planes,
 * comisiones, ventas de todas…). En modo personal no existen: 404.
 */
export function platformOnly() {
  if (isPersonalMode()) notFound();
}
