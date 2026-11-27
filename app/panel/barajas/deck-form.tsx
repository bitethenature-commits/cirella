"use client";
import { startTransition, useActionState, useState } from "react";
import { Flash } from "@/components/ui/flash";
import { CardImageFramer } from "@/components/panel/card-image-framer";
import { DECK_DESCRIPTION_MAX, DECK_NAME_MAX } from "@/lib/oracle-rules";
import { saveDeck, type DeckActionState } from "./actions";
import { Tr, useT } from "@/lib/i18n/client";

export type EditableDeck = { id: string | null; name: string; description: string; backImageUrl: string | null; backFrame: string | null };

/** Nombre, descripción y reverso de una baraja (el reverso es común a todas sus cartas). */
export function DeckForm({ deck }: { deck: EditableDeck }) {
  const t = useT();
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
        <label className="field-label" htmlFor="deck-name"><Tr s={"Nombre"} /></label>
        <input id="deck-name" name="name" className="input" required maxLength={DECK_NAME_MAX} defaultValue={deck.name} placeholder={t("Oráculo de las Diosas")} />
      </div>
      <div>
        <label className="field-label" htmlFor="deck-description"><Tr s={"Descripción"} />{" "}<span className="font-normal text-muted"><Tr s={"(opcional: se lee antes de barajar)"} /></span></label>
        <textarea id="deck-description" name="description" className="input" rows={3} maxLength={DECK_DESCRIPTION_MAX} defaultValue={deck.description} placeholder={t("Treinta cartas para escuchar lo que ya sabes.")} />
      </div>
      <CardImageFramer
        label={<><Tr s={"Reverso de la baraja"} />{" "}<span className="font-normal text-muted"><Tr s={"(opcional)"} /></span></>}
        hint={t("El dorso de todas las cartas (cada carta puede llevar el suyo). Sin imagen, el reverso dibujado con la luna creciente.")}
        uploadLabel="Subir el reverso"
        image={back}
        onImage={setBack}
        frame={deck.backFrame}
        frameName="backFrame"
      />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? t("Guardando…") : deck.id ? t("Guardar") : t("Crear baraja")}
      </button>
    </form>
  );
}
