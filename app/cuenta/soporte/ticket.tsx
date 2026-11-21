"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Receipt, X } from "lucide-react";

export type TicketRow = { id: string; ref: string; date: string; title: string; kind: string; amount: string; note: string | null };
export type TicketData = { brand: string; name: string; email: string; issued: string; rows: TicketRow[]; total: string | null };

/**
 * El ticket de todo lo conseguido: un solo ticket que crece con cada compra (una línea por compra, la más
 * reciente arriba). Abajo a la derecha de «Soporte» hay un botón con un icono de descarga: abre el ticket en
 * una ventana y desde ahí se descarga como imagen (PNG, dibujada en el navegador; no se envía nada).
 * La ventana se pinta en <body>: dentro del área, la animación de entrada la dejaría mal colocada.
 */
export function TicketButton({ data }: { data: TicketData }) {
  const [open, setOpen] = useState(false);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div className="mt-10 flex justify-end">
        <button type="button" onClick={() => setOpen(true)} className="btn btn-outline btn-sm" aria-haspopup="dialog" data-ticket-open>
          <Download className="h-4 w-4" /> Tu ticket
          <span className="chip ml-1 !h-5 !px-1.5 tabular-nums">{data.rows.length}</span>
        </button>
      </div>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgb(14_16_36/.55)] p-4 backdrop-blur-sm" onClick={() => setOpen(false)} role="presentation">
            <div role="dialog" aria-modal="true" aria-label="Tu ticket" className="relative flex max-h-[92dvh] w-full max-w-sm flex-col" onClick={(e) => e.stopPropagation()}>
              <button ref={close} type="button" onClick={() => setOpen(false)} className="absolute -right-2 -top-2 z-10 grid h-9 w-9 place-items-center rounded-full bg-ink text-cream shadow-lift" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
              <div className="min-h-0 overflow-y-auto rounded-sm [scrollbar-width:thin]">
                <TicketPaper data={data} />
              </div>
              <button type="button" onClick={() => downloadTicket(data)} className="btn btn-primary mt-3 w-full" data-ticket-download>
                <Download className="h-4 w-4" /> Descargar el ticket
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** El ticket como un papel de caja: bordes dentados, letra de máquina y una línea por compra. */
function TicketPaper({ data }: { data: TicketData }) {
  const zig = "linear-gradient(-45deg, transparent 6px, #fffdf8 0), linear-gradient(45deg, transparent 6px, #fffdf8 0)";
  return (
    <div className="text-[#1f1b2e]" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>
      <div aria-hidden className="h-3" style={{ background: zig, backgroundSize: "12px 12px", backgroundRepeat: "repeat-x", transform: "rotate(180deg)" }} />
      <div className="bg-[#fffdf8] px-6 pb-6 pt-4 text-[0.78rem] leading-relaxed">
        <div className="flex flex-col items-center text-center">
          <Receipt className="h-6 w-6 text-[#b08d4f]" />
          <p className="mt-1 text-[1rem] font-bold uppercase tracking-[0.18em]">{data.brand}</p>
          <p className="text-[0.7rem] uppercase tracking-[0.16em] text-[#6e6a80]">Ticket de compras</p>
        </div>
        <Dashes />
        <p>
          <span className="text-[#6e6a80]">Cliente:</span> {data.name}
        </p>
        <p className="break-all">
          <span className="text-[#6e6a80]">Email:</span> {data.email}
        </p>
        <p>
          <span className="text-[#6e6a80]">Fecha:</span> {data.issued}
        </p>
        <Dashes />
        {data.rows.length === 0 ? (
          <p className="py-3 text-center text-[#6e6a80]">Todavía no hay compras.</p>
        ) : (
          <ul className="space-y-3">
            {data.rows.map((r) => (
              <li key={r.id}>
                <div className="flex justify-between gap-3">
                  <span className="min-w-0 font-bold">{r.title}</span>
                  <span className="shrink-0 font-bold tabular-nums">{r.amount}</span>
                </div>
                <div className="flex justify-between gap-3 text-[0.7rem] text-[#6e6a80]">
                  <span>
                    {r.kind} · {r.date}
                  </span>
                  <span className="shrink-0">#{r.ref}</span>
                </div>
                {r.note && <p className="text-[0.7rem] font-semibold text-[#a23b33]">{r.note}</p>}
              </li>
            ))}
          </ul>
        )}
        <Dashes />
        <div className="flex justify-between text-[0.85rem] font-bold">
          <span>{data.rows.length} {data.rows.length === 1 ? "compra" : "compras"}</span>
          {data.total && <span className="tabular-nums">TOTAL {data.total}</span>}
        </div>
        <Dashes />
        <p className="text-center text-[0.7rem] text-[#6e6a80]">Gracias por confiar ✦</p>
      </div>
      <div aria-hidden className="h-3" style={{ background: zig, backgroundSize: "12px 12px", backgroundRepeat: "repeat-x" }} />
    </div>
  );
}

