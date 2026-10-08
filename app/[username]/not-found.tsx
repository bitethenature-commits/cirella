import Link from "next/link";
import { LogoMark } from "@/components/logo";

export default function CreatorNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-ink px-6 text-center text-cream">
      <div>
        <LogoMark className="mx-auto h-10 w-10" />
        <h1 className="display mt-6 text-4xl">Esta página no existe… todavía</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-cream/70">Puede que el enlace esté mal escrito o que la página ya no esté disponible.</p>
        <Link href="/registro" className="btn btn-light mt-8">
          Crea la tuya en 5 minutos
        </Link>
      </div>
    </main>
  );
}
