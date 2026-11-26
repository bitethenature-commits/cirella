import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Tr } from "@/lib/i18n/client";

/**
 * Aviso de un producto sin nada que entregar (lib/delivery.ts → deliveryIssueCopy).
 * `block`: impide publicar o venderlo; `warn`: solo una recomendación (p. ej. membresía vacía).
 */
export function DeliveryAlert({
  title,
  text,
  href,
  cta,
  tone = "block",
}: {
  title: string;
  text: string;
  href?: string;
  cta?: string;
  tone?: "block" | "warn";
}) {
  const warn = tone === "warn";
  return (
    <div
      role="status"
      className={`flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5 ${warn ? "bg-sand/70" : "border border-[#ecd9b5] bg-[#fdf7ec]"}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${warn ? "text-muted" : "text-[#8a6420]"}`} />
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-sm text-muted"><Tr s={text} /></p>
        </div>
      </div>
      {href && cta && (
        warn ? (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1.5 pl-8 text-sm font-semibold hover:underline sm:pl-0">
            <Tr s={cta} /> <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <Link href={href} className="btn btn-primary btn-sm w-full shrink-0 sm:w-auto">
            <Tr s={cta} />
          </Link>
        )
      )}
    </div>
  );
}
