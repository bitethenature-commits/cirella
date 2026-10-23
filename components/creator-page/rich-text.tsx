import { LegacyLinks } from "@/components/rich-text/legacy-text";

/**
 * Texto de la creadora con párrafos y enlaces automáticos (texto «de antes»). Se mantiene por
 * compatibilidad: el JSX vive en components/rich-text/legacy-text.tsx («links»). Para texto que
 * puede tener formato, usa <RichContent> (components/rich-text/rich-content.tsx).
 */
export function RichText({ text, className = "", paragraphClassName = "" }: { text: string; className?: string; paragraphClassName?: string }) {
  return <LegacyLinks text={text} className={className} paragraphClassName={paragraphClassName} />;
}
