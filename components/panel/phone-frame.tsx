/**
 * Marco de teléfono de las vistas previas en vivo del panel (editor de la página, ficha de producto).
 * `screenClassName` da el tamaño y el scroll de la pantalla.
 */
export function PhoneFrame({ children, screenClassName = "" }: { children: React.ReactNode; screenClassName?: string }) {
  return (
    <div className="mx-auto w-fit rounded-[2.6rem] border border-line bg-ink p-2.5 shadow-lift">
      <div className={`rounded-[2.1rem] ${screenClassName}`}>{children}</div>
    </div>
  );
}
