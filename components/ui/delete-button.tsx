import { Trash2 } from "lucide-react";
import { ConfirmForm } from "./confirm-form";

/**
 * La papelera de las listas del panel: pregunta antes y manda el id (y lo que haga falta) a la
 * acción de borrar. «icon» es solo el icono; «link», icono y texto pequeño; «button», un botón.
 */
export function DeleteButton({
  action,
  id,
  message,
  what,
  variant = "icon",
  label = "Borrar",
  fields,
  className,
}: {
  action: (form: FormData) => void | Promise<void>;
  id: string;
  message: string;
  /** Para quien usa lector de pantalla: «Borrar «Curso X»». */
  what?: string;
  variant?: "icon" | "link" | "button";
  label?: string;
  fields?: Record<string, string>;
  className?: string;
}) {
  const aria = what ? `${label} «${what}»` : label;
  return (
    <ConfirmForm action={action} message={message} className={className ?? "inline-flex"}>
      <input type="hidden" name="id" value={id} />
      {fields && Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {variant === "button" ? (
        <button className="btn btn-danger btn-sm" aria-label={aria}>
          <Trash2 className="h-4 w-4" /> {label}
        </button>
      ) : variant === "link" ? (
        <button className="inline-flex items-center gap-1 text-rose hover:underline" aria-label={aria}>
          <Trash2 className="h-3.5 w-3.5" /> {label}
        </button>
      ) : (
        <button className="grid h-8 w-8 place-items-center rounded-lg text-rose opacity-80 hover:bg-rose/10 hover:opacity-100" aria-label={aria} title={label}>
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </ConfirmForm>
  );
}
