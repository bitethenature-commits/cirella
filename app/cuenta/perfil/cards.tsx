"use client";
import { useActionState, useRef, useState } from "react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { changeOwnPassword, removeAvatar, requestEmailChange, uploadAvatar, type CardState } from "./actions";

const FIELD = { fontSize: "1rem" } as const;

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

export function PhotoCard({ hasPhoto }: { hasPhoto: boolean }) {
  const [state, action] = useActionState<CardState, FormData>(uploadAvatar, undefined);
  const [removed, removeAction] = useActionState<CardState, FormData>(removeAvatar, undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const blob = useRef<Blob | null>(null);
  return (
    <div className="space-y-3">
      <Flash ok={state?.ok ?? removed?.ok} error={readError ?? state?.error ?? removed?.error} />
      <form
        action={(fd) => {
          if (blob.current) fd.set("file", new File([blob.current], "foto.jpg", { type: "image/jpeg" }));
          return action(fd);
        }}
        className="space-y-3"
      >
        <label className="btn btn-outline min-h-11 cursor-pointer">
          Elegir foto
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
        {preview && (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Vista previa" className="h-16 w-16 rounded-full object-cover" />
            <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
          </div>
        )}
      </form>
      {hasPhoto && !preview && (
        <form action={removeAction}>
          <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…">Quitar foto</SubmitButton>
        </form>
      )}
    </div>
  );
}

export function EmailCard({ hasPassword }: { hasPassword: boolean }) {
  const [state, action] = useActionState<CardState, FormData>(requestEmailChange, undefined);
  if (state?.ok) return <Flash ok={state.ok} />;
  return (
    <form action={action} className="space-y-3">
      <Flash error={state?.error} />
      <div>
        <label className="field-label" htmlFor="nuevo-email">Email nuevo</label>
        <input id="nuevo-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" required className="input" style={FIELD} />
      </div>
      {hasPassword && (
        <div>
          <label className="field-label" htmlFor="email-password">Tu contraseña</label>
          <input id="email-password" name="password" type="password" autoComplete="current-password" required className="input" style={FIELD} />
        </div>
      )}
      <SubmitButton className="btn btn-outline" pendingLabel="Enviando…">Cambiar email</SubmitButton>
    </form>
  );
}

export function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const [state, action] = useActionState<CardState, FormData>(changeOwnPassword, undefined);
  return (
    <form action={action} className="space-y-3">
      <Flash ok={state?.ok} error={state?.error} />
      {hasPassword && (
        <div>
          <label className="field-label" htmlFor="pw-actual">Contraseña actual</label>
          <input id="pw-actual" name="current" type="password" autoComplete="current-password" required className="input" style={FIELD} />
        </div>
      )}
      <div>
        <label className="field-label" htmlFor="pw-nueva">{hasPassword ? "Contraseña nueva" : "Tu contraseña"}</label>
        <input id="pw-nueva" name="next" type="password" autoComplete="new-password" minLength={8} required className="input" style={FIELD} placeholder="Mínimo 8 caracteres" />
      </div>
      <SubmitButton className="btn btn-outline" pendingLabel="Guardando…">{hasPassword ? "Cambiar contraseña" : "Crear contraseña"}</SubmitButton>
    </form>
  );
}
