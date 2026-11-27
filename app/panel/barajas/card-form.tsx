"use client";
import { startTransition, useActionState, useState } from "react";
import { ORACLE_CARDS } from "@/components/models/data/oracle";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Flash } from "@/components/ui/flash";
import { CardImageFramer } from "@/components/panel/card-image-framer";
import { CARD_KEYWORD_MAX, CARD_MESSAGE_MAX, CARD_NAME_MAX, CARD_QUESTION_MAX } from "@/lib/oracle-rules";
import { saveCard, type DeckActionState } from "./actions";
import { Tr, useT } from "@/lib/i18n/client";

export type EditableCard = {
  id: string | null;
  deckId: string;
  name: string;
  keyword: string;
  message: string;
  question: string;
  imageUrl: string | null;
  imageFrame: string | null;
  backImageUrl: string | null;
  backFrame: string | null;
  motif: string;
  reversible: boolean;
  reversedMessage: string;
};

/**
 * Una carta: nombre, palabra clave, mensaje (con formato), pregunta, imagen opcional (sin ella, un
 * motivo dibujado de la baraja de serie) y si puede salir invertida (con su mensaje de invertida).
 */
export function CardForm({ card }: { card: EditableCard }) {
  const t = useT();
  const [state, action, pending] = useActionState<DeckActionState, FormData>(saveCard, undefined);
  const [image, setImage] = useState(card.imageUrl);
  const [back, setBack] = useState(card.backImageUrl);
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
      <input type="hidden" name="backImageUrl" value={back ?? ""} />

      <section className="card space-y-4 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="card-name"><Tr s={"Nombre"} /></label>
            <input id="card-name" name="name" className="input" required maxLength={CARD_NAME_MAX} defaultValue={card.name} placeholder={t("La Luna Nueva")} />
          </div>
          <div>
            <label className="field-label" htmlFor="card-keyword"><Tr s={"Palabra clave"} /></label>
            <input id="card-keyword" name="keyword" className="input" maxLength={CARD_KEYWORD_MAX} defaultValue={card.keyword} placeholder={t("Intención")} />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="card-message"><Tr s={"Mensaje"} /></label>
          <RichTextEditor id="card-message" name="message" defaultValue={card.message} initialFormat="MD" maxLength={CARD_MESSAGE_MAX} tools="basic" rows={4} placeholder={t("Lo que dice la carta cuando sale.")} />
        </div>
        <div>
          <label className="field-label" htmlFor="card-question"><Tr s={"Pregunta para quedarse pensando"} />{" "}<span className="font-normal text-muted"><Tr s={"(opcional)"} /></span></label>
          <input id="card-question" name="question" className="input" maxLength={CARD_QUESTION_MAX} defaultValue={card.question} placeholder={t("¿Qué quieres empezar a cuidar?")} />
        </div>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold"><Tr s={"Las dos caras de la carta"} /></h3>
          <p className="text-xs text-muted"><Tr s={"Si ya tienes tu oráculo hecho, sube la foto o el escaneo de cada cara. Después ajústala a la carta: «Rellenar» la llena, «Entera» la enseña completa; arrastra para moverla y usa el zoom."} /></p>
        </div>
        <CardImageFramer
          label={<><Tr s={"Cara"} />{" "}<span className="font-normal text-muted"><Tr s={"(anverso, opcional)"} /></span></>}
          hint={t("Mejor en vertical (como una carta). Sin imagen, la carta lleva un dibujo a trazo fino.")}
          uploadLabel="Subir la cara"
          image={image}
          onImage={setImage}
          frame={card.imageFrame}
          frameName="imageFrame"
        />
        <CardImageFramer
          label={<><Tr s={"Reverso"} />{" "}<span className="font-normal text-muted"><Tr s={"(opcional)"} /></span></>}
          hint={t("El dorso de esta carta. Sin él, lleva el reverso de la baraja.")}
          uploadLabel="Subir el reverso"
          image={back}
          onImage={setBack}
          frame={card.backFrame}
          frameName="backFrame"
        />
        {!image && (
          <div>
            <label className="field-label" htmlFor="card-motif"><Tr s={"Dibujo"} /></label>
            <select id="card-motif" name="motif" className="input h-10 text-sm" defaultValue={card.motif}>
              <option value=""><Tr s={"Según su lugar en la baraja"} /></option>
              {ORACLE_CARDS.map((c) => (
                <option key={c.id} value={c.id}><Tr s={"El de «"} />{c.name}»
                </option>
              ))}
            </select>
            <p className="field-hint"><Tr s={"Los dibujos del Oráculo de la Luna: lunas, geometría sagrada y signos sencillos."} /></p>
          </div>
        )}
        {image && <input type="hidden" name="motif" value={card.motif} />}
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="reversible" checked={reversible} onChange={(e) => setReversible(e.target.checked)} className="mt-1 h-4 w-4" />
          <span>
            <span className="block font-medium"><Tr s={"Puede salir invertida"} /></span>
            <span className="text-xs text-muted"><Tr s={"Al repartir, la mitad de las veces sale del revés y se lee su mensaje de invertida."} /></span>
          </span>
        </label>
        {reversible && (
          <div>
            <label className="field-label" htmlFor="card-reversed"><Tr s={"Mensaje invertida"} />{" "}<span className="font-normal text-muted"><Tr s={"(sin él, el mensaje de siempre)"} /></span></label>
            <RichTextEditor id="card-reversed" name="reversedMessage" defaultValue={card.reversedMessage} initialFormat="MD" maxLength={CARD_MESSAGE_MAX} tools="basic" rows={3} placeholder={t("Lo que dice cuando sale del revés.")} />
          </div>
        )}
      </section>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? t("Guardando…") : card.id ? t("Guardar carta") : t("Añadir carta")}
      </button>
    </form>
  );
}
