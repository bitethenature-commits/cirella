import { ImageResponse } from "next/og";
import { getPublicCreator } from "@/lib/public";
import { getTemplate } from "@/lib/templates";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Página de creadora";

export default async function OgImage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const data = await getPublicCreator(username);
  const t = getTemplate(data?.config.template);
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
          background: `radial-gradient(circle at 80% 0%, ${c.accent}55, transparent 55%), radial-gradient(circle at 0% 100%, ${c.gold}44, transparent 50%), ${c.bg}`,
          color: c.text,
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, textTransform: "uppercase", color: c.gold }}>{tagline}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 110, lineHeight: 1 }}>{name}</div>
          <div style={{ fontSize: 44, marginTop: 24, fontStyle: "italic", color: c.accent }}>{headline}</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, opacity: 0.7 }}>{`${data?.platformName ?? "Cirella"} · /${username}`}</div>
      </div>
    ),
    size,
  );
}
