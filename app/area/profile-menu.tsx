"use client";

import { AtSign, ChevronDown, KeyRound, Quote } from "lucide-react";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateTagline, type ProfileState } from "./actions";
import { EmailCard, PasswordCard } from "./profile/cards";
import { ProfileTop } from "./profile/form";
import { Tr, useT } from "@/lib/i18n/client";

export type ProfileInfo = {
  name: string;
  email: string;
  tagline: string;
  hasPhoto: boolean;
  hasPassword: boolean;
  /** Su foto pequeña (la pestaña) y grande (dentro), ya dibujadas. */
  small: ReactNode;
  big: ReactNode;
};

/**
 * Arriba a la izquierda del área: su foto y su nombre. Al tocarlo se abre su perfil hacia abajo: cambiar la foto y
 * el nombre, su frase (sale junto a su nombre en los comentarios), el email y la contraseña.
 */
export function ProfileMenu({ info }: { info: ProfileInfo }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  useEffect(() => setOpen(false), [path]);
  const shown = info.name || info.email.split("@")[0];
  return (
    <div ref={box} className="relative min-w-0">
      <div className="panel-side panel-tab panel-tab-top min-w-0 overflow-hidden rounded-b-[1.6rem]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mi-perfil"
          title={t("Mi perfil")}
          className="panel-nav-link flex max-w-[60vw] items-center gap-3 px-4 pb-3.5 pt-4 text-left sm:max-w-[22rem] sm:px-5"
        >
          <span className="shrink-0">{info.small}</span>
          <span className="panel-tab-title display min-w-0 truncate text-[1.35rem] leading-none sm:text-[1.6rem]"><Tr s={shown} /></span>
          <ChevronDown className={`h-4 w-4 shrink-0 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>
      {open && (
        <div
          id="mi-perfil"
          role="dialog"
          aria-label={t("Mi perfil")}
          className="panel-rise panel-side panel-tab absolute left-0 top-full mt-2 max-h-[calc(100dvh-7rem)] w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl p-4"
        >
          <p className="mb-3 text-[0.66rem] font-medium uppercase tracking-[0.36em] text-gold"><Tr s={"Mi perfil"} /></p>
          <ProfileTop avatar={info.big} hasPhoto={info.hasPhoto} name={info.name} email={info.email} />
          <TaglineForm tagline={info.tagline} />
          <div className="mt-3 divide-y divide-line border-t border-line">
            <Row icon={<AtSign className="h-4 w-4" />} title={t("Cambiar email")}>
              <p className="mb-3 text-[0.8rem] text-muted"><Tr s={"Te enviaremos un enlace al email nuevo para confirmarlo."} /></p>
              <EmailCard hasPassword={info.hasPassword} />
            </Row>
            <Row icon={<KeyRound className="h-4 w-4" />} title={info.hasPassword ? t("Cambiar contraseña") : t("Crear contraseña")}>
              <PasswordCard hasPassword={info.hasPassword} />
            </Row>
          </div>
        </div>
      )}
    </div>
  );
}

/** Su frase: una línea que sale junto a su nombre en los comentarios. */
function TaglineForm({ tagline }: { tagline: string }) {
  const t = useT();
  const [state, action] = useActionState<ProfileState, FormData>(updateTagline, undefined);
  return (
    <form action={action} className="mt-4 space-y-2">
      <label htmlFor="perfil-frase" className="flex items-center gap-2 text-[0.8rem] font-medium">
        <Quote className="h-3.5 w-3.5 text-gold" aria-hidden />{" "}<Tr s={"Tu frase"} /></label>
      <div className="flex gap-2">
        <input id="perfil-frase" name="tagline" defaultValue={tagline} maxLength={80} className="input min-w-0 flex-1 !min-h-11" placeholder={t("Sale junto a tu nombre en los comentarios")} style={{ fontSize: "1rem" }} />
        <SubmitButton className="btn btn-primary btn-sm !min-h-11 shrink-0" pendingLabel="…"><Tr s={"Guardar"} /></SubmitButton>
      </div>
      <Flash ok={state?.ok} error={state?.error} />
    </form>
  );
}

function Row({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 py-2 text-[0.92rem] [&::-webkit-details-marker]:hidden">
        <span className="text-gold">{icon}</span>
        <span className="font-medium">{title}</span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" />
      </summary>
      <div className="pb-4 pt-1">{children}</div>
    </details>
  );
}
