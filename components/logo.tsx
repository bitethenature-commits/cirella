import Link from "next/link";

export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="lm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E9DCC0" />
          <stop offset="1" stopColor="#C9BBF2" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="#0E1024" />
      <path d="M20.5 8.5a8.5 8.5 0 1 0 3 12.7A7 7 0 1 1 20.5 8.5Z" fill="url(#lm)" />
      <circle cx="22.5" cy="10" r="1.2" fill="#E9DCC0" />
    </svg>
  );
}

/**
 * Logo con nombre. `mark` sustituye al símbolo de la plataforma (en modo personal, la foto de la
 * dueña: ver components/brand-logo.tsx).
 */
export function Logo({ href = "/", light = false, name = "Cirella", mark }: { href?: string; light?: boolean; name?: string; mark?: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-w-0 items-center gap-2" aria-label={`${name} inicio`}>
      {mark ?? <LogoMark />}
      <span className={`display truncate text-[1.55rem] leading-none ${light ? "text-cream" : "text-ink"}`}>{name}</span>
    </Link>
  );
}
