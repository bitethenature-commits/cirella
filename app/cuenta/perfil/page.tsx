import { redirect } from "next/navigation";

/** «Mi perfil» ya está dentro de Ajustes (/cuenta/soporte), encima de Soporte: los enlaces viejos llevan ahí. */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
  redirect(`/cuenta/soporte${q ? `?${q}` : ""}#perfil`);
}
