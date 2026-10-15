import { cache } from "react";
import { readPageConfig } from "./page-config";
import { getSettings } from "./settings";
import { getOwnerCreator, isPersonalMode } from "./site-mode";

/**
 * La marca que ve la gente en las pantallas comunes (entrar, panel, área de clienta, 404…):
 *   · plataforma: el nombre de la plataforma (/admin/ajustes), como siempre;
 *   · modo personal: el nombre de la página de la dueña (el que puso en «Mi página») y su foto.
 * Una consulta por petición (cache).
 */
export type SiteBrand = {
  personal: boolean;
  /** Nombre que sustituye a «Cirella» en logos y títulos. */
  name: string;
  /** Foto de la dueña (modo personal) para el logo; null = el logo de la plataforma. */
  avatarUrl: string | null;
  /** Usuario de la dueña (modo personal) o null. */
  ownerUsername: string | null;
  /** Email de contacto: el de la dueña en modo personal; el de soporte de la plataforma si no. */
  supportEmail: string;
};

/** Función pura: decide la marca a partir de los ajustes y, si la hay, de la dueña. */
export function resolveSiteBrand(input: {
  personal: boolean;
  platformName: string;
  supportEmail: string;
  owner: { username: string; displayName: string; avatarUrl: string | null; email: string | null } | null;
}): SiteBrand {
  const { personal, owner } = input;
  if (!personal || !owner)
    return { personal, name: input.platformName, avatarUrl: null, ownerUsername: owner?.username ?? null, supportEmail: input.supportEmail };
  return {
    personal,
    name: owner.displayName.trim() || owner.username,
    avatarUrl: owner.avatarUrl,
    ownerUsername: owner.username,
    supportEmail: owner.email || input.supportEmail,
  };
}

export const getSiteBrand = cache(async (): Promise<SiteBrand> => {
  const settings = await getSettings();
  const personal = isPersonalMode();
  const creator = personal ? await getOwnerCreator() : null;
  const cfg = creator ? readPageConfig(creator.pagePublished ?? creator.pageDraft, creator.displayName) : null;
  return resolveSiteBrand({
    personal,
    platformName: settings.platformName,
    supportEmail: settings.supportEmail,
    owner:
      creator && cfg
        ? { username: creator.username, displayName: cfg.displayName, avatarUrl: cfg.avatarUrl ?? null, email: creator.contactEmail || creator.user.email }
        : null,
  });
});
