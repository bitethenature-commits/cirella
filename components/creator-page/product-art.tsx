import { imageSrcSet } from "@/lib/media-url";

/** Imagen de producto o, si no hay, una composición generativa con el emoji. */
export function ProductImage({
  src,
  emoji,
  title,
  className = "",
  sizes,
}: {
  src?: string | null;
  emoji?: string | null;
  title: string;
  className?: string;
  sizes?: string;
}) {
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        srcSet={imageSrcSet(src)}
        sizes={sizes ?? "(min-width: 768px) 360px, 85vw"}
        alt={title}
        loading="lazy"
        decoding="async"
        className={`cp-img h-full w-full object-cover ${className}`}
      />
    );
  return (
    <div
      className={`cp-img relative grid h-full w-full place-items-center overflow-hidden ${className}`}
      style={{
        background:
          "radial-gradient(120% 90% at 20% 10%, color-mix(in oklab, var(--c-accent) 55%, transparent), transparent 60%), radial-gradient(90% 80% at 90% 100%, color-mix(in oklab, var(--c-gold) 45%, transparent), transparent 60%), var(--c-bg2)",
      }}
      aria-label={title}
      role="img"
    >
      <span className="text-5xl drop-shadow-sm sm:text-6xl" aria-hidden>
        {emoji || "✦"}
      </span>
    </div>
  );
}

export function Avatar({
  src,
  name,
  className = "h-24 w-24",
  sizes = "128px",
}: {
  src?: string | null;
  name: string;
  className?: string;
  sizes?: string;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} srcSet={imageSrcSet(src)} sizes={sizes} alt={name} decoding="async" className={`${className} rounded-full object-cover`} />;
  return (
    <div
      className={`${className} grid place-items-center rounded-full`}
      style={{ background: "var(--c-accent)", color: "var(--c-accent-text)" }}
      aria-label={name}
    >
      <span className="cp-display text-[2.1em] leading-none" style={{ fontSize: "inherit" }}>
        <span className="text-3xl">{initials}</span>
      </span>
    </div>
  );
}
