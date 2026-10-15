import Link from "next/link";
import { Logo } from "./logo";

export function MarketingHeader({ refCode, dark = true }: { refCode?: string; dark?: boolean }) {
  const reg = `/registro${refCode ? `?ref=${encodeURIComponent(refCode)}` : ""}`;
  return (
    <header className={`absolute inset-x-0 top-0 z-30 ${dark ? "text-cream" : "text-ink"}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:h-20">
        <Logo light={dark} />
        <nav className="hidden items-center gap-8 text-sm md:flex">
          <a href="/#como-funciona" className="opacity-80 transition hover:opacity-100">Cómo funciona</a>
          <a href="/#plantillas" className="opacity-80 transition hover:opacity-100">Diseños</a>
          <a href="/#precios" className="opacity-80 transition hover:opacity-100">Precios</a>
          <Link href="/ana" className="opacity-80 transition hover:opacity-100">Demo</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/entrar" className={`btn btn-sm ${dark ? "text-cream hover:bg-white/10" : "btn-ghost"}`}>
            Entrar
          </Link>
          <Link href={reg} className={`btn btn-sm ${dark ? "btn-light" : "btn-primary"}`}>
            Crear mi página
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter({ platformName = "Cirella" }: { platformName?: string }) {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <Logo name={platformName} />
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <a href="/#precios">Precios</a>
          <Link href="/ana">Ver demo</Link>
          <Link href="/entrar">Entrar</Link>
          <Link href="/registro">Crear cuenta</Link>
          <Link href="/terminos">Términos</Link>
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/aviso-legal">Aviso legal</Link>
        </div>
        <p>© {new Date().getFullYear()} {platformName}. Hecho con calma.</p>
      </div>
    </footer>
  );
}
