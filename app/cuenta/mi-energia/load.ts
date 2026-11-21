import "server-only";
import { notFound } from "next/navigation";
import { maskEmail } from "@/lib/auth-utils";
import { energyAccess, listBirthProfiles } from "@/lib/birth-profiles";
import { requireBuyerFull } from "@/lib/buyer-access";
import { creatorLegalHref } from "@/lib/legal";
import { getPublishedOracleDecks } from "@/lib/oracle-decks";
import { getPublicCreator } from "@/lib/public";
import { resolveTheme, themeStyle, themeAttrs } from "@/lib/templates";

/**
 * Lo que necesitan las páginas de «Mi energía»: la sesión de cuenta (requireBuyerFull, que lleva al login
 * y vuelve), la regla del portal (cuenta + suscriptora confirmada de la newsletter de la dueña), SUS
 * perfiles guardados y los colores de la web de la dueña (los modelos se pintan con su tema). Solo en la
 * web personal; en la plataforma, 404.
 */
export async function loadEnergy(path: string, opts: { decks?: boolean } = {}) {
  const user = await requireBuyerFull(path);
  const access = await energyAccess();
  if (!access) notFound();
  const { owner, viewer } = access;
  const site = await getPublicCreator(owner.username);
  const theme = site ? resolveTheme(site.config.template, site.config.theme, site.allowCustom) : resolveTheme("mystical");
  const unlocked = viewer.unlocked;
  const [profiles, decks] = await Promise.all([
    unlocked ? listBirthProfiles(owner.id, user.id) : Promise.resolve([]),
    unlocked && opts.decks ? getPublishedOracleDecks(owner.id) : Promise.resolve([]),
  ]);
  return {
    user,
    owner,
    unlocked,
    access: { reason: viewer.reason, email: viewer.email ? maskEmail(viewer.email) : null, verified: viewer.sessionVerified },
    profiles,
    decks,
    privacyHref: creatorLegalHref(owner.username, "privacidad"),
    themeProps: { className: "cp !min-h-0 overflow-visible rounded-2xl px-4 py-5 sm:p-7", style: themeStyle(theme), ...themeAttrs(theme) },
  };
}
