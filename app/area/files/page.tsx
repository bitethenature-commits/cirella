import { requireBuyerFull } from "@/lib/buyer-access";
import { commentInbox, likedPostsOf, savedLessonsOf } from "@/lib/comment-social";
import { savedPostsOf } from "@/lib/community";
import { courseMaterials, creatorBrief, getCustomerLibrary } from "@/lib/customer";
import { formatDate } from "@/lib/tz";
import { Desktop, type DeskFolder } from "./desktop";
import { Tr } from "@/lib/i18n/client";

/**
 * «Favoritos y comentarios» (antes «Mis archivos»; en el menú, una estrella y un chat): un escritorio
 * con carpetas que se abren en una ventana, como en el ordenador.
 *
 *   · Favoritos: todo lo que ha guardado de sus membresías; y una carpeta con los textos de cada una.
 *   · Comentarios: lo que ha escrito en las membresías y en las lecciones, con sus me gusta y las
 *     respuestas; lo nuevo (desde la última vez que la abrió) sale marcado en dorado.
 *   · Una carpeta con los materiales de cada curso (con la lección que los usa).
 * Las lecturas y sesiones no dejan nada aquí: se envían por email.
 */
export default async function MyFiles({ searchParams }: { searchParams: Promise<{ abrir?: string }> }) {
  const { abrir } = await searchParams;
  const user = await requireBuyerFull("/area/files");
  const lib = await getCustomerLibrary(user.id);
  const [materials, saved, inbox, lessons, liked] = await Promise.all([courseMaterials(user.id, lib.courses), savedPostsOf(user.id), commentInbox(user.id), savedLessonsOf(user.id), likedPostsOf(user.id)]);

  const texts = saved.map((p) => ({
    id: p.id,
    title: p.title,
    group: p.product.title,
    groupId: p.productId,
    paged: p.product.pagedReading,
    href: `/area/membership/${p.productId}/${p.id}`,
    date: formatDate(p.publishedAt, { day: "numeric", month: "long", year: "numeric" }, p.product.creator.timezone),
    type: "post" as const,
  }));
  // Las lecciones con la ★ van también en Favoritos.
  const savedLessons = lessons.map((s) => ({
    id: s.lesson.id,
    title: s.lesson.title,
    group: s.lesson.product.title,
    groupId: s.lesson.productId,
    paged: false,
    href: `/area/courses/${s.lesson.productId}?leccion=${s.lesson.id}`,
    date: "",
    type: "lesson" as const,
  }));
  // Las publicaciones con ♥: su propia carpeta, «Me gusta».
  const likedTexts = liked.map(({ post: p }) => ({
    id: p.id,
    title: p.title,
    group: p.product.title,
    href: `/area/membership/${p.productId}/${p.id}`,
    date: formatDate(p.publishedAt, { day: "numeric", month: "long", year: "numeric" }, p.product.creator.timezone),
    type: "post" as const,
  }));
  const dateOf = (d: Date) => formatDate(d, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const folders: DeskFolder[] = [
    { key: "favoritos", kind: "favorites", title: "Favoritos", count: texts.length + savedLessons.length, texts: [...texts, ...savedLessons] },
    { key: "me-gusta", kind: "likes", title: "Me gusta", count: likedTexts.length, texts: likedTexts },
    {
      key: "comentarios",
      kind: "comments",
      title: "Comentarios",
      count: inbox.items.length,
      unseen: inbox.unseen,
      comments: inbox.items.map((c) => ({
        id: c.id,
        place: c.kind,
        placeTitle: c.placeTitle,
        groupTitle: c.groupTitle,
        href: c.href,
        body: c.body,
        when: dateOf(c.when),
        likes: c.likes,
        newLikes: c.newLikes,
        isNew: c.isNew,
        replies: c.replies.map((r) => ({ id: r.id, authorName: r.authorName, byOwner: r.byOwner, body: r.body, when: dateOf(r.when), isNew: r.isNew })),
      })),
    },
  ];
  // Una carpeta con los textos guardados de cada membresía.
  const groups = new Map<string, typeof texts>();
  for (const t of texts) groups.set(t.groupId, [...(groups.get(t.groupId) ?? []), t]);
  for (const [id, list] of groups)
    folders.push({ key: `textos-${id}`, kind: "texts", title: `${list[0].paged ? "Textos" : "Guardados"} de ${list[0].group}`, count: list.length, texts: list, href: `/area/membership/${id}`, hrefLabel: "Ir a la membresía" });
  // Una carpeta con los materiales de cada curso.
  const courses = new Map<string, typeof materials>();
  for (const m of materials) courses.set(m.productId, [...(courses.get(m.productId) ?? []), m]);
  for (const [id, list] of courses)
    folders.push({
      key: `curso-${id}`,
      kind: "course",
      title: list[0].productTitle,
      count: list.length,
      href: `/area/courses/${id}`,
      hrefLabel: "Ir al curso",
      files: list.map((f) => ({ id: f.id, name: f.name, kind: f.kind, sizeBytes: f.sizeBytes, lesson: f.lesson ? { title: f.lesson.title, href: f.lesson.href } : null })),
    });

  const creator = lib.courses[0]?.creator ?? (saved[0] ? creatorBrief(saved[0].product.creator) : null);
  return (
    <div>
      <h1 className="sr-only"><Tr s={"Favoritos y comentarios"} /></h1>
      <Desktop folders={folders} initial={abrir === "favoritos" || abrir === "comentarios" || abrir === "me-gusta" ? abrir : null} owner={creator?.displayName ?? null} />
    </div>
  );
}
