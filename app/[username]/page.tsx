import type { Metadata } from "next";
import { CreatorPublicPage, creatorPageMetadata } from "./public-page";

type Params = { username: string };

// Se hace en cada visita: el idioma (alemán, /en, /es) llega con cada petición, así que no puede guardarse
// una sola copia para todas.
// En modo personal, /<dueña> redirige a «/» en middleware.ts y las demás usuarias dan 404 (layout).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  return creatorPageMetadata(username);
}

export default async function CreatorPublicPageRoute({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  return <CreatorPublicPage username={username} />;
}
