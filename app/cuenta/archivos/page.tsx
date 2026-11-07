import Link from "next/link";
import { BookOpen, ChevronDown, Download, Eye, FileImage, FileText, Folder, FolderOpen, Headphones, Package, Sparkles, Video } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty";
import { requireBuyerFull } from "@/lib/buyer-access";
import { courseMaterials, deliveredReadings, getCustomerLibrary } from "@/lib/customer";
import { CreatorTag } from "../ui";
import { PageHeader } from "../page-header";

const ICON = { PDF: FileText, AUDIO: Headphones, VIDEO: Video, IMAGE: FileImage } as const;
const VIEWABLE = new Set(["PDF", "IMAGE", "AUDIO", "VIDEO"]);

function size(bytes: number | null) {
  if (!bytes) return "";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

type FileItem = {
  id: string;
  name: string;
  kind: string;
  sizeBytes: number | null;
  productTitle: string;
  creator: { displayName: string; avatarUrl: string | null };
  lesson?: { title: string; href: string } | null;
};

/** Una carpeta: lo que vino de una misma compra (una lectura, un curso, un descargable). */
type FolderView = { key: string; title: string; creator: FileItem["creator"]; files: FileItem[]; href?: string };

/** Agrupa por compra, en el orden en que aparecen. */
function foldersOf(files: (FileItem & { productId: string })[], href?: (productId: string) => string): FolderView[] {
  const map = new Map<string, FolderView>();
  for (const f of files) {
    const k = f.productId;
    if (!map.has(k)) map.set(k, { key: k, title: f.productTitle, creator: f.creator, files: [], href: href?.(k) });
    map.get(k)!.files.push(f);
  }
  return [...map.values()];
}

/**
 * «Mis archivos», en carpetas según de dónde vienen: las lecturas que le han entregado, los materiales de
 * cada curso (con la lección que los usa) y los descargables. Cada compra es una carpeta que se abre al
 * tocarla; si solo hay una, sale abierta.
 */
export default async function MyFiles() {
  const user = await requireBuyerFull("/cuenta/archivos");
  const lib = await getCustomerLibrary(user.id);
  const [materials, readings] = await Promise.all([courseMaterials(user.id, lib.courses), deliveredReadings(user.id)]);

  const sections: { key: string; title: string; hint: string; icon: ReactNode; folders: FolderView[] }[] = [
    {
      key: "lecturas",
      title: "Tus lecturas",
      hint: "Lo que te han preparado y entregado.",
      icon: <Sparkles className="h-4 w-4" />,
      folders: foldersOf(readings.map((f) => ({ ...f, productId: f.order.productId }))),
    },
    {
      key: "cursos",
      title: "De tus cursos",
      hint: "Los materiales de cada curso, con la lección que los usa.",
      icon: <BookOpen className="h-4 w-4" />,
      folders: foldersOf(materials, (id) => `/cuenta/cursos/${id}`),
    },
    {
      key: "descargables",
      title: "Descargables",
      hint: "Los archivos de tus compras.",
      icon: <Package className="h-4 w-4" />,
      folders: foldersOf(lib.files),
    },
  ].filter((s) => s.folders.length > 0);
  const total = sections.reduce((n, s) => n + s.folders.length, 0);

  return (
    <div>
      <PageHeader eyebrow="Tu biblioteca" title="Mis archivos" subtitle="Ordenados en carpetas según de dónde vienen." />
      {sections.map((s) => (
        <section key={s.key} className="mt-8" aria-labelledby={`archivos-${s.key}`}>
          <h2 id={`archivos-${s.key}`} className="eyebrow mb-1 flex items-center gap-2 !text-ink">
            {s.icon} {s.title}
          </h2>
          <p className="mb-3 text-xs text-muted">{s.hint}</p>
          <div className="space-y-2.5">
            {s.folders.map((f) => (
              <FolderBox key={f.key} folder={f} open={total === 1} />
            ))}
          </div>
        </section>
      ))}
      {total === 0 && (
        <div className="mt-6">
          <EmptyState icon={<FolderOpen className="h-5 w-5" />} title="No hay archivos" />
        </div>
      )}
    </div>
  );
}

function FolderBox({ folder, open }: { folder: FolderView; open: boolean }) {
  const n = folder.files.length;
  return (
    <details className="card group overflow-hidden" open={open || undefined} data-folder>
      <summary className="flex cursor-pointer list-none items-center gap-3.5 p-4 [&::-webkit-details-marker]:hidden">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
          <Folder className="h-5 w-5 group-open:hidden" />
          <FolderOpen className="hidden h-5 w-5 group-open:block" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.95rem] font-semibold">{folder.title}</span>
          <span className="block text-xs text-muted">
            {n} {n === 1 ? "archivo" : "archivos"}
          </span>
        </span>
        <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
          <CreatorTag name={folder.creator.displayName} avatarUrl={folder.creator.avatarUrl} />
          {folder.href && (
            <Link href={folder.href} className="text-xs font-semibold text-lavender-deep hover:underline">
              Ir al curso →
            </Link>
          )}
        </div>
        <ul className="divide-y divide-line">
          {folder.files.map((f) => {
            const Icon = ICON[f.kind as keyof typeof ICON] ?? FileText;
            return (
              <li key={f.id} className="flex items-center gap-4 px-4 py-3.5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{f.name}</p>
                  {size(f.sizeBytes) && <p className="truncate text-xs text-muted">{size(f.sizeBytes)}</p>}
                  {f.lesson && (
                    <Link href={f.lesson.href} className="block truncate text-xs font-medium text-lavender-deep hover:underline">
                      Lección: {f.lesson.title}
                    </Link>
                  )}
                </div>
                {VIEWABLE.has(f.kind) && (
                  <Link href={`/cuenta/archivos/${f.id}`} className="btn btn-outline btn-sm shrink-0" aria-label={`Ver ${f.name}`}>
                    <Eye className="h-3.5 w-3.5" /> Ver
                  </Link>
                )}
                <a href={`/api/download/${f.id}`} className="btn btn-outline btn-sm shrink-0" aria-label={`Descargar ${f.name}`}>
                  <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Descargar</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
