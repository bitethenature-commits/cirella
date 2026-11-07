import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CategoryIcons } from "@/components/creator-page/category-icons";
import { courseCategoriesLabel, courseCategoriesOf, type CourseCategory } from "@/lib/course-categories";

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

/** El tema de un producto que no lo tiene guardado (sesiones y lecturas), por su título. */
function categoryFromTitle(title: string): CourseCategory | null {
  const t = title.toLowerCase();
  if (t.includes("human")) return "HUMAN_DESIGN";
  if (t.includes("gene")) return "GENE_KEYS";
  if (t.includes("astrolog") || t.includes("carta")) return "ASTROLOGIA";
  if (t.includes("luna")) return "LUNA";
  if (t.includes("energ")) return "MI_ENERGIA";
  return null;
}

/**
 * El método y sistema de un curso, una sesión o una lectura: sus iconos dorados y su nombre
 * («Astrología + Mi energía»). Un curso usa sus temas; una sesión o una lectura, el de su título. Sin
 * tema (una sesión 1:1, una lectura de tu año), solo las estrellas.
 */
export function MethodTag({ product }: { product: { title: string; courseCategory?: string | null } }) {
  const saved = courseCategoriesOf(product.courseCategory);
  const guessed = saved.length ? saved : [categoryFromTitle(product.title)].filter((c): c is CourseCategory => !!c);
  const categories: CourseCategory[] = guessed.length ? guessed : ["ESPECIAL"];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <CategoryIcons categories={categories} size={1.2} className="text-gold" gap={0.2} />
      {guessed.length > 0 && <span>{courseCategoriesLabel(guessed)}</span>}
    </span>
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

/** Foto de perfil de la alumna o sus iniciales (cabecera del área, inicio y perfil). */
export function UserAvatar({ src, name, className = "h-9 w-9 text-xs" }: { src: string | null | undefined; name: string; className?: string }) {
  const initials =
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "·";
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" data-testid="user-avatar" className={`${className} shrink-0 rounded-full object-cover`} />;
  return (
    <span aria-hidden className={`${className} grid shrink-0 place-items-center rounded-full bg-sand font-semibold text-ink`}>
      {initials}
    </span>
  );
}
