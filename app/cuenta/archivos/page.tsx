import Link from "next/link";
import { Download, Eye, FileImage, FileText, FolderOpen, Headphones, Video } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { requireBuyerFull } from "@/lib/buyer-access";
import { courseMaterials, deliveredReadings, getCustomerLibrary } from "@/lib/customer";
import { CreatorTag } from "../ui";

const ICON = { PDF: FileText, AUDIO: Headphones, VIDEO: Video, IMAGE: FileImage } as const;
const VIEWABLE = new Set(["PDF", "IMAGE", "AUDIO", "VIDEO"]);

function size(bytes: number | null) {
  if (!bytes) return "";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default async function MyFiles() {
  const user = await requireBuyerFull("/cuenta/archivos");
  const lib = await getCustomerLibrary(user.id);
  // También los materiales de los cursos, con la lección que los usa (los vídeos se ven en la lección).
  const files: ((typeof lib.files)[number] & { lesson?: { title: string; href: string } | null })[] = [...lib.files, ...(await courseMaterials(lib.courses))];
  const readings = await deliveredReadings(user.id);
  return (
    <div>
      <h1 className="display text-[2.4rem]">Mis archivos</h1>
      <p className="mt-1 text-sm text-muted">PDF, audios, imágenes y materiales de todas tus compras.</p>
      {readings.length > 0 && (
        <section className="mt-6">
          <h2 className="eyebrow mb-3 !text-ink">Tus lecturas</h2>
          <div className="card divide-y divide-line">
            {readings.map((f) => {
              const Icon = ICON[f.kind as keyof typeof ICON] ?? FileText;
              return (
                <div key={f.id} className="flex items-center gap-4 p-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand"><Icon className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{f.name}</p>
                    <p className="truncate text-xs text-muted">{f.productTitle} {size(f.sizeBytes) && `· ${size(f.sizeBytes)}`}</p>
                    <CreatorTag name={f.creator.displayName} avatarUrl={f.creator.avatarUrl} />
                  </div>
                  {VIEWABLE.has(f.kind) && (
                    <Link href={`/cuenta/archivos/${f.id}`} className="btn btn-outline btn-sm shrink-0" aria-label={`Ver ${f.name}`}>
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </Link>
                  )}
                  <a href={`/api/download/${f.id}`} className="btn btn-outline btn-sm shrink-0"><Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Descargar</span></a>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <div className="card mt-6 divide-y divide-line">
        {files.map((f) => {
          const Icon = ICON[f.kind as keyof typeof ICON] ?? FileText;
          return (
            <div key={f.id} className="flex items-center gap-4 p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand"><Icon className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{f.name}</p>
                <p className="truncate text-xs text-muted">{f.productTitle} {size(f.sizeBytes) && `· ${size(f.sizeBytes)}`}</p>
                {f.lesson && (
                  <Link href={f.lesson.href} className="block truncate text-xs font-medium text-lavender-deep hover:underline">
                    Lección: {f.lesson.title}
                  </Link>
                )}
                <CreatorTag name={f.creator.displayName} avatarUrl={f.creator.avatarUrl} />
              </div>
              {VIEWABLE.has(f.kind) && (
                <Link href={`/cuenta/archivos/${f.id}`} className="btn btn-outline btn-sm shrink-0" aria-label={`Ver ${f.name}`}>
                  <Eye className="h-3.5 w-3.5" /> Ver
                </Link>
              )}
              <a href={`/api/download/${f.id}`} className="btn btn-outline btn-sm shrink-0"><Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Descargar</span></a>
            </div>
          );
        })}
      </div>
      {files.length === 0 && readings.length === 0 && <EmptyState icon={<FolderOpen className="h-5 w-5" />} title="No hay archivos" />}
    </div>
  );
}
