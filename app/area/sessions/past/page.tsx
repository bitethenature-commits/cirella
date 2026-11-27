import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireBuyerFull } from "@/lib/buyer-access";
import { myCircleRecordings } from "@/lib/circle-recordings";
import { Recordings } from "../recordings";
import { Tr } from "@/lib/i18n/client";

/**
 * «Círculos anteriores»: los círculos de la luna que ya hizo (los que compró sueltos y los de su membresía de su
 * tiempo), guardados con su grabación y su workbook en PDF (lib/circle-recordings.ts).
 */
export default async function PastCircles() {
  const user = await requireBuyerFull("/area/sessions/past");
  const items = await myCircleRecordings(user.id);
  return (
    <div className="space-y-8" data-course-night>
      <h1 className="sr-only"><Tr s={"Círculos anteriores"} /></h1>
      <Link href="/area/sessions" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold">
        <ArrowLeft className="h-4 w-4" />{" "}<Tr s={"Círculos y lecturas"} /></Link>
      <Recordings items={items} />
    </div>
  );
}
