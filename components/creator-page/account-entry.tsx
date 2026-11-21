"use client";
import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { siteText, type SiteTextKey, type SiteTexts } from "@/lib/site-texts";
import type { TextEdit } from "./home-edit";
import { UserRound } from "lucide-react";
import { accountEntryLink, hasHintCookie } from "@/lib/auth-utils";

const subscribe = () => () => {};
const readHint = () => hasHintCookie(document.cookie);
// En el servidor (y en la caché de la página pública) siempre «Entrar»: sin desajustes al hidratar.
const serverHint = () => false;

/**
 * Entrada visible al área de alumnas: «Entrar» o, con la sesión abierta, «Mi área». Lee la cookie
 * de pista (cirella_hola) en el navegador, así la página pública no deja de estar en caché.
 *   · pill: barra superior de la página pública (encima de la portada, colores sólidos);
 *   · header: cabecera de producto, checkout, gracias…;
 *   · footer: pie, con «¿Aún no tienes cuenta? Créala» en la web personal.
 */
export function AccountEntry({ username, personal = false, variant, texts, editText }: { username: string; personal?: boolean; variant: "pill" | "header" | "footer"; texts?: SiteTexts; editText?: TextEdit }) {
  const signedIn = useSyncExternalStore(subscribe, readHint, serverHint);
  const { href } = accountEntryLink(username, signedIn);
  const t = (key: SiteTextKey): ReactNode => {
    const v = siteText(texts, key);
    return editText ? editText(key, v) : v;
  };
  const label = t(signedIn ? "account.mine" : "account.enter");
  if (variant === "footer")
    return (
      <p className="flex flex-col items-center gap-1.5 text-sm">
        <Link href={href} className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline">
          {t(signedIn ? "account.footerIn" : personal ? "account.footerPersonal" : "account.footer")}
        </Link>
        {personal && !signedIn && (
          <Link href={`/${username}/entrar?modo=alta`} className="cp-muted inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            {t("account.signup")}
          </Link>
        )}
      </p>
    );
  return (
    <Link
      href={href}
      data-testid="account-entry"
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ${variant === "header" ? "ml-auto" : ""}`}
      style={
        variant === "pill"
          ? { background: "color-mix(in oklab, var(--c-bg) 92%, transparent)", color: "var(--c-text)", boxShadow: "0 1px 6px rgb(0 0 0 / 0.12)" }
          : { border: "1px solid var(--c-line)" }
      }
    >
      <UserRound className="h-4 w-4" /> {label}
    </Link>
  );
}
