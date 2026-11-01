"use client";
import { startTransition, useActionState, useState } from "react";
import { Flash } from "@/components/ui/flash";
import { ImageUpload } from "@/components/ui/image-upload";
import { DECK_DESCRIPTION_MAX, DECK_NAME_MAX } from "@/lib/oracle-rules";
import { saveDeck, type DeckActionState } from "./actions";

export type EditableDeck = { id: string | null; name: string; description: string; backImageUrl: string | null };

/** Nombre, descripción y reverso de una baraja (el reverso es común a todas sus cartas). */
export function DeckForm({ deck }: { deck: EditableDeck }) {
  const [state, action, pending] = useActionState<DeckActionState, FormData>(saveDeck, undefined);
  const [back, setBack] = useState(deck.backImageUrl);
  return (
    <form
      // Sin el reinicio del formulario de React 19: si algo falla, lo escrito se queda.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="card space-y-4 p-5 sm:p-6"
    >
      <Flash ok={state?.ok} error={state?.error} />
      {deck.id && <input type="hidden" name="id" value={deck.id} />}
      <input type="hidden" name="backImageUrl" value={back ?? ""} />
      <div>
        <label className="field-label" htmlFor="deck-name">Nombre</label>
        <input id="deck-name" name="name" className="input" required maxLength={DECK_NAME_MAX} defaultValue={deck.name} placeholder="Oráculo de las Diosas" />
      </div>
      <div>
        <label className="field-label" htmlFor="deck-description">Descripción <span className="font-normal text-muted">(opcional: se lee antes de barajar)</span></label>
        <textarea id="deck-description" name="description" className="input" rows={3} maxLength={DECK_DESCRIPTION_MAX} defaultValue={deck.description} placeholder="Treinta cartas para escuchar lo que ya sabes." />
      </div>
      <div>
        <p className="field-label">Reverso <span className="font-normal text-muted">(opcional)</span></p>
        <div className="max-w-[14rem]">
          <ImageUpload value={back} onChange={setBack} label="Subir el reverso" fit="contain" graphic />
        </div>
        <p className="field-hint">El dorso de todas las cartas. Sin imagen, el reverso dibujado con la luna creciente.</p>
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Guardando…" : deck.id ? "Guardar" : "Crear baraja"}
      </button>
    </form>
  );
}
