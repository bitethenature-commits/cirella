"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DesignBackdrop } from "@/components/design-backdrop";
import { TemplateDecor } from "@/components/template-decor";
import { findPiece, LIVE_HOST_ATTR, pieceCss, pieceIdOf, PIECE_SELECTORS, type PieceKind } from "@/lib/pieces";
import { resolveTheme, themeAttrs, themeStyle, type ResolvedTheme } from "@/lib/templates";
import type { LiveDesignMessage, LivePickMessage } from "./live-design";

type Live = { host: HTMLElement; theme: ResolvedTheme; starOpacity: number };

/** El marco al pasar por encima de una pieza que se puede tocar, y el de la que se está cambiando. */
const PICK_CSS =
  "[data-live-hover]{outline:2px dashed rgba(217,191,140,.95) !important;outline-offset:3px !important;cursor:pointer !important}" +
  "[data-live-picked]{outline:2px solid #d9bf8c !important;outline-offset:3px !important}";

/** La pieza que hay bajo el dedo: un botón antes que nada; si no, la más cercana (una foto antes que su tarjeta). */
function pickable(t: EventTarget | null, root: HTMLElement): { el: Element; kind: PieceKind } | null {
  const node = t instanceof Element ? t : null;
  if (!node || !root.contains(node)) return null;
  const b = node.closest(PIECE_SELECTORS.button);
  if (b && root.contains(b)) return { el: b, kind: "button" };
  const c = node.closest(`${PIECE_SELECTORS.photo}, ${PIECE_SELECTORS.panel}, ${PIECE_SELECTORS.card}`);
  if (c && root.contains(c)) return { el: c, kind: c.matches(PIECE_SELECTORS.photo) ? "photo" : c.matches(PIECE_SELECTORS.panel) ? "panel" : "card" };
  return null;
}

