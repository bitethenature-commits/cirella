/**
 * Tipos de archivo que se aceptan y cómo se entregan. Sin dependencias de servidor: lo usan el
 * panel (accept de los <input type=file>), las rutas de subida y los visores.
 */

/** accept del botón «Imagen» del editor de texto. Empieza por «.jpg» a propósito: así el primer
 *  input[accept^="image/"] de la ficha sigue siendo el de la imagen del producto (e2e/infra.spec.ts). */
export const RICH_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif";
