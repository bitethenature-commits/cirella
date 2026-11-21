"use client";

import { Heart, MessageCircle, Star } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { likePost, savePost } from "./[productId]/[postId]/actions";

/**
 * La franja de abajo de cada tarjeta del feed: ♥ «me gusta» y ★ favoritos se pulsan sin entrar en la
 * publicación (van por encima del enlace de la tarjeta); los comentarios llevan dentro.
 */
export function CardActions({
  postId,
  liked,
  likes,
  saved,
  comments,
  canLike,
  canSave,
}: {
  postId: string;
  liked: boolean;
  likes: number;
  saved: boolean;
  comments: number;
  canLike: boolean;
  canSave: boolean;
}) {
  const [like, setLike] = useState({ liked, count: likes });
  const [likeView, setLikeView] = useOptimistic(like);
  const [fav, setFav] = useState(saved);
  const [favView, setFavView] = useOptimistic(fav);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs font-semibold" data-card-community>
      {canLike ? (
        <button
          type="button"
          aria-pressed={likeView.liked}
          aria-label={likeView.liked ? "Quitar me gusta" : "Me gusta"}
          className={`pill-like card-act inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1 ${likeView.liked ? "is-on" : ""}`}
          onClick={(e) => {
            stop(e);
            start(async () => {
              setLikeView({ liked: !likeView.liked, count: likeView.count + (likeView.liked ? -1 : 1) });
              const r = await likePost(postId);
              if ("error" in r) setError(r.error);
              else {
                setError(null);
                setLike(r);
              }
            });
          }}
        >
          <Heart className={`h-3.5 w-3.5 ${likeView.liked ? "fill-current" : ""}`} /> {likeView.count} me gusta
        </button>
      ) : (
        <span className={`pill-like inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${like.liked ? "is-on" : ""}`}>
          <Heart className={`h-3.5 w-3.5 ${like.liked ? "fill-current" : ""}`} /> {like.count} me gusta
        </span>
      )}
      <span className="pill-com inline-flex items-center gap-1.5 rounded-full px-2.5 py-1">
        <MessageCircle className="h-3.5 w-3.5" /> {comments} {comments === 1 ? "comentario" : "comentarios"}
      </span>
      {canSave && (
        <button
          type="button"
          aria-pressed={favView}
          aria-label={favView ? "Quitar de favoritos" : "Guardar en favoritos"}
          title={favView ? "En tus favoritos (la estrella del menú)" : "Guardar en favoritos"}
          className="pill-fav card-act ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1"
          data-on={favView ? "true" : undefined}
          onClick={(e) => {
            stop(e);
            start(async () => {
              setFavView(!favView);
              const r = await savePost(postId);
              if ("error" in r) setError(r.error);
              else {
                setError(null);
                setFav(r.saved);
              }
            });
          }}
        >
          <Star className={`h-3.5 w-3.5 ${favView ? "fill-current" : ""}`} /> {favView ? "En favoritos" : "Favorito"}
        </button>
      )}
      {error && (
        <span className="w-full text-[0.7rem] font-normal text-rose" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
