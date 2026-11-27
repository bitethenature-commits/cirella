import { redirect } from "next/navigation";

/** «Mi perfil» ya está dentro de Ajustes (/area/settings), encima de Soporte: los enlaces viejos llevan ahí. */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
  redirect(`/area/settings${q ? `?${q}` : ""}`);
}
