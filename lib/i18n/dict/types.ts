/** Una entrada del diccionario: el texto en alemán y en inglés (la clave es el español). */
export type DictEntry = { de: string; en: string };
export type DictEntries = Record<string, DictEntry>;
