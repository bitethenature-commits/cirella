"use client";

import { ChevronLeft, Eye, ListTree, Loader2, PanelLeft, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { CourseType } from "@/components/course/course-look";
import { TemplateDecor } from "@/components/template-decor";
import { accountLookView, type AccountLook } from "@/lib/account-look";
import { EMPTY_COURSE_LOOK, lookAsAccount, type CourseLook } from "@/lib/course-design";
import type { DripSettings } from "@/lib/course-drip";
import type { FontKey } from "@/lib/templates";
import { EdgeScroll } from "@/components/ui/edge-scroll";
import { BarButton, CanvaShell, stopWebLinks } from "@/app/panel/canva/canva-ui";
import { DeviceToggle, useDevice, type Device } from "@/app/panel/canva/web-frame";
import { addStudioLesson, addStudioModule } from "../../actions";
import { StructureBoard, type BoardModule } from "../structure-board";
import { Tr, useT } from "@/lib/i18n/client";

/** El curso en el editor de lecciones: su nombre, su portada, los colores del área de alumna, su diseño y cómo se abre. */
export type CanvaCourse = {
  id: string;
  title: string;
  imageUrl: string | null;
  look: AccountLook | null;
  /** El diseño de todas sus lecciones (lib/course-design.ts). */
  design: CourseLook;
  drip: DripSettings;
  personal: boolean;
  uploadLabel: string;
};

/** Lo que se abre a la izquierda, en el sitio del índice: el diseño, la lección, una pieza, añadir… */
export type CanvaPanel = { title: string; body: ReactNode; footer?: ReactNode; onClose: () => void };

const OUTLINE_KEY = "curso-indice";

/**
 * El área de alumna por dentro (sus colores, su foto, su fondo y su figura), como en app/area/look-root.tsx, con
 * el diseño del curso encima si lo tiene (como en el reproductor: course-look-apply.tsx).
 */
function StudentArea({ look, children }: { look: AccountLook | null; children: ReactNode }) {
  const v = accountLookView(look);
  return (
    <div className="acc-root min-h-dvh bg-paper" data-acc-look={v?.mode} data-acc-decor={v?.decor ? "" : undefined} style={v?.style}>
      {v?.photo && <div className="acc-photo" aria-hidden />}
      {v?.decor && v.decor !== "none" && <TemplateDecor key={v.decor} decor={v.decor} />}
      {v?.geo && <div className="acc-geo" data-pos={v.geo.pos} data-spin={v.geo.spin ? "" : undefined} aria-hidden />}
      {children}
    </div>
  );
}

/**
 * El editor de un curso, como el Canva de la web: la lección a pantalla completa tal y como la ve la alumna (en su
 * área, con sus colores y el diseño del curso), con todo editable encima. A la izquierda, pegado al borde, el índice
 * del curso en escalera (módulos, lecciones y capítulos, que también se ordenan) y, en su sitio, lo que se abre
 * (`panel`: el diseño, la lección, una pieza…), con «‹ Índice» para volver. Nunca nada a la derecha: la lección se
 * aparta. Arriba a la derecha, la barra: el índice, la estructura, lo de cada pestaña (`tools`), ordenador o móvil,
 * si se ha guardado y «Ver como alumna». En pantallas estrechas, el índice y lo que se abre salen abajo.
 */
export function CourseCanvaShell({
  course,
  board,
  current,
  navigate,
  status,
  tools,
  viewHref,
  panel,
  notice,
  look,
  fonts,
  onMoveChapter,
  children,
}: {
  course: CanvaCourse;
  board: BoardModule[];
  current: { lessonId: string; chapter: number | null } | null;
  /** Ir a otra lección, capítulo o pantalla (el editor guarda antes lo que falte). */
  navigate: (href: string) => void;
  /** Mover un capítulo de la lección abierta (arrastrándolo en el índice). */
  onMoveChapter?: (from: number, to: number) => void;
  status?: ReactNode;
  tools?: ReactNode;
  viewHref: string;
  panel?: CanvaPanel | null;
  notice?: ReactNode;
  /** El diseño que se ve (el del curso con el de la lección encima); sin él, el del curso. */
  look?: CourseLook;
  /** Las letras de las piezas, para cargarlas. */
  fonts?: (FontKey | null)[];
  children: (device: Device) => ReactNode;
}) {
  const t = useT();
  const [device, setDevice] = useDevice();
  const [outline, setOutline] = useState(true);
  const [outlineSheet, setOutlineSheet] = useState(false);
  const eff = look ?? course.design ?? EMPTY_COURSE_LOOK;
  const open = !!panel;
  // En el ordenador, a la izquierda: el índice (si está abierto) o lo que se ha abierto, algo más ancho.
  const desk = outline || open;
  const closeRef = useRef(panel?.onClose);
  closeRef.current = panel?.onClose;

  // El índice abierto o cerrado, recordado en este navegador.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(OUTLINE_KEY) === "0") setOutline(false);
    } catch {}
  }, []);
  // Con algo a la izquierda, las pestañas del borde izquierdo del panel, al salir enteras, van por encima (globals.css).
  useEffect(() => {
    const root = document.documentElement;
    if (desk) root.setAttribute("data-course-index", "");
    else root.removeAttribute("data-course-index");
    return () => root.removeAttribute("data-course-index");
  }, [desk]);
  // Lo abierto se cierra con Escape (sin estar escribiendo); al abrirlo, el índice de abajo (móvil) deja su sitio.
  useEffect(() => {
    if (!open) return;
    setOutlineSheet(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]")) closeRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const toggleOutline = () => {
    if (!window.matchMedia("(min-width: 64rem)").matches) {
      panel?.onClose();
      return setOutlineSheet(panel ? true : !outlineSheet);
    }
    if (panel) {
      // Con algo abierto, «Índice» vuelve al índice.
      panel.onClose();
      if (outline) return;
    }
    setOutline((o) => {
      try {
        window.localStorage.setItem(OUTLINE_KEY, o ? "0" : "1");
      } catch {}
      return !o;
    });
  };

  const boardEl = (
    <StructureBoard
      compact
      productId={course.id}
      modules={board}
      drip={course.drip}
      current={current}
      navigate={(href) => {
        setOutlineSheet(false);
        navigate(href);
      }}
      onMoveChapter={onMoveChapter}
    />
  );

  const mobile = outlineSheet || open;
  const closeBtn = "grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-sand";

  return (
    <CanvaShell
      device={device}
      // Lo que se abre (diseño, añadir…) flota encima de la lección, translúcido: la lección no se aparta.
      frameClassName={outline ? "lg:pl-[13rem]" : "lg:pl-14"}
      bar={
        <div className="flex items-center gap-1 p-2 sm:gap-1.5">
          <BarButton icon={PanelLeft} label={t("Índice")} onClick={toggleOutline} active={outline && !open} />
          <BarButton icon={ListTree} label={t("Estructura")} onClick={() => navigate(`/panel/cursos/${course.id}`)} />
          {tools}
          <DeviceToggle device={device} onChange={setDevice} />
          {status}
          <a href={viewHref} target="_blank" rel="noopener" className="panel-nav-link inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm" title={t("Ver como alumna")} aria-label={t("Ver como alumna")}>
            <Eye className="h-4 w-4" /> <span className="hidden xl:inline"><Tr s={"Ver como alumna"} /></span>
          </a>
        </div>
      }
      notice={notice}
      side={
        // A la izquierda, justo después de las pestañas del borde del panel: el índice en escalera (sin tarjeta) o, en
        // su sitio, lo que se ha abierto, en una tarjeta translúcida que flota encima de la lección (se ve un poco lo
        // de atrás). En el móvil, abajo, encima de la lección, también translúcido.
        <aside
          data-canva-ui
          data-course-index
          role={open ? "dialog" : undefined}
          aria-label={t(panel ? panel.title : t("Índice del curso"))}
          className={`fixed inset-x-0 bottom-0 z-[42] max-h-[72dvh] flex-col rounded-t-2xl border border-b-0 border-line text-ink max-lg:animate-fade-up max-lg:bg-[#0b0b0d]/80 max-lg:shadow-[0_30px_80px_-20px_rgb(0_0_0/.75)] max-lg:backdrop-blur-xl lg:inset-x-auto lg:bottom-[3.6rem] lg:left-[3.75rem] lg:top-[4.25rem] lg:z-[41] lg:max-h-none lg:animate-fade-in ${open ? "lg:w-[21rem] lg:rounded-2xl lg:border lg:border-white/10 lg:bg-[#0b0b0d]/80 lg:shadow-[0_30px_80px_-20px_rgb(0_0_0/.75)] lg:backdrop-blur-xl" : "lg:w-[8.75rem] lg:rounded-none lg:border-0"} ${mobile ? "flex" : "hidden"} ${desk ? "lg:flex" : "lg:hidden"}`}
        >
          {panel ? (
            <>
              <div className="flex items-start gap-2 border-b border-line px-4 py-2.5 lg:border-0 lg:pb-1 lg:pt-2">
                <div className="min-w-0 flex-1">
                  {outline && (
                    <button type="button" onClick={panel.onClose} className="hidden items-center gap-0.5 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-muted hover:text-ink lg:inline-flex">
                      <ChevronLeft className="h-3.5 w-3.5" />{" "}<Tr s={"Índice"} /></button>
                  )}
                  <p className="truncate text-[1.05rem] font-semibold leading-tight max-lg:pt-1.5">{panel.title}</p>
                </div>
                <button type="button" onClick={panel.onClose} className={`${closeBtn} ${outline ? "lg:hidden" : ""}`} aria-label={t("Cerrar")}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <EdgeScroll className="min-h-0 flex-1" innerClassName="h-full pb-6 pl-4 pr-4 pt-3">
                {panel.body}
              </EdgeScroll>
              {panel.footer && <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:pb-3">{panel.footer}</div>}
            </>
          ) : (
            <>
              {/* En el móvil, el nombre del curso arriba; en el ordenador el índice es estrecho (solo números) y el
                  nombre ya está en la lección. */}
              <div className="flex items-start gap-2 px-4 pb-1 pt-2 lg:hidden">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-muted"><Tr s={"Curso"} /></p>
                  <p className="display truncate text-[1.25rem] leading-tight" title={course.title}>
                    {course.title}
                  </p>
                </div>
                <button type="button" onClick={() => setOutlineSheet(false)} className={closeBtn} aria-label={t("Cerrar el índice")}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <EdgeScroll className="min-h-0 flex-1" innerClassName="h-full overflow-x-hidden pb-4 pl-4 pr-1 pt-2" data-board-scroll>
                {boardEl}
              </EdgeScroll>
            </>
          )}
        </aside>
      }
    >
      <div onClickCapture={stopWebLinks}>
        <StudentArea look={lookAsAccount(eff) ?? course.look}>
          <CourseType look={eff} fonts={fonts}>
            {children(device)}
          </CourseType>
        </StudentArea>
      </div>
    </CanvaShell>
  );
}

/**
 * Un curso aún sin lecciones: su título sobre el área de alumna y, en medio, lo que falta (el primer módulo o la
 * primera lección), con el índice a la izquierda como siempre.
 */
export function CourseCanvaEmpty({ course, board }: { course: CanvaCourse; board: BoardModule[] }) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const first = board[0];
  return (
    <CourseCanvaShell course={course} board={board} current={null} navigate={(href) => router.push(href)} viewHref={`/area/courses/${course.id}`}>
      {(device) => (
        <div className={`mx-auto max-w-2xl px-5 pb-32 text-center ${device === "movil" ? "pt-10" : "pt-28"}`}>
          <h1 className="display text-[2.2rem] leading-tight sm:text-[2.8rem]">{course.title}</h1>
          <p className="mt-4 text-muted"><Tr s={"Este curso aún no tiene lecciones."} /></p>
          <div data-canva-ui className="mt-8">
            {first ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await addStudioLesson(course.id, first.id);
                    if (r.lessonId) router.push(`/panel/cursos/${course.id}/lecciones/${r.lessonId}?nueva=1`);
                    else setError(r.error ?? "No se ha podido añadir");
                  })
                }
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{" "}<Tr s={"Añadir la primera lección"} /></button>
            ) : (
              <form
                className="mx-auto flex max-w-md flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  start(async () => {
                    const r = await addStudioModule(course.id, name);
                    if (r.error) setError(r.error);
                    else router.refresh();
                  });
                }}
              >
                <label className="sr-only" htmlFor="first-module"><Tr s={"Nombre del primer módulo"} /></label>
                <input id="first-module" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Módulo 1")} maxLength={120} className="input h-11 flex-1 text-base sm:text-sm" />
                <button className="btn btn-primary h-11" disabled={pending}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{" "}<Tr s={"Añadir el primer módulo"} /></button>
              </form>
            )}
            {error && <p className="mt-3 text-sm text-[#f2a99f]"><Tr s={error} /></p>}
          </div>
        </div>
      )}
    </CourseCanvaShell>
  );
}
