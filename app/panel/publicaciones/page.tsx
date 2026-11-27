import { redirect } from "next/navigation";

/** «Publicaciones» ya está dentro de «Actualidades»: los enlaces viejos llevan ahí. */
export default async function PostsPage({ searchParams }: { searchParams: Promise<{ borrada?: string }> }) {
  const { borrada } = await searchParams;
  redirect(borrada ? "/panel/actualidades?borrada=1" : "/panel/actualidades");
}
