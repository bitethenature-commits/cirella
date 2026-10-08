import { Download, FileText, FolderOpen, Headphones, Video } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { requireUser } from "@/lib/auth";
import { getCustomerLibrary } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { CreatorTag } from "../ui";

const ICON = { PDF: FileText, AUDIO: Headphones, VIDEO: Video } as const;

function size(bytes: number | null) {
  if (!bytes) return "";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default async function MyFiles() {
  const user = await requireUser();
  const lib = await getCustomerLibrary(user.id);
  // También los materiales descargables de los cursos
  const courseFiles = lib.courses.length
    ? await prisma.productFile.findMany({ where: { productId: { in: lib.courses.map((c) => c.product.id) }, kind: { in: ["PDF", "AUDIO"] } } })
    : [];
  const files = [
    ...lib.files,
    ...courseFiles.map((f) => {
      const c = lib.courses.find((x) => x.product.id === f.productId)!;
      return { ...f, productTitle: c.product.title, creator: c.creator };
    }),
  ];
  return (
    <div>
      <h1 className="display text-[2.4rem]">Mis archivos</h1>
      <p className="mt-1 text-sm text-muted">PDF, audios y materiales de todas tus compras.</p>
      <div className="card mt-6 divide-y divide-line">
        {files.map((f) => {
          const Icon = ICON[f.kind as keyof typeof ICON] ?? FileText;
          return (
            <div key={f.id} className="flex items-center gap-4 p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand"><Icon className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{f.name}</p>
                <p className="truncate text-xs text-muted">{f.productTitle} {size(f.sizeBytes) && `· ${size(f.sizeBytes)}`}</p>
                <CreatorTag name={f.creator.displayName} avatarUrl={f.creator.avatarUrl} />
              </div>
              <a href={`/api/download/${f.id}`} className="btn btn-outline btn-sm shrink-0"><Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Descargar</span></a>
            </div>
          );
        })}
      </div>
      {files.length === 0 && <EmptyState icon={<FolderOpen className="h-5 w-5" />} title="No hay archivos" />}
    </div>
  );
}
