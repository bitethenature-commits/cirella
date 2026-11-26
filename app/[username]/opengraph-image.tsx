import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { appHost } from "@/lib/env";
import { getPublicCreator } from "@/lib/public";
import { isPersonalMode } from "@/lib/site-mode";
import { resolveTheme } from "@/lib/templates";
import { Tr } from "@/lib/i18n/client";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Página de creadora";

export default async function OgImage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const data = await getPublicCreator(username);
  // Web personal: solo existe la imagen de la dueña; nada de tarjetas genéricas con la marca de la plataforma.
  if (!data && isPersonalMode()) notFound();
  const t = resolveTheme(null, data?.config.theme, data?.allowCustom ?? true);
  const c = t.colors;
  const name = data?.config.displayName ?? "Cirella";
  const tagline = data?.config.tagline ?? "";
  const headline = data?.config.headline ?? "";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          // Satori (next/og) no acepta un color suelto como capa de `background`: color y degradados van aparte.
          backgroundColor: c.bg,
          backgroundImage: `radial-gradient(circle at 80% 0%, ${c.accent}55, transparent 55%), radial-gradient(circle at 0% 100%, ${c.gold}44, transparent 50%)`,
          color: c.text,
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, textTransform: "uppercase", color: c.gold }}><Tr s={tagline} /></div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 110, lineHeight: 1 }}>{name}</div>
          <div style={{ fontSize: 44, marginTop: 24, fontStyle: "italic", color: c.accent }}><Tr s={headline} /></div>
        </div>
        <div style={{ display: "flex", fontSize: 26, opacity: 0.7 }}>{data?.personal ? appHost() : `${data?.platformName ?? "Cirella"} · /${username}`}</div>
      </div>
    ),
    size,
  );
}
