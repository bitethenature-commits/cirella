import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageVideo } from "@/components/creator-page/page-video";
import { parsePageVideoPath, pageVideoUrl } from "@/lib/page-blocks";
import { getSiteBrand } from "@/lib/site-brand";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Vídeo", robots: { index: false, follow: false } };

/**
 * «Ver vídeo» de un email (bloque «Vídeo» del editor visual con un vídeo subido): los buzones no
 * reproducen vídeo, así que la portada del email trae aquí. La dirección es la del vídeo
 * (/media/ver/<creadora>/<24 hex>.mp4: 96 bits al azar, imposible de adivinar) y no se indexa. El
 * vídeo sale de /media/video/… (redirección a una URL firmada del almacenamiento).
 */
export default async function WatchVideoPage({ params }: { params: Promise<{ cid: string; file: string }> }) {
  const { cid, file } = await params;
  const v = parsePageVideoPath([cid, file]);
  if (!v || !(await storage().head(v.key))) notFound();
  const brand = await getSiteBrand().catch(() => null);
  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-4 py-8 text-cream">
      <div className="w-full max-w-3xl">
        <PageVideo video={{ src: pageVideoUrl(v.creatorId, v.file), width: null, height: null, durationSec: null, codec: null, sizeBytes: null }} poster={null} title={brand?.name ? `Vídeo de ${brand.name}` : "Vídeo"} />
        <p className="mt-5 text-center text-sm text-cream/70">
          <Link href="/" className="underline underline-offset-4 hover:text-cream">{brand?.name ? `Ir a la web de ${brand.name}` : "Ir a la web"}</Link>
        </p>
      </div>
    </main>
  );
}
