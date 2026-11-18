"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, BookOpenText, Download, Eye, FileImage, FileText, GraduationCap, Headphones, Heart, MessageCircle, Star, Video, X } from "lucide-react";
import { seeComments } from "./actions";

/** Un texto guardado, una lección guardada o una publicación con «me gusta». */
type DeskText = { id: string; title: string; group: string; href: string; date: string; type?: "post" | "lesson" };
type DeskFile = { id: string; name: string; kind: string; sizeBytes: number | null; lesson: { title: string; href: string } | null };
type DeskReply = { id: string; authorName: string; byOwner: boolean; body: string; when: string; isNew: boolean };
type DeskComment = {
  id: string;
  place: "post" | "lesson";
  placeTitle: string;
  groupTitle: string;
  href: string;
  body: string;
  when: string;
  likes: number;
  newLikes: number;
  isNew: boolean;
  replies: DeskReply[];
};

export type DeskFolder = {
  key: string;
  kind: "favorites" | "likes" | "comments" | "texts" | "course";
  title: string;
  count: number;
  unseen?: number;
  href?: string;
  hrefLabel?: string;
  texts?: DeskText[];
  files?: DeskFile[];
  comments?: DeskComment[];
};

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;
const EMBLEM: Record<DeskFolder["kind"], Icon> = { favorites: Star, likes: Heart, comments: MessageCircle, texts: BookOpenText, course: GraduationCap };
const FILE_ICON: Record<string, Icon> = { PDF: FileText, AUDIO: Headphones, VIDEO: Video, IMAGE: FileImage };
const VIEWABLE = new Set(["PDF", "IMAGE", "AUDIO", "VIDEO"]);

