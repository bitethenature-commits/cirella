import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink, Sparkles } from "lucide-react";
import { cookies } from "next/headers";
import { LogoMark } from "@/components/logo";
import { CopyButton } from "@/components/ui/copy-button";
import { requireCreator } from "@/lib/auth";
import { appHost, appUrl } from "@/lib/env";
import { ShareButtons } from "./share-buttons";

export const metadata: Metadata = { title: "Tu página está lista · Cirella" };

export default async function ReadyPage() {
  const { creator } = await requireCreator();
  const url = `${appUrl()}/${creator.username}`;
  const pretty = `${appHost()}/${creator.username}`;
  const jar = await cookies();
  let plan = "";
  try {
    plan = JSON.parse(jar.get("cirella_signup")?.value ?? "{}").plan ?? "";
  } catch {}

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-ink px-5 py-16 text-cream">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/demo/hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
      <div className="starfield absolute inset-0 opacity-70" />
      <div className="relative w-full max-w-md text-center animate-fade-up">
        <LogoMark className="mx-auto h-12 w-12 animate-float" />
        <p className="eyebrow mt-8 !text-gold">Publicada</p>
        <h1 className="display mt-3 text-[3.2rem] leading-none sm:text-[4rem]">Tu página está lista</h1>
        <p className="mt-4 text-cream/70">Copia tu enlace y pégalo en tu bio. Tus seguidoras ya pueden comprarte.</p>

        <div className="glass-dark mt-8 rounded-2xl p-2">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-black/30 py-2 pl-4 pr-2">
            <span className="truncate font-medium">{pretty}</span>
            <CopyButton text={url} className="btn btn-light btn-sm shrink-0" label="Copiar enlace" />
          </div>
        </div>

        <ShareButtons url={url} name={creator.displayName} />

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={`/${creator.username}`} className="btn btn-light btn-lg" target="_blank">
            Ver página <ExternalLink className="h-4 w-4" />
          </Link>
          <Link href="/panel" className="btn btn-lg border border-white/20 text-cream hover:bg-white/10">
            Ir a mi panel <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {plan && plan !== "free" && (
          <Link href={`/panel/plan?elegir=${plan}`} className="mt-8 inline-flex items-center gap-2 text-sm text-gold hover:underline">
            <Sparkles className="h-4 w-4" /> Activar el plan que elegiste
          </Link>
        )}
      </div>
    </main>
  );
}
