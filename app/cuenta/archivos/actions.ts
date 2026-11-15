"use server";

import { revalidatePath } from "next/cache";
import { getBuyerSession } from "@/lib/buyer-access";
import { markCommentsSeen } from "@/lib/comment-social";

/** Al abrir la ventana «Comentarios»: sus avisos (me gusta y respuestas) dejan de ser nuevos. */
export async function seeComments() {
  const s = await getBuyerSession();
  if (!s || s.scope) return;
  await markCommentsSeen(s.user.id);
  revalidatePath("/cuenta", "layout");
}
