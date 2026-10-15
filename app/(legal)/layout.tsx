import { MarketingFooter, MarketingHeader } from "@/components/marketing";
import { getSettings } from "@/lib/settings";

/** Términos, privacidad y aviso legal de la plataforma. */
export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const { platformName } = await getSettings();
  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <MarketingHeader dark={false} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-16 pt-28 sm:pt-32">{children}</main>
      <MarketingFooter platformName={platformName} />
    </div>
  );
}
