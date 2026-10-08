import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeader({ title, href, count }: { title: string; href?: string; count?: number }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="eyebrow !text-ink">
        {title}
        {count != null && <span className="ml-2 text-muted">{count}</span>}
      </h2>
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
          Ver todo <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-lavender-deep to-gold transition-all duration-700" style={{ width: `${value}%` }} />
    </div>
  );
}

export function Thumb({ src, emoji, className = "h-16 w-16" }: { src: string | null; emoji: string | null; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${className} shrink-0 rounded-xl object-cover`} />
  ) : (
    <div className={`${className} grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-ink-2 to-lavender-deep text-2xl`}>{emoji ?? "✦"}</div>
  );
}

export function CreatorTag({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
      ) : (
        <span className="grid h-4 w-4 place-items-center rounded-full bg-ink text-[0.5rem] text-cream">{name[0]}</span>
      )}
      {name}
    </span>
  );
}
