"use client";
import { Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { Flash } from "@/components/ui/flash";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { ImageUpload } from "@/components/ui/image-upload";
import { LinkInput, type LinkTarget } from "@/components/panel/blocks/link-input";
import { PostMediaField } from "@/components/panel/post-media-field";
import { POST_BODY_MAX, POST_CTA_LABEL_MAX, POST_EXCERPT_MAX, POST_TITLE_MAX, type PostMedia } from "@/lib/posts";
import { slugify } from "@/lib/slug";
import { savePost, type PostActionState } from "./actions";

export type EditablePost = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  /** null = texto de antes | "MD" = con formato (lib/rich-text.ts). */
  bodyFormat: string | null;
  imageUrl: string | null;
  status: "DRAFT" | "PUBLISHED";
  /** «AAAA-MM-DD» en la zona de la creadora, o vacío. */
  publishedOn: string;
  /** Vídeo o audio (lib/posts.ts → PostMedia). */
  media: PostMedia | null;
  /** Llamada a la acción: texto del botón, enlace y código de descuento. */
  ctaLabel: string;
  ctaUrl: string;
  ctaCode: string;
};

/** Formulario de una publicación: crear (sin id) o editar. */
export function PostForm({
  post,
  host,
  username,
  initialMessage,
  personal,
  linkTargets,
}: {
  post: EditablePost;
  host: string;
  username: string;
  initialMessage?: string | null;
  /** Web personal: se pueden subir vídeos y audios (en la plataforma, enlace de YouTube o Vimeo). */
  personal: boolean;
  /** Sugerencias del enlace del botón (productos y páginas). */
  linkTargets: LinkTarget[];
}) {
  const [state, action, pending] = useActionState<PostActionState, FormData>(savePost, initialMessage ? { ok: initialMessage } : undefined);
  const [image, setImage] = useState(post.imageUrl);
  const [title, setTitle] = useState(post.title);
  const [slug, setSlug] = useState(post.slug);
  // Tras guardar, el campo muestra la dirección guardada de verdad (p. ej. «-2» si ya la usaba otra).
  useEffect(() => {
    if (state?.slug) setSlug(state.slug);
  }, [state]);
  const [status, setStatus] = useState(post.status);
  const [ctaUrl, setCtaUrl] = useState(post.ctaUrl);
  const shownSlug = slug || slugify(title) || "…";

  return (
    <form
      // onSubmit en lugar de action={}: así un error de validación no borra lo escrito.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-5"
    >
      <Flash ok={state?.ok} error={state?.error} />
      {post.id && <input type="hidden" name="id" value={post.id} />}
      <input type="hidden" name="imageUrl" value={image ?? ""} />

      <section className="card space-y-4 p-5 sm:p-6">
        <div>
          <label className="field-label" htmlFor="post-title">Título</label>
          <input id="post-title" name="title" className="input" required maxLength={POST_TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Luna llena en Aries: qué soltar" />
        </div>
        <div>
          <label className="field-label" htmlFor="post-body">Texto</label>
          <RichTextEditor
            id="post-body"
            name="body"
            formatName="bodyFormat"
            defaultValue={post.body}
            initialFormat={post.id ? post.bodyFormat : "MD"}
            required
            maxLength={POST_BODY_MAX}
            tools="full"
            images
            tone="account"
            headingLevel={2}
            legacy="links"
            rows={12}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="post-excerpt">Extracto <span className="font-normal text-muted">(opcional)</span></label>
          <textarea id="post-excerpt" name="excerpt" className="input" rows={2} maxLength={POST_EXCERPT_MAX} defaultValue={post.excerpt} />
          <p className="field-hint">Se ve en la lista y al compartir el enlace. Si lo dejas vacío, se usa el principio del texto.</p>
        </div>
      </section>

      <section className="card space-y-3 p-5 sm:p-6" aria-labelledby="post-media-title">
        <div>
          <h3 id="post-media-title" className="font-semibold">Vídeo o audio <span className="font-normal text-muted">(opcional)</span></h3>
          <p className="text-xs text-muted">Sale en la publicación; en la tarjeta de tu portada se avisa con «Vídeo» o «Audio».</p>
        </div>
        <PostMediaField initial={post.media} personal={personal} />
      </section>

      <section className="card space-y-3 p-5 sm:p-6" aria-labelledby="post-cta-title">
        <div>
          <h3 id="post-cta-title" className="font-semibold">Botón <span className="font-normal text-muted">(opcional)</span></h3>
          <p className="text-xs text-muted">Lleva a un producto, una página o una web.</p>
        </div>
        <input type="hidden" name="ctaUrl" value={ctaUrl} />
        
          <div>
            <label className="field-label" htmlFor="post-cta-label">Texto del botón</label>
            <input id="post-cta-label" name="ctaLabel" className="input" maxLength={POST_CTA_LABEL_MAX} defaultValue={post.ctaLabel} placeholder="Ver curso" />
          </div>
        <div>
          <p className="field-label">Enlace del botón</p>
          <LinkInput value={ctaUrl} onChange={setCtaUrl} ariaLabel="Enlace del botón de la publicación" targets={linkTargets} className="input" />
        </div>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <div>
          <p className="field-label">Imagen <span className="font-normal text-muted">(opcional)</span></p>
          <ImageUpload shape="wide" value={image} onChange={setImage} label="Añadir imagen" />
          <p className="field-hint">Horizontal. También es la imagen que se ve al compartir la publicación.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="post-date">Fecha de publicación</label>
            <input id="post-date" name="publishedOn" type="date" className="input" defaultValue={post.publishedOn} />
            <p className="field-hint">Vacía = el día que la publiques. Con una fecha futura, se publica sola ese día.</p>
          </div>
          <div>
            <label className="field-label" htmlFor="post-slug">Dirección</label>
            <input id="post-slug" name="slug" className="input" maxLength={80} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={slugify(title) || "se-crea-con-el-titulo"} />
            <p className="field-hint break-all">
              {host}/{username}/actualidades/{shownSlug}
            </p>
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <p className="field-label">Estado</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["DRAFT", "Borrador", "Solo tú la ves (en la vista previa)."],
              ["PUBLISHED", "Publicada", "Se ve en «Actualidades» de tu página."],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${status === value ? "border-ink bg-white ring-1 ring-ink" : "border-line bg-white"}`}>
              <input type="radio" name="status" value={value} checked={status === value} onChange={() => setStatus(value)} className="mt-1 accent-[#0E1024]" />
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {post.id ? "Guardar cambios" : status === "PUBLISHED" ? "Publicar" : "Guardar borrador"}
        </button>
        {post.id && (
          <Link href={`/panel/publicaciones/${post.id}/vista-previa`} className="btn btn-outline">
            <Eye className="h-4 w-4" /> Vista previa
          </Link>
        )}
      </div>
    </form>
  );
}
