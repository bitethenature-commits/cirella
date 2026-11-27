/**
 * Tarea aparte del navegador que pinta una capa de la nebulosa a tamaño real (tarda un par de segundos): así la
 * página no se para mientras tanto. Recibe un NebulaJob y devuelve los píxeles.
 */
import { paintNebula, type NebulaJob } from "./nebula-paint";

const scope = self as unknown as {
  onmessage: ((ev: MessageEvent<NebulaJob>) => void) | null;
  postMessage(msg: unknown, transfer: Transferable[]): void;
};

scope.onmessage = (ev) => {
  const data = paintNebula(ev.data);
  scope.postMessage({ data, W: ev.data.W, H: ev.data.H }, [data.buffer]);
};
