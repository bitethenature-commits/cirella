"use client";
import { startTransition, useActionState, useState } from "react";
import { ORACLE_CARDS } from "@/components/models/data/oracle";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Flash } from "@/components/ui/flash";
import { ImageUpload } from "@/components/ui/image-upload";
import { CARD_KEYWORD_MAX, CARD_MESSAGE_MAX, CARD_NAME_MAX, CARD_QUESTION_MAX } from "@/lib/oracle-rules";
import { saveCard, type DeckActionState } from "./actions";

export type EditableCard = {
  id: string | null;
  deckId: string;
  name: string;
  keyword: string;
  message: string;
  question: string;
  imageUrl: string | null;
  motif: string;
  reversible: boolean;
  reversedMessage: string;
};

/**
 * Una carta: nombre, palabra clave, mensaje (con formato), pregunta, imagen opcional (sin ella, un
 * motivo dibujado de la baraja de serie) y si puede salir invertida (con su mensaje de invertida).
 */
export function CardForm({ card }: { card: EditableCard }) {
  const [state, action, pending] = useActionState<DeckActionState, FormData>(saveCard, undefined);
  const [image, setImage] = useState(card.imageUrl);
  const [reversible, setReversible] = useState(card.reversible);
  return (
    <form
      // Sin el reinicio del formulario de React 19: si algo falla, lo escrito se queda.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-5"
    >
      <Flash ok={state?.ok} error={state?.error} />
      {card.id && <input type="hidden" name="id" value={card.id} />}
      <input type="hidden" name="deckId" value={card.deckId} />
      <input type="hidden" name="imageUrl" value={image ?? ""} />

      <section className="card space-y-4 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="card-name">Nombre</label>
            <input id="card-name" name="name" className="input" required maxLength={CARD_NAME_MAX} defaultValue={card.name} placeholder="La Luna Nueva" />
          </div>
          <div>
            <label className="field-label" htmlFor="card-keyword">Palabra clave</label>
            <input id="card-keyword" name="keyword" className="input" maxLength={CARD_KEYWORD_MAX} defaultValue={card.keyword} placeholder="Intención" />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="card-message">Mensaje</label>
          <RichTextEditor id="card-message" name="message" defaultValue={card.message} initialFormat="MD" maxLength={CARD_MESSAGE_MAX} tools="basic" rows={4} placeholder="Lo que dice la carta cuando sale." />
        </div>
        <div>
          <label className="field-label" htmlFor="card-question">Pregunta para quedarse pensando <span className="font-normal text-muted">(opcional)</span></label>
          <input id="card-question" name="question" className="input" maxLength={CARD_QUESTION_MAX} defaultValue={card.question} placeholder="¿Qué quieres empezar a cuidar?" />
        </div>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <div>
          <p className="field-label">Imagen <span className="font-normal text-muted">(opcional)</span></p>
          <div className="max-w-[14rem]">
            <ImageUpload value={image} onChange={setImage} label="Subir la carta" fit="contain" graphic />
          </div>
          <p className="field-hint">Mejor en vertical (como una carta). Sin imagen, la carta lleva un dibujo a trazo fino.</p>
        </div>
        {!image && (
          <div>
            <label className="field-label" htmlFor="card-motif">Dibujo</label>
            <select id="card-motif" name="motif" className="input h-10 text-sm" defaultValue={card.motif}>
              <option value="">Según su lugar en la baraja</option>
              {ORACLE_CARDS.map((c) => (
                <option key={c.id} value={c.id}>
                  El de «{c.name}»
                </option>
              ))}
            </select>
            <p className="field-hint">Los dibujos del Oráculo de la Luna: lunas, geometría sagrada y signos sencillos.</p>
          </div>
        )}
        {image && <input type="hidden" name="motif" value={card.motif} />}
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="reversible" checked={reversible} onChange={(e) => setReversible(e.target.checked)} className="mt-1 h-4 w-4" />
          <span>
            <span className="block font-medium">Puede salir invertida</span>
            <span className="text-xs text-muted">Al repartir, la mitad de las veces sale del revés y se lee su mensaje de invertida.</span>
          </span>
        </label>
        {reversible && (
          <div>
            <label className="field-label" htmlFor="card-reversed">Mensaje invertida <span className="font-normal text-muted">(sin él, el mensaje de siempre)</span></label>
            <RichTextEditor id="card-reversed" name="reversedMessage" defaultValue={card.reversedMessage} initialFormat="MD" maxLength={CARD_MESSAGE_MAX} tools="basic" rows={3} placeholder="Lo que dice cuando sale del revés." />
          </div>
        )}
      </section>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Guardando…" : card.id ? "Guardar carta" : "Añadir carta"}
      </button>
    </form>
  );
}
