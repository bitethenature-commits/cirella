"use client";

/**
 * Pregunta «¿Seguro?» en una ventana de la propia página (<dialog>) y responde true o false. Sustituye a
 * window.confirm: hay navegadores integrados (el de una app, una vista web) que no enseñan la ventanita del
 * navegador y la dan por «Cancelar», y el botón no haría nada.
 *
 * Va dentro del panel (.panel-root) o del área (.cuenta-root) si los hay, para tener sus colores; si no, en body.
 */
export function askConfirm(message: string, opts: { from?: Element | null; okLabel?: string } = {}): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  const danger = /borrar|eliminar|quitar|cancelar|devolver|vaciar|volver al/i.test(message);
  const okLabel = opts.okLabel ?? (!danger ? "Aceptar" : /borrar|eliminar/i.test(message) ? "Sí, borrar" : /quitar/i.test(message) ? "Sí, quitar" : "Sí, seguir");
  const host = opts.from?.closest(".panel-root") ?? document.querySelector(".panel-root") ?? document.body;

  const dialog = document.createElement("dialog");
  dialog.className = "m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-cream p-0 text-ink shadow-lift backdrop:bg-black/50";
  dialog.setAttribute("aria-label", "Confirmar");
  const box = document.createElement("div");
  box.className = "p-5 sm:p-6";
  const text = document.createElement("p");
  text.className = "whitespace-pre-line text-[0.95rem] leading-relaxed";
  text.textContent = message;
  const row = document.createElement("div");
  row.className = "mt-5 flex justify-end gap-2.5";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn btn-ghost btn-sm";
  cancel.textContent = "Cancelar";
  const ok = document.createElement("button");
  ok.type = "button";
  ok.className = `btn btn-sm ${danger ? "btn-danger" : "btn-primary"}`;
  ok.textContent = okLabel;
  row.append(cancel, ok);
  box.append(text, row);
  dialog.append(box);
  host.append(dialog);

  return new Promise<boolean>((resolve) => {
    let answer = false;
    const finish = (v: boolean) => {
      answer = v;
      dialog.close();
    };
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(answer);
    });
    // Que los clics de la ventana no lleguen a lo que hay debajo (una tarjeta enlace, por ejemplo).
    dialog.addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.target === dialog) finish(false);
    });
    cancel.addEventListener("click", () => finish(false));
    ok.addEventListener("click", () => finish(true));
    dialog.showModal();
    cancel.focus();
  });
}
