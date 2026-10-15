import Link from "next/link";
import { ArrowRight, CreditCard, Gift, KeyRound, Link2, Scale, Search, Share2 } from "lucide-react";
import { LegalIdentityStatus } from "@/components/panel/legal-status";
import { CopyButton } from "@/components/ui/copy-button";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appHost, appUrl } from "@/lib/env";
import { payoutView } from "@/lib/payouts";
import { REWARD_LABEL } from "@/lib/referrals";
import { getSettings } from "@/lib/settings";
import { isPersonalMode } from "@/lib/site-mode";
import { asTaxMode } from "@/lib/tax";
import { ShareButtons } from "@/app/onboarding/lista/share-buttons";
import { Badge, PageHeader } from "../ui";
import { changePassword, updateAccount } from "./actions";
import { VatCard } from "./vat-card";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { creator, user } = await requireCreator();
  const sp = await searchParams;
  // Modo personal: sin referidos, IVA ni cobros; su página es la portada de la web.
  const personal = isPersonalMode();
  const [referrals, settings] = await Promise.all([
    personal ? [] : prisma.referral.findMany({ where: { referrerId: creator.id }, include: { referred: { select: { displayName: true, username: true, published: true } } }, orderBy: { createdAt: "desc" } }),
    getSettings(),
  ]);
  const payout = payoutView(creator, { supportEmail: settings.supportEmail });
  const pageUrl = personal ? appUrl() : `${appUrl()}/${creator.username}`;
  const refUrl = `${appUrl()}/?ref=${creator.referralCode}`;
  const rewardText =
    settings.referralRewardType === "FREE_MONTH"
      ? `${settings.referralRewardValue} mes${Number(settings.referralRewardValue) > 1 ? "es" : ""} gratis de tu plan`
      : settings.referralRewardType === "CREDIT"
        ? `${(Number(settings.referralRewardValue) / 100).toFixed(0)} € de crédito`
        : `${(Number(settings.referralRewardValue) / 100).toLocaleString("es-ES")} puntos menos de comisión durante ${settings.referralDiscountMonths} meses`;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Ajustes" />
      <Flash ok={sp.ok} error={sp.error} />

      <section id="compartir" className="card scroll-mt-20 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold"><Share2 className="h-4 w-4" /> Comparte tu página</h2>
        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-line bg-paper py-1.5 pl-4 pr-1.5">
          <span className="truncate text-sm font-medium">{personal ? appHost() : `${appHost()}/${creator.username}`}</span>
          <CopyButton text={pageUrl} className="btn btn-primary btn-sm shrink-0" />
        </div>
        <div className="mt-2 rounded-2xl bg-ink p-3 text-cream [&_a]:border-white/10 [&_button]:border-white/10">
          <ShareButtons url={pageUrl} name={creator.displayName} />
        </div>
      </section>

      {!personal && (
        <section className="card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-semibold"><Gift className="h-4 w-4" /> Invita a otras creadoras</h2>
          <p className="mt-1 text-sm text-muted">Por cada creadora que publique su página con tu enlace recibes <strong className="text-ink">{rewardText}</strong>. Tu «Powered by» también lleva tu código.</p>
          <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-line bg-paper py-1.5 pl-4 pr-1.5">
            <span className="truncate text-sm font-medium">{refUrl.replace(/^https?:\/\//, "")}</span>
            <CopyButton text={refUrl} label="Copiar" className="btn btn-outline btn-sm shrink-0" />
          </div>
          <ul className="mt-4 divide-y divide-line text-sm">
            {referrals.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5">
                <span>{r.referred.displayName} <span className="text-muted">/{r.referred.username}</span></span>
                {r.status === "REWARDED" ? <Badge tone="success">{REWARD_LABEL[r.rewardType ?? ""] ?? "Recompensa"} conseguida</Badge> : <Badge tone="warning">Pendiente de publicar</Badge>}
              </li>
            ))}
            {referrals.length === 0 && <li className="py-2.5 text-muted">Aún no has invitado a nadie.</li>}
          </ul>
        </section>
      )}

      <section className="card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold"><Scale className="h-4 w-4" /> Datos legales y condiciones</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <LegalIdentityStatus creator={creator} />
            <p className="text-sm text-muted">
              {personal ? "Tu nombre, NIF y dirección aparecen en tu aviso legal (obligatorio en una web con actividad profesional)." : "Tu nombre fiscal, NIF y dirección aparecen en tu aviso legal y en cada compra."}
            </p>
          </div>
          <Link href="/panel/ajustes/legal" className="btn btn-outline btn-sm">Editar <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </section>

      {!personal && <VatCard creator={creator} taxMode={asTaxMode(settings.taxMode)} platformName={settings.platformName} />}

      {!personal && (
        <section className="card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-semibold"><CreditCard className="h-4 w-4" /> Cobros</h2>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-sm">
              <Badge tone={payout.tone}>{payout.label}</Badge>
              <span className="text-muted">{payout.canSell ? "Tus clientas ya pueden comprar." : "Nadie puede comprar hasta que se active."}</span>
            </p>
            <Link href="/panel/ajustes/cobros" className="btn btn-outline btn-sm">Gestionar cobros <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </section>
      )}

      <form action={updateAccount} className="card space-y-4 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold"><Link2 className="h-4 w-4" /> Enlace y contacto</h2>
        {personal ? (
          // El usuario lo fija OWNER_USERNAME en la configuración de la web: cambiarlo aquí la dejaría sin página.
          <div>
            <p className="field-label">Tu enlace</p>
            <p className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-medium">{appHost()}</p>
            <input type="hidden" name="username" value={creator.username} />
            <p className="field-hint">Tu página es la portada de tu web. Tus productos están en {appHost()}/{creator.username}/…</p>
          </div>
        ) : (
          <div>
            <label className="field-label">Nombre de usuario</label>
            <div className="flex items-center rounded-xl border border-line bg-white pl-3 text-sm">
              <span className="text-muted">{appHost()}/</span>
              <input name="username" defaultValue={creator.username} className="h-11 min-w-0 flex-1 bg-transparent pr-3 outline-none" />
            </div>
            <p className="field-hint">Si lo cambias, actualiza el enlace de tu bio: el antiguo dejará de funcionar.</p>
          </div>
        )}
        <div>
          <label className="field-label">{personal ? "Email para avisos de inscripciones" : "Email para avisos de ventas"}</label>
          <input name="contactEmail" type="email" defaultValue={creator.contactEmail ?? user.email} className="input" />
        </div>
        <h3 className="flex items-center gap-2 pt-2 font-semibold"><Search className="h-4 w-4" /> SEO</h3>
        <div>
          <label className="field-label">Título para Google</label>
          <input name="seoTitle" defaultValue={creator.seoTitle ?? ""} maxLength={70} className="input" placeholder={`${creator.displayName} · tu especialidad`} />
        </div>
        <div>
          <label className="field-label">Descripción</label>
          <textarea name="seoDescription" defaultValue={creator.seoDescription ?? ""} maxLength={160} rows={2} className="input" placeholder="Una frase que resuma lo que ofreces." />
          <p className="field-hint">La imagen para redes (Open Graph) y el favicon se generan automáticamente con tu diseño.</p>
        </div>
        <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
      </form>

      <form action={changePassword} className="card space-y-4 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4" /> Contraseña</h2>
        <p className="text-sm text-muted">Cuenta: {user.email}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="current" type="password" placeholder="Contraseña actual" className="input" autoComplete="current-password" />
          <input name="next" type="password" placeholder="Nueva contraseña" minLength={8} className="input" autoComplete="new-password" />
        </div>
        <SubmitButton className="btn btn-outline">Cambiar contraseña</SubmitButton>
      </form>
    </div>
  );
}
