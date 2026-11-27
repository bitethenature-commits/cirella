"use client";
import { useRef } from "react";
import { askConfirm } from "./ask-confirm";

/**
 * Formulario que pide confirmación antes de enviar una acción irreversible. La pregunta sale en una ventana
 * de la propia página (ask-confirm.ts), no en window.confirm, que algunos navegadores integrados no enseñan.
 */
export function ConfirmForm({
  action,
  message,
  children,
  className,
}: {
  action: (form: FormData) => void | Promise<void>;
  message: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  const confirmed = useRef(false);
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!message || confirmed.current) {
          confirmed.current = false;
          return;
        }
        e.preventDefault();
        const form = e.currentTarget;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        void askConfirm(message, { from: form }).then((yes) => {
          if (!yes || !form.isConnected) return;
          confirmed.current = true;
          if (submitter && form.contains(submitter)) form.requestSubmit(submitter);
          else form.requestSubmit();
        });
      }}
    >
      {children}
    </form>
  );
}
