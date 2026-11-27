"use client";
import { Camera } from "lucide-react";
import { useActionState, useRef, useState, type ReactNode } from "react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateProfile, type ProfileState } from "../actions";
import { removeAvatar, uploadAvatar, type CardState } from "./actions";
import { Tr, useT } from "@/lib/i18n/client";

/** Reduce la foto en el móvil a 512 px cuadrados (JPEG): rápida de subir y Safari lee los HEIC. */
async function squareJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bmp.width, bmp.height);
  const size = Math.min(512, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.85));
}

/**
 * La cabecera del perfil, compacta: la foto (al tocarla se cambia, con una cámara pequeña encima) y al lado
 * el nombre con su «Guardar» y el email debajo.
 */
export function ProfileTop({ avatar, hasPhoto, name, email }: { avatar: ReactNode; hasPhoto: boolean; name: string; email: string }) {
  const t = useT();
  const [state, action] = useActionState<ProfileState, FormData>(updateProfile, undefined);
  const [up, upAction] = useActionState<CardState, FormData>(uploadAvatar, undefined);
  const [removed, removeAction] = useActionState<CardState, FormData>(removeAvatar, undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const blob = useRef<Blob | null>(null);
  const photoForm = useRef<HTMLFormElement>(null);
  const reset = () => {
    setPreview(null);
    blob.current = null;
    photoForm.current?.reset();
  };
  return (
    <div className="space-y-3">
      <Flash ok={state?.ok ?? up?.ok ?? removed?.ok} error={readError ?? state?.error ?? up?.error ?? removed?.error} />
      <div className="flex items-start gap-4">
        {/* La foto */}
        <form
          ref={photoForm}
          action={async (fd) => {
            if (blob.current) fd.set("file", new File([blob.current], "foto.jpg", { type: "image/jpeg" }));
            await upAction(fd);
            reset();
          }}
          className="flex shrink-0 flex-col items-center gap-1.5"
        >
          <label className="relative block cursor-pointer" title={t("Cambiar foto")}>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt={t("Vista previa")} className="h-16 w-16 rounded-full object-cover ring-2 ring-gold/50" />
            ) : (
              avatar
            )}
            <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border border-gold/60 bg-paper text-gold">
              <Camera className="h-3 w-3" />
            </span>
            <span className="sr-only"><Tr s={"Cambiar foto"} /></span>
            <input
              type="file"
              name="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                setReadError(null);
                blob.current = null;
                if (!f) return;
                try {
                  blob.current = await squareJpeg(f);
                  setPreview(URL.createObjectURL(blob.current));
                } catch {
                  // Sin canvas (o un formato que el navegador no lee): se sube tal cual y el servidor decide.
                  if (f.type === "image/jpeg" || f.type === "image/png" || f.type === "image/webp") setPreview(URL.createObjectURL(f));
                  else setReadError("No hemos podido leer esta foto. Prueba con otra o haz una captura.");
                }
              }}
            />
          </label>
          {preview ? (
            <span className="flex gap-1">
              <SubmitButton className="btn btn-primary btn-sm !min-h-8 !px-3" pendingLabel="…"><Tr s={"Guardar"} /></SubmitButton>
              <button type="button" onClick={reset} className="btn btn-ghost btn-sm !min-h-8 !px-2"><Tr s={"No"} /></button>
            </span>
          ) : null}
        </form>

        {/* El nombre y el email */}
        <form action={action} className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="perfil-name"><Tr s={"Nombre"} /></label>
          <div className="flex gap-2">
            <input id="perfil-name" name="name" defaultValue={name} className="input min-w-0 flex-1 !min-h-11" required maxLength={80} autoComplete="name" placeholder={t("Tu nombre")} style={{ fontSize: "1rem" }} />
            <SubmitButton className="btn btn-primary btn-sm !min-h-11 shrink-0" pendingLabel="…"><Tr s={"Guardar"} /></SubmitButton>
          </div>
          <p className="mt-1.5 truncate text-[0.82rem] text-muted">{email}</p>
        </form>
      </div>
      {hasPhoto && !preview && (
        <form action={removeAction} className="-mt-1">
          <SubmitButton className="text-[0.75rem] text-muted underline-offset-2 hover:text-ink hover:underline" pendingLabel="…"><Tr s={"Quitar foto"} /></SubmitButton>
        </form>
      )}
    </div>
  );
}
