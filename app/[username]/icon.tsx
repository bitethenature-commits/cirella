import { ImageResponse } from "next/og";
import { getPublicCreator } from "@/lib/public";
import { getTemplate } from "@/lib/templates";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Favicon por creadora: inicial sobre el color de su plantilla. */
export default async function Icon({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const data = await getPublicCreator(username);
  const t = getTemplate(data?.config.template);
  const letter = (data?.config.displayName ?? username).charAt(0).toUpperCase();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 32, background: t.colors.bg, color: t.colors.gold, fontSize: 40, fontFamily: "serif" }}>
        {letter}
      </div>
    ),
    size,
  );
}