/** Cómo se llama la pieza en la lista del editor: el texto del botón o el título de la tarjeta. */
function labelOf(el: Element, kind: PieceKind): string {
  if (kind === "photo") {
    // La foto: su texto alternativo o el título de lo que la rodea.
    const alt = (el.matches("img") ? el : el.querySelector("img"))?.getAttribute("alt")?.trim();
    const near = el.closest("a, article, section, li")?.querySelector("h1, h2, h3, h4, [data-card-title], .cp-display")?.textContent;
    return `Foto · ${(alt || near || "").replace(/\s+/g, " ").trim()}`.replace(/ · $/, "").slice(0, 60);
  }
  const src = kind === "button" ? el : (el.querySelector("h1, h2, h3, h4, [data-card-title], .cp-oracle-title, strong") ?? el);
  return (src.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
}

/**
 * Lo que hace la vista en vivo dentro de la página (live-design.tsx): pone encima el diseño que manda el editor
 * (sus colores, letras, tarjetas, paneles, botones, fotos, la foto de fondo y el fondo con movimiento) en lugar del
 * publicado, y sus piezas sueltas (lib/pieces.ts). Con «picking», tocar una tarjeta, un panel o un botón se lo dice
 * al editor para cambiar solo esa pieza. Los enlaces y los formularios no llevan a ningún sitio: es para mirar.
 */
export default function LiveDesignApply() {
  const [live, setLive] = useState<Live | null>(null);

  useEffect(() => {
    let last: LiveDesignMessage | null = null;
    let hovered: Element | null = null;
    const root = () => document.querySelector<HTMLElement>(".cp");
    const pickStyle = document.createElement("style");
    pickStyle.textContent = PICK_CSS;
    const piecesStyle = document.createElement("style");
    document.head.append(pickStyle, piecesStyle);

    const clearHover = () => {
      hovered?.removeAttribute("data-live-hover");
      hovered = null;
    };

    /** Las piezas sueltas que se están cambiando (las publicadas, apagadas) y el marco de la elegida. */
    const paintPieces = () => {
      const r = root();
      if (!r || !last) return;
      document.querySelectorAll<HTMLStyleElement>("style").forEach((s) => {
        if (s !== piecesStyle && (s.dataset.precedence === "cp-pieces" || s.textContent?.startsWith("/*cp-pieces*/"))) s.media = "not all";
      });
      r.querySelectorAll("[data-live-piece]").forEach((el) => el.removeAttribute("data-live-piece"));
      r.querySelectorAll("[data-live-picked]").forEach((el) => el.removeAttribute("data-live-picked"));
      const gold = resolveTheme(null, last.design, last.allowCustom).colors.gold;
      let css = "";
      Object.entries(last.pieces ?? {}).forEach(([id, p], i) => {
        const el = findPiece(r, id);
        if (!el) return;
        el.setAttribute("data-live-piece", String(i));
        css += pieceCss(`[data-live-piece="${i}"]`, p, gold);
      });
      piecesStyle.textContent = css;
      if (last.selected) findPiece(r, last.selected)?.setAttribute("data-live-picked", "");
    };

    const onOver = (e: MouseEvent) => {
      const r = root();
      if (!last?.picking || !r) return;
      const hit = pickable(e.target, r)?.el ?? null;
      if (hit === hovered) return;
      clearHover();
      if (hit) {
        hit.setAttribute("data-live-hover", "");
        hovered = hit;
      }
    };
    const onClick = (e: MouseEvent) => {
      const r = root();
      const hit = last?.picking && r ? pickable(e.target, r) : null;
      if (hit && r) {
        // Tocar una pieza: al editor, para cambiar solo esa.
        e.preventDefault();
        e.stopPropagation();
        const id = pieceIdOf(hit.el, r);
        if (id) {
          const msg: LivePickMessage = { type: "cirella:pick", id, kind: hit.kind, label: labelOf(hit.el, hit.kind), img: hit.el.matches("img") };
          window.parent.postMessage(msg, window.location.origin);
        }
        return;
      }
      if ((e.target as HTMLElement | null)?.closest?.("a")) e.preventDefault();
    };
    const stopSubmit = (e: Event) => e.preventDefault();

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const msg = e.data as LiveDesignMessage | null;
      if (msg?.type !== "cirella:design") return;
      const r = root();
      if (!r) return;
      last = msg;
      if (!msg.picking) clearHover();
      const theme = resolveTheme(null, msg.design, msg.allowCustom);
      // Las variables y los interruptores del diseño nuevo, en lugar de los publicados.
      r.removeAttribute("style");
      for (const [k, v] of Object.entries(themeStyle(theme))) {
        if (v == null) continue;
        r.style.setProperty(k.startsWith("--") ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`), String(v));
      }
      for (const [k, v] of Object.entries(themeAttrs(theme))) {
        if (v === undefined) r.removeAttribute(k);
        else r.setAttribute(k, v);
      }
      // La foto de fondo y el fondo con movimiento: los nuevos (en su hueco), los publicados escondidos.
      let host = r.querySelector<HTMLElement>(`:scope > [${LIVE_HOST_ATTR}]`);
      const first = !host;
      if (!host) {
        host = document.createElement("div");
        host.setAttribute(LIVE_HOST_ATTR, "");
        host.style.display = "contents";
        r.prepend(host);
      }
      const stars = first ? Number.parseFloat(r.querySelector<HTMLElement>(":scope > .cp-decor")?.style.getPropertyValue("--star-o") || "0.7") : null;
      r.querySelectorAll<HTMLElement>(":scope > .cp-decor, :scope > .cp-bg-photo").forEach((el) => (el.style.display = "none"));
      const h = host;
      setLive((prev) => ({ host: h, theme, starOpacity: prev?.starOpacity ?? stars ?? 0.7 }));
      paintPieces();
    };

    // Si la página pinta algo más tarde (un modelo, una lista), sus piezas se vuelven a buscar.
    let timer = 0;
    const watch = new MutationObserver((list) => {
      const real = list.some((m) => m.type === "childList" && !(m.target as Element).closest?.(`[${LIVE_HOST_ATTR}], .cp-decor`));
      if (!real) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(paintPieces, 150);
    });
    const r0 = root();
    if (r0) watch.observe(r0, { childList: true, subtree: true });

    document.addEventListener("mouseover", onOver);
    document.documentElement.addEventListener("mouseleave", clearHover);
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", stopSubmit, true);
    window.addEventListener("message", onMessage);
    // Ya está lista: que el editor mande el diseño.
    window.parent.postMessage({ type: "cirella:design-ready" }, window.location.origin);
    return () => {
      watch.disconnect();
      window.clearTimeout(timer);
      document.removeEventListener("mouseover", onOver);
      document.documentElement.removeEventListener("mouseleave", clearHover);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", stopSubmit, true);
      window.removeEventListener("message", onMessage);
      pickStyle.remove();
      piecesStyle.remove();
    };
  }, []);

  if (!live) return null;
  return createPortal(
    <>
      <DesignBackdrop theme={live.theme} />
      <TemplateDecor decor={live.theme.decor} starOpacity={live.starOpacity} />
    </>,
    live.host,
  );
}
