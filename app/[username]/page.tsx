import type { Metadata } from "next";
import { CreatorPublicPage, creatorPageMetadata } from "./public-page";

type Params = { username: string };

// Página cacheada (ISR, 60 s): no leer cookies ni searchParams aquí; lo personal va en
// /vista-previa o en componentes cliente. Lo que cambia la página llama a revalidatePath.
// En modo personal, /<dueña> redirige a «/» en middleware.ts y las demás usuarias dan 404 (layout).
export const revalidate = 60;
export const dynamicParams = true;
export function generateStaticParams(): Params[] {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  return creatorPageMetadata(username);
}

export default async function CreatorPublicPageRoute({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  return <CreatorPublicPage username={username} />;
}
