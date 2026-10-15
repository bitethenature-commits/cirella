import Link from "next/link";
import { LogoMark } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center">
      <LogoMark className="h-10 w-10" />
      <h1 className="display mt-6 text-4xl">No encontramos esta página</h1>
      <p className="mt-3 max-w-sm text-sm text-muted">Puede que el enlace esté mal escrito o que ya no exista.</p>
      <Link href="/" className="btn btn-primary mt-8">Volver al inicio</Link>
    </main>
  );
}
