import { CreatorShell } from "@/components/creator-page/creator-shell";
import { Logo } from "@/components/logo";
import { getPublicCreator } from "@/lib/public";

/**
 * Marco de las pantallas de acceso que no viven en (auth): con la marca de la creadora si el
 * enlace es suyo (la compradora nunca ve una pantalla genérica a mitad de camino) o, si no, el de
 * Cirella. `branded` dice a los hijos qué clases usar (cp-* con el tema de la creadora).
 */
export async function AuthFrame({ username, children }: { username?: string | null; children: (branded: boolean) => React.ReactNode }) {
  const data = username ? await getPublicCreator(username) : null;
  if (data)
    return (
      <CreatorShell username={data.creator.username} config={data.config} allowCustom={data.allowCustom} back={false}>
        <main className="mx-auto max-w-md px-5 pb-20 pt-12">{children(true)}</main>
      </CreatorShell>
    );
  return (
    <div className="flex min-h-dvh flex-col bg-paper px-5 pb-10 pt-6 sm:px-10">
      <Logo />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 animate-fade-up">{children(false)}</main>
    </div>
  );
}
