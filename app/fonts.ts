import { Bodoni_Moda, Cormorant_Garamond, DM_Sans, Fraunces, Instrument_Serif, Inter, Manrope, Noto_Sans_Runic, Syne } from "next/font/google";

// Fuente de interfaz + familias de las plantillas (solo se descargan las que una página usa).
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
export const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });
export const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-cormorant", display: "swap", preload: false });
export const fraunces = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-fraunces", display: "swap", preload: false });
export const bodoni = Bodoni_Moda({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-bodoni", display: "swap", preload: false });
export const syne = Syne({ subsets: ["latin"], variable: "--font-syne", display: "swap", preload: false });
export const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap", preload: false });
export const dmsans = DM_Sans({ subsets: ["latin"], variable: "--font-dmsans", display: "swap", preload: false });

// Glifos del futhark para la tirada de runas (components/models/runes-model.tsx): solo el tramo rúnico, y solo se descarga si se pinta una runa.
export const runic = Noto_Sans_Runic({ subsets: ["runic"], weight: "400", variable: "--font-runic", display: "swap", preload: false });

export const fontVariables = [inter, instrument, cormorant, fraunces, bodoni, syne, manrope, dmsans, runic].map((f) => f.variable).join(" ");