function size(bytes: number | null) {
  if (!bytes) return "";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function countLabel(f: DeskFolder) {
  const n = f.count;
  if (f.kind === "comments") return n === 1 ? "1 comentario" : `${n} comentarios`;
  if (f.kind === "course") return n === 1 ? "1 material" : `${n} materiales`;
  if (f.kind === "favorites" || f.kind === "likes") return n === 1 ? "1 guardado" : `${n} guardados`;
  return n === 1 ? "1 texto" : `${n} textos`;
}

/** La carpeta dorada, dibujada: la pestaña de atrás, la tapa y el emblema de lo que guarda. */
function FolderArt({ kind }: { kind: DeskFolder["kind"] }) {
  const Emblem = EMBLEM[kind];
  return (
    <span className="acc-folder-art" aria-hidden>
      <svg viewBox="0 0 120 96" className="acc-folder-svg">
        <defs>
          <linearGradient id={`fb-${kind}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2f5e" />
            <stop offset="100%" stopColor="#1d1838" />
          </linearGradient>
          <linearGradient id={`ff-${kind}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2c2552" />
            <stop offset="55%" stopColor="#221c44" />
            <stop offset="100%" stopColor="#171331" />
          </linearGradient>
          <linearGradient id={`fg-${kind}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f3dcab" />
            <stop offset="50%" stopColor="#d4b57a" />
            <stop offset="100%" stopColor="#a8864e" />
          </linearGradient>
        </defs>
        {/* Atrás, con su pestaña */}
        <path d="M8 18 a8 8 0 0 1 8-8 h26 a8 8 0 0 1 6.4 3.2 l4.2 5.6 a6 6 0 0 0 4.8 2.4 H104 a8 8 0 0 1 8 8 V78 a8 8 0 0 1-8 8 H16 a8 8 0 0 1-8-8 Z" fill={`url(#fb-${kind})`} stroke={`url(#fg-${kind})`} strokeWidth="1.2" />
        {/* Una hoja asomando */}
        <rect x="20" y="24" width="80" height="40" rx="4" fill="#f6eedd" opacity="0.92" className="acc-folder-sheet" />
        {/* La tapa */}
        <path d="M6 36 a8 8 0 0 1 8-8 h92 a8 8 0 0 1 8 8 l-3 42 a8 8 0 0 1-8 7.4 H17 a8 8 0 0 1-8-7.4 Z" fill={`url(#ff-${kind})`} stroke={`url(#fg-${kind})`} strokeWidth="1.4" className="acc-folder-lid" />
        <path d="M12 40 h96" stroke={`url(#fg-${kind})`} strokeWidth="0.6" opacity="0.5" />
      </svg>
      <span className="acc-folder-emblem">
        <Emblem className="h-7 w-7" strokeWidth={1.2} />
      </span>
    </span>
  );
}

/**
 * El escritorio: las carpetas y, al tocar una, su ventana (como en el ordenador: barra con el título y
 * los botones de minimizar, maximizar y cerrar). La ventana crece desde la carpeta y vuelve a ella al
 * cerrarse. Abrir «Comentarios» marca sus avisos como vistos (lo nuevo sigue en dorado mientras está abierta).
 */
export function Desktop({ folders, initial, owner }: { folders: DeskFolder[]; initial: "favoritos" | "comentarios" | "me-gusta" | null; owner: string | null }) {
  // Lo que se ve al cargar (lo nuevo marcado): no cambia aunque se refresque al marcar como visto.
  const [snapshot] = useState(folders);
  const [open, setOpen] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [max, setMax] = useState(false);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const seen = useRef(false);
  const router = useRouter();
  const unseen = folders.find((f) => f.kind === "comments")?.unseen ?? 0;

  const show = useCallback(
    (key: string, from: HTMLElement | null) => {
      if (from) {
        const r = from.getBoundingClientRect();
        setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      } else setOrigin(null);
      setMax(false);
      setClosing(false);
      setOpen(key);
      if (key === "comentarios" && !seen.current && unseen > 0) {
        seen.current = true;
        seeComments().then(() => router.refresh());
      }
    },
    [router, unseen],
  );

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(null);
      setClosing(false);
      opener.current?.focus();
      // Quita «?abrir=…» de la dirección: así la ★, el ♥ o el chat del menú la vuelven a abrir.
      if (window.location.search.includes("abrir=")) router.replace("/cuenta/archivos", { scroll: false });
    }, 260);
  }, [router]);

  // La ★, el ♥ y el chat del menú abren su carpeta directamente (también si ya estás en esta página).
  useEffect(() => {
    if (initial) show(initial, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  const current = snapshot.find((f) => f.key === open) ?? null;
  const style = (origin ? { ["--wx" as string]: `${origin.x}px`, ["--wy" as string]: `${origin.y}px` } : {}) as CSSProperties;

  return (
    <>
      <section className="acc-desk mt-8" aria-label="Tus carpetas">
        <div className="acc-desk-grid">
          {folders.map((f) => (
            <button
              key={f.key}
              type="button"
              className="acc-folder"
              data-folder={f.kind}
              onClick={(e) => {
                opener.current = e.currentTarget;
                show(f.key, e.currentTarget);
              }}
              aria-haspopup="dialog"
              aria-label={`Abrir ${f.title} (${countLabel(f)}${f.unseen ? `, ${f.unseen} avisos nuevos` : ""})`}
            >
              <FolderArt kind={f.kind} />
              {!!f.unseen && <span className="acc-badge acc-folder-badge">{f.unseen > 99 ? "99+" : f.unseen}</span>}
              <span className="acc-folder-name">{f.title}</span>
              <span className="acc-folder-count">{countLabel(f)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* En <body>, fuera de la página: así ninguna barra de arriba la tapa (la página tiene su propia capa). */}
      {current && typeof document !== "undefined" && createPortal(
        <div className="acc-win-layer" data-closing={closing ? "true" : undefined} style={style}>
          <button type="button" className="acc-win-backdrop" aria-label="Cerrar la ventana" tabIndex={-1} onClick={close} />
          <div role="dialog" aria-modal="true" aria-labelledby="acc-win-title" className="acc-win" data-max={max ? "true" : undefined} data-origin={origin ? "folder" : "center"}>
            {/* En la barra solo la X para cerrar; el nombre queda para los lectores de pantalla. */}
            <header className="acc-win-bar">
              <h2 id="acc-win-title" className="sr-only">
                {current.title}
              </h2>
              <div className="acc-win-btns ml-auto">
                <button ref={closeBtn} type="button" className="acc-win-btn acc-win-close" onClick={close} aria-label="Cerrar">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </header>
            <div className="acc-win-body">
              <WindowContent folder={current} owner={owner} />
            </div>
            {current.href && (
              <footer className="acc-win-foot">
                <Link href={current.href} className="acc-win-link">
                  {current.hrefLabel ?? "Abrir"} <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </footer>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="acc-win-empty">
      <span aria-hidden>✦</span>
      <p>{text}</p>
    </div>
  );
}

function WindowContent({ folder, owner }: { folder: DeskFolder; owner: string | null }) {
  if (folder.kind === "comments") {
    const list = folder.comments ?? [];
    if (!list.length) return <Empty text="Cuando escribas en una lección o en una membresía, tus comentarios saldrán aquí, con sus me gusta y sus respuestas." />;
    return (
      <ul className="acc-win-list">
        {list.map((c) => (
          <li key={c.id} className="acc-cmt" data-new={c.isNew ? "true" : undefined}>
            <p className="acc-cmt-where">
              {c.place === "lesson" ? <GraduationCap className="h-3.5 w-3.5" /> : <BookOpenText className="h-3.5 w-3.5" />}
              <span className="truncate">
                {c.groupTitle} · {c.placeTitle}
              </span>
              {c.isNew && <span className="acc-new">Nuevo</span>}
            </p>
            <blockquote className="acc-cmt-body">{c.body}</blockquote>
            <p className="acc-cmt-meta">
              <span>{c.when}</span>
              <span className="acc-cmt-likes" data-on={c.likes ? "true" : undefined}>
                <Heart className={`h-3.5 w-3.5 ${c.likes ? "fill-current" : ""}`} /> {c.likes}
                {c.newLikes > 0 && <em> · {c.newLikes === 1 ? "1 nuevo" : `${c.newLikes} nuevos`}</em>}
              </span>
              <span>
                <MessageCircle className="inline h-3.5 w-3.5" /> {c.replies.length}
              </span>
            </p>
            {c.replies.length > 0 && (
              <ul className="acc-cmt-replies">
                {c.replies.map((r) => (
                  <li key={r.id} data-new={r.isNew ? "true" : undefined}>
                    <p className="acc-cmt-author">
                      {r.authorName}
                      {r.byOwner && <span className="acc-author-tag">Autora</span>}
                      <span className="acc-cmt-when">{r.when}</span>
                      {r.isNew && <span className="acc-new">Nuevo</span>}
                    </p>
                    <p className="acc-cmt-reply">{r.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link href={c.href} className="acc-win-link mt-3">
              Ver la conversación <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  if (folder.kind === "course") {
    const files = folder.files ?? [];
    if (!files.length) return <Empty text="Este curso aún no tiene materiales." />;
    return (
      <ul className="acc-win-list">
        {files.map((f) => {
          const Icon = FILE_ICON[f.kind] ?? FileText;
          return (
            <li key={f.id} className="acc-row">
              <span className="acc-row-icon">
                <Icon className="h-4 w-4" strokeWidth={1.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="acc-row-title">{f.name}</span>
                <span className="acc-row-sub">
                  {size(f.sizeBytes)}
                  {f.lesson && (
                    <>
                      {size(f.sizeBytes) ? " · " : ""}
                      <Link href={f.lesson.href} className="hover:underline">
                        Lección: {f.lesson.title}
                      </Link>
                    </>
                  )}
                </span>
              </span>
              {VIEWABLE.has(f.kind) && (
                <Link href={`/cuenta/archivos/${f.id}`} className="acc-row-btn" aria-label={`Ver ${f.name}`}>
                  <Eye className="h-3.5 w-3.5" /> <span className="max-sm:hidden">Ver</span>
                </Link>
              )}
              <a href={`/api/download/${f.id}`} className="acc-row-btn" aria-label={`Descargar ${f.name}`}>
                <Download className="h-3.5 w-3.5" /> <span className="max-sm:hidden">Descargar</span>
              </a>
            </li>
          );
        })}
      </ul>
    );
  }
  const texts = folder.texts ?? [];
  if (!texts.length)
    return (
      <Empty
        text={
          folder.kind === "likes"
            ? "Cuando des ♥ a una publicación de tu membresía, se guardará aquí."
            : `Toca la ★ en una publicación de tu membresía o en una lección${owner ? ` de ${owner}` : ""} y la tendrás aquí, a mano, para volver a ella.`
        }
      />
    );
  const RowIcon = folder.kind === "likes" ? Heart : Star;
  return (
    <ul className="acc-win-list">
      {texts.map((t) => (
        <li key={t.id} className="acc-row">
          <span className="acc-row-icon" data-row={folder.kind}>
            {t.type === "lesson" ? <GraduationCap className="h-4 w-4" strokeWidth={1.4} /> : <RowIcon className="h-4 w-4" strokeWidth={1.4} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="acc-row-title">{t.title}</span>
            <span className="acc-row-sub">
              {t.type === "lesson" ? `Lección · ${t.group}` : t.date}
              {t.type !== "lesson" && (folder.kind === "favorites" || folder.kind === "likes") ? ` · ${t.group}` : ""}
            </span>
          </span>
          <Link href={t.href} className="acc-row-btn" aria-label={`${t.type === "lesson" ? "Ver" : "Leer"} ${t.title}`}>
            {t.type === "lesson" ? <GraduationCap className="h-3.5 w-3.5" /> : <BookOpenText className="h-3.5 w-3.5" />} {t.type === "lesson" ? "Ver" : "Leer"}
          </Link>
        </li>
      ))}
    </ul>
  );
}
