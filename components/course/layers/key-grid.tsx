"use client";
import { useT, Tr } from "@/lib/i18n/client";

/**
 * Las 64 llaves (o puertas) en una cuadrícula de 8 × 8, para elegir una a la izquierda del modelo: la elegida en
 * oro y las de la alumna con el color de su secuencia (o en dorado). `tapKey` da los atributos para tocar cada una.
 */
export function KeyGrid({ selected, colorOf, tapKey, legend }: { selected: number; colorOf: (n: number) => string | null; tapKey: (n: number) => Record<string, unknown>; legend?: string }) {
  const t = useT();
  return (
    <div className="grid grid-cols-8 gap-1 p-1" role="group" aria-label={t("Las 64 llaves")}>
      {Array.from({ length: 64 }, (_, i) => i + 1).map((n) => {
        const on = n === selected;
        const c = colorOf(n);
        return (
          <button
            key={n}
            type="button"
            {...tapKey(n)}
            className="grid aspect-square place-items-center rounded-lg border text-[0.72rem] font-semibold tabular-nums transition"
            style={{
              background: on ? "linear-gradient(135deg, #F0D9A4, #C8A86E)" : c ? `${c}33` : "rgb(255 255 255 / .05)",
              borderColor: on ? "#F0D9A4" : c ? `${c}AA` : "rgb(255 255 255 / .12)",
              color: on ? "#0B0B0D" : "#FBF6EC",
              cursor: "pointer",
            }}
          >
            {n}
          </button>
        );
      })}
      {legend && (
        <p className="col-span-8 mt-1 text-center text-[0.65rem]" style={{ color: "rgb(251 246 236 / .6)" }}>
          <Tr s={legend} />
        </p>
      )}
    </div>
  );
}
