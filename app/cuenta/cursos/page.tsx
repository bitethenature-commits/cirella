import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { requireUser } from "@/lib/auth";
import { getCustomerLibrary } from "@/lib/customer";
import { CreatorTag, Progress } from "../ui";

export default async function MyCourses() {
  const user = await requireUser();
  const { courses } = await getCustomerLibrary(user.id);
  return (
    <div>
      <h1 className="display text-[2.4rem]">Mis cursos</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {courses.map((c) => (
          <Link key={c.product.id} href={`/cuenta/cursos/${c.product.id}`} className="card group overflow-hidden transition hover:shadow-lift">
            {c.product.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.product.imageUrl} alt="" className="aspect-[16/8] w-full object-cover" />
            )}
            <div className="p-5">
              <CreatorTag name={c.creator.displayName} avatarUrl={c.creator.avatarUrl} />
              <p className="display mt-2 text-[1.6rem] leading-tight">{c.product.title}</p>
              <div className="mt-4 flex items-center gap-3">
                <Progress value={c.percent} />
                <span className="shrink-0 text-xs font-semibold">{c.completed}/{c.total}</span>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold">
                {c.completed === 0 ? "Empezar" : "Continuar"} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
      {courses.length === 0 && <EmptyState icon={<BookOpen className="h-5 w-5" />} title="Sin cursos todavía">Cuando compres un curso aparecerá aquí con tu progreso.</EmptyState>}
    </div>
  );
}
