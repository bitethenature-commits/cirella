import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Traduce sus textos con Claude: le llega una lista y devuelve, para cada uno, en qué idioma está escrito y cómo
 * queda en alemán, inglés y español. Sin clave de la API (ANTHROPIC_API_KEY en el .env) no hace nada.
 */

export const translationEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

const MODEL = "claude-opus-5-5";

const SYSTEM = `Eres la traductora de la web de una astróloga y guía espiritual (astrología, Human Design, Gene Keys, ciclos de la luna, lecturas y sesiones, cursos y una comunidad de miembros). La web está en tres idiomas: alemán (el principal), inglés y español.

Te llega una lista JSON de textos que ella ha escrito para su web. Cada texto puede estar en alemán, inglés o español. Para cada uno:
- Di en qué idioma está escrito ("de", "en" o "es").
- Devuelve el texto en los tres idiomas. En su propio idioma, devuélvelo exactamente igual, sin corregir nada.

Cómo traducir:
- Natural y cálido, como lo escribiría ella; nada de traducción literal ni robótica. Mismo tono, misma longitud aproximada.
- Trata a la lectora de tú: "du" en alemán (con "dein", "dich"…), "tú" en español, "you" en inglés.
- Conserva intactos el formato y la estructura: Markdown, etiquetas HTML y sus atributos, saltos de línea, viñetas, emojis, mayúsculas de estilo, enlaces y direcciones web, correos y los huecos entre llaves como {n}, {nombre}, {titular} o {año} (no traduzcas lo que hay dentro de las llaves).
- Los nombres propios, de marcas y de métodos se quedan como se usan en cada idioma: "Human Design" y "Gene Keys" se quedan en inglés en los tres; los signos, planetas y casas, con su nombre habitual en cada idioma.
- Si un texto es solo un nombre, una marca o algo que no se traduce, devuélvelo igual en los tres.
- No añadas explicaciones, comillas ni notas.

Devuelve un objeto por cada texto recibido, con el mismo "id".`;

const resultSchema = z.object({
  items: z.array(z.object({ id: z.string(), lang: z.enum(["de", "en", "es"]), de: z.string(), en: z.string(), es: z.string() })),
});
export type TranslatedItem = z.infer<typeof resultSchema>["items"][number];

const JSON_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          lang: { type: "string", enum: ["de", "en", "es"] },
          de: { type: "string" },
          en: { type: "string" },
          es: { type: "string" },
        },
        required: ["id", "lang", "de", "en", "es"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

/** Traduce una tanda de textos. Lanza un error si la API falla o la respuesta no vale. */
export async function translateBatch(texts: { id: string; text: string }[]): Promise<TranslatedItem[]> {
  if (!texts.length) return [];
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    // Si la IA rechaza un texto por seguridad, otro modelo lo intenta en la misma llamada.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: JSON_SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(texts.map((t) => ({ id: t.id, text: t.text }))) }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("La IA no ha querido traducir estos textos.");
  if (message.stop_reason === "max_tokens") throw new Error("Los textos eran demasiado largos para una sola vez.");
  const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const parsed = resultSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("La respuesta de la IA no tenía la forma esperada.");
  return parsed.data.items;
}

/** Un mensaje corto y entendible para el panel cuando algo falla. */
export function translationError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "La clave de la API de Claude no es válida.";
  if (e instanceof Anthropic.RateLimitError) return "Demasiadas traducciones a la vez: se reintentará.";
  if (e instanceof Anthropic.APIError) return `La API de Claude ha fallado (${e.status ?? "sin respuesta"}).`;
  if (e instanceof Error) return e.message.slice(0, 200);
  return "Error desconocido";
}