function Dashes() {
  return <div aria-hidden className="my-3 border-t-2 border-dashed border-[#d9cfbc]" />;
}

/** Dibuja el ticket en un lienzo (tan largo como compras haya) y lo descarga como PNG. */
function downloadTicket(data: TicketData) {
  const W = 420;
  const PAD = 26;
  const scale = 2;
  const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  const probe = document.createElement("canvas").getContext("2d")!;
  // Parte los títulos largos en varias líneas para que quepan junto al importe.
  const wrap = (text: string, font: string, max: number) => {
    probe.font = font;
    const words = text.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (probe.measureText(t).width > max && cur) {
        lines.push(cur);
        cur = w;
      } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const bold = `bold 13px ${mono}`;
  const small = `11px ${mono}`;
  const rows = data.rows.map((r) => ({ r, lines: wrap(r.title, bold, W - PAD * 2 - 90) }));
  const H = 230 + rows.reduce((h, x) => h + x.lines.length * 17 + 22 + (x.r.note ? 15 : 0), 0) + (rows.length ? 0 : 30) + 110;

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  // Fondo y bordes dentados.
  ctx.fillStyle = "#fffdf8";
  ctx.beginPath();
  ctx.moveTo(0, 6);
  for (let x = 0; x <= W; x += 12) ctx.lineTo(x + 6, 0), ctx.lineTo(x + 12, 6);
  ctx.lineTo(W, H - 6);
  for (let x = W; x >= 0; x -= 12) ctx.lineTo(x - 6, H), ctx.lineTo(x - 12, H - 6);
  ctx.closePath();
  ctx.fill();

  let y = 40;
  const text = (t: string, x: number, font: string, color = "#1f1b2e", align: CanvasTextAlign = "left") => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(t, x, y);
  };
  const dashes = () => {
    y += 12;
    ctx.strokeStyle = "#d9cfbc";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    ctx.setLineDash([]);
    y += 22;
  };
  text(data.brand.toUpperCase(), W / 2, `bold 17px ${mono}`, "#1f1b2e", "center");
  y += 18;
  text("TICKET DE COMPRAS", W / 2, small, "#6e6a80", "center");
  dashes();
  text(`Cliente: ${data.name}`, PAD, small);
  y += 16;
  text(`Email: ${data.email}`, PAD, small);
  y += 16;
  text(`Fecha: ${data.issued}`, PAD, small);
  dashes();
  if (!rows.length) {
    text("Todavía no hay compras.", W / 2, small, "#6e6a80", "center");
    y += 18;
  }
  for (const { r, lines } of rows) {
    lines.forEach((l, i) => {
      text(l, PAD, bold);
      if (i === 0) text(r.amount, W - PAD, bold, "#1f1b2e", "right");
      y += 17;
    });
    text(`${r.kind} · ${r.date}`, PAD, small, "#6e6a80");
    text(`#${r.ref}`, W - PAD, small, "#6e6a80", "right");
    y += 15;
    if (r.note) {
      text(r.note, PAD, `bold 11px ${mono}`, "#a23b33");
      y += 15;
    }
    y += 7;
  }
  dashes();
  text(`${data.rows.length} ${data.rows.length === 1 ? "compra" : "compras"}`, PAD, `bold 14px ${mono}`);
  if (data.total) text(`TOTAL ${data.total}`, W - PAD, `bold 14px ${mono}`, "#1f1b2e", "right");
  dashes();
  text("Gracias por confiar ✦", W / 2, small, "#6e6a80", "center");

  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ticket-${data.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, "image/png");
}
