import "server-only";
import { datetimeLocalValue, memberPostState } from "@/lib/community-rules";
import { uploadPolicy } from "@/lib/file-types";
import { countActiveMembers } from "@/lib/membership-access";
import { isPersonalMode } from "@/lib/site-mode";
import { tenantDb } from "@/lib/tenant";
import { formatDate } from "@/lib/tz";
import type { EditorPost } from "./post-editor";

/** Lo que necesita el editor de publicaciones (nueva o existente). null si no es una membresía suya. */
export async function loadPostEditor(creator: { id: string; timezone: string }, productId: string, postId: string | null) {
  const db = tenantDb(creator.id);
  const product = await db.product.findFirst({ where: { id: productId, type: "MEMBERSHIP" }, select: { id: true, title: true } });
  if (!product) return null;
  const now = new Date();
  const post = postId
    ? await db.membershipPost.findFirst({ where: { id: postId, productId }, include: { files: { orderBy: { sortOrder: "asc" } } } })
    : null;
  if (postId && !post) return null;
  const members = await countActiveMembers(creator.id, productId, now);
  const state = post ? memberPostState(post, now) : "DRAFT";
  const editor: EditorPost = post
    ? {
        id: post.id,
        title: post.title,
        body: post.body,
        bodyFormat: post.bodyFormat,
        kind: post.kind,
        mediaUrl: post.mediaUrl ?? "",
        state,
        at: state === "SCHEDULED" ? datetimeLocalValue(post.publishedAt, creator.timezone) : "",
        notify: post.notify,
        commentsOpen: post.commentsOpen,
        files: post.files.map((f) => ({ id: f.id, name: f.name, kind: f.kind, sizeBytes: f.sizeBytes, durationSec: f.durationSec, videoCodec: f.videoCodec, width: f.width, height: f.height })),
      }
    : { id: null, title: "", body: "", bodyFormat: "MD", kind: "TEXT", mediaUrl: "", state: "DRAFT", at: "", notify: true, commentsOpen: true, files: [] };
  const notifiedNote =
    post?.notifiedAt && post.notify
      ? `Avisamos a ${post.notifiedCount} ${post.notifiedCount === 1 ? "persona" : "personas"} el ${formatDate(post.notifiedAt, { day: "numeric", month: "short" }, creator.timezone)}.`
      : null;
  return {
    product,
    post,
    editor,
    members,
    notifiedNote,
    minAt: datetimeLocalValue(now, creator.timezone),
    limitsLabel: uploadPolicy(isPersonalMode()).label,
  };
}
