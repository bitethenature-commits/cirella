"use client";

/** Formulario que pide confirmación antes de enviar una acción irreversible. */
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
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (message && !window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
