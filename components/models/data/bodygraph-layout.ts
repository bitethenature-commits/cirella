import type { CentreId } from './human-design'

/* -------------------------------------------------------------------------- *
 *  Layout fijo del BodyGraph. Generado con el editor visual.
 *
 *  Aquí no se calcula nada: cada polígono, cada número y cada trazo tiene sus
 *  coordenadas escritas. El componente solo pinta lo que hay en este archivo.
 *
 *  Corredores compartidos: donde varias puertas cuelgan de una misma línea —la
 *  integración 20 · 10 · 57 · 34, por ejemplo— los canales no van cada uno por
 *  su lado. Cada uno recorre el mismo tronco desde donde entra hasta donde sale,
 *  así que sus trazados coinciden y en pantalla se ve una sola línea con sus
 *  derivaciones, como en una carta impresa.
 *
 *  Orden de dibujo: mayor `z`, por encima. Ahí se decide qué línea cruza sobre
 *  cuál. Los canales de un mismo corredor comparten z.
 *
 *  Sistema: viewBox 0 0 540 940.
 * -------------------------------------------------------------------------- */

export interface Pt { x: number; y: number }

export const VIEWBOX = { w: 540, h: 940 }
export const CHANNEL_BAND = 11
export const GATE_FONT = 13

export interface CentreShape { id: CentreId; points: string; centroid: Pt }

export const CENTRE_SHAPES: CentreShape[] = [
  { id: 'head', points: '270,24 344,108 196,108', centroid: { x: 270, y: 80 } },
  { id: 'ajna', points: '196,132 344,132 270,216', centroid: { x: 270, y: 160 } },
  { id: 'throat', points: '202,244 338,244 338,380 202,380', centroid: { x: 270, y: 312 } },
  { id: 'g', points: '270,408 350,484 268,557 190,484', centroid: { x: 269.5, y: 483.25 } },
  { id: 'heart', points: '392,480 450,560 335,560', centroid: { x: 392.33, y: 533.33 } },
  { id: 'spleen', points: '58,596 58,736 170,666', centroid: { x: 95.33, y: 666 } },
  { id: 'sacral', points: '202,600 338,600 338,724 202,724', centroid: { x: 270, y: 662 } },
  { id: 'solar', points: '482,596 482,736 370,666', centroid: { x: 444.67, y: 666 } },
  { id: 'root', points: '202,784 338,784 338,908 202,908', centroid: { x: 270, y: 846 } },
]

export interface GateSlot {
  n: number
  centre: CentreId
  /** Dónde se escribe el número. */
  label: Pt
  /** Dónde toca el borde del chakra. */
  anchor: Pt
}

export const GATE_SLOTS: GateSlot[] = [
  { n: 64, centre: 'head', label: { x: 230, y: 95 }, anchor: { x: 230, y: 100 } },
  { n: 61, centre: 'head', label: { x: 270, y: 95 }, anchor: { x: 270, y: 100 } },
  { n: 63, centre: 'head', label: { x: 310, y: 95 }, anchor: { x: 310, y: 100 } },
  { n: 47, centre: 'ajna', label: { x: 230, y: 145 }, anchor: { x: 230, y: 135 } },
  { n: 24, centre: 'ajna', label: { x: 270, y: 145 }, anchor: { x: 270, y: 135 } },
  { n: 4, centre: 'ajna', label: { x: 310, y: 145 }, anchor: { x: 310, y: 135 } },
  { n: 17, centre: 'ajna', label: { x: 250, y: 175 }, anchor: { x: 251, y: 179 } },
  { n: 11, centre: 'ajna', label: { x: 290, y: 175 }, anchor: { x: 292, y: 180 } },
  { n: 43, centre: 'ajna', label: { x: 270, y: 198 }, anchor: { x: 270, y: 203 } },
  { n: 62, centre: 'throat', label: { x: 235, y: 260 }, anchor: { x: 238, y: 251 } },
  { n: 23, centre: 'throat', label: { x: 270, y: 260 }, anchor: { x: 270, y: 256 } },
  { n: 56, centre: 'throat', label: { x: 305, y: 260 }, anchor: { x: 302, y: 255 } },
  { n: 16, centre: 'throat', label: { x: 215, y: 290 }, anchor: { x: 210, y: 288 } },
  { n: 20, centre: 'throat', label: { x: 215, y: 330 }, anchor: { x: 215, y: 328 } },
  { n: 35, centre: 'throat', label: { x: 325, y: 290 }, anchor: { x: 325, y: 290 } },
  { n: 12, centre: 'throat', label: { x: 325, y: 315 }, anchor: { x: 324, y: 315 } },
  { n: 45, centre: 'throat', label: { x: 325, y: 340 }, anchor: { x: 326, y: 342 } },
  { n: 31, centre: 'throat', label: { x: 235, y: 365 }, anchor: { x: 240, y: 365 } },
  { n: 8, centre: 'throat', label: { x: 270, y: 365 }, anchor: { x: 271, y: 373 } },
  { n: 33, centre: 'throat', label: { x: 305, y: 365 }, anchor: { x: 300, y: 365 } },
  { n: 1, centre: 'g', label: { x: 270, y: 425 }, anchor: { x: 270, y: 427 } },
  { n: 7, centre: 'g', label: { x: 240, y: 455 }, anchor: { x: 240, y: 449 } },
  { n: 13, centre: 'g', label: { x: 300, y: 455 }, anchor: { x: 300, y: 446 } },
  { n: 10, centre: 'g', label: { x: 209, y: 484 }, anchor: { x: 210, y: 484 } },
  { n: 25, centre: 'g', label: { x: 331, y: 484 }, anchor: { x: 332, y: 485 } },
  { n: 15, centre: 'g', label: { x: 240, y: 511 }, anchor: { x: 240, y: 520 } },
  { n: 46, centre: 'g', label: { x: 300, y: 511 }, anchor: { x: 299, y: 521 } },
  { n: 2, centre: 'g', label: { x: 268, y: 540 }, anchor: { x: 268, y: 540 } },
  { n: 21, centre: 'heart', label: { x: 392, y: 502 }, anchor: { x: 393, y: 505 } },
  { n: 51, centre: 'heart', label: { x: 375, y: 525 }, anchor: { x: 379, y: 526 } },
  { n: 26, centre: 'heart', label: { x: 358, y: 548 }, anchor: { x: 350, y: 552 } },
  { n: 40, centre: 'heart', label: { x: 426, y: 548 }, anchor: { x: 423, y: 546 } },
  { n: 48, centre: 'spleen', label: { x: 70, y: 617 }, anchor: { x: 71, y: 618 } },
  { n: 57, centre: 'spleen', label: { x: 95, y: 633 }, anchor: { x: 95, y: 633 } },
  { n: 44, centre: 'spleen', label: { x: 120, y: 648 }, anchor: { x: 121, y: 648 } },
  { n: 50, centre: 'spleen', label: { x: 148, y: 666 }, anchor: { x: 149, y: 669 } },
  { n: 32, centre: 'spleen', label: { x: 120, y: 683 }, anchor: { x: 121, y: 683 } },
  { n: 28, centre: 'spleen', label: { x: 95, y: 699 }, anchor: { x: 95, y: 701 } },
  { n: 18, centre: 'spleen', label: { x: 70, y: 715 }, anchor: { x: 68, y: 715 } },
  { n: 5, centre: 'sacral', label: { x: 240, y: 612 }, anchor: { x: 240, y: 613 } },
  { n: 14, centre: 'sacral', label: { x: 270, y: 612 }, anchor: { x: 269, y: 614 } },
  { n: 29, centre: 'sacral', label: { x: 301, y: 613 }, anchor: { x: 300, y: 615 } },
  { n: 34, centre: 'sacral', label: { x: 215, y: 640 }, anchor: { x: 215, y: 640 } },
  { n: 59, centre: 'sacral', label: { x: 325, y: 660 }, anchor: { x: 325, y: 661 } },
  { n: 27, centre: 'sacral', label: { x: 215, y: 680 }, anchor: { x: 216, y: 679 } },
  { n: 42, centre: 'sacral', label: { x: 240, y: 712 }, anchor: { x: 239, y: 712 } },
  { n: 3, centre: 'sacral', label: { x: 270, y: 712 }, anchor: { x: 270, y: 711 } },
  { n: 9, centre: 'sacral', label: { x: 300, y: 712 }, anchor: { x: 299, y: 714 } },
  { n: 36, centre: 'solar', label: { x: 469, y: 619 }, anchor: { x: 471, y: 620 } },
  { n: 22, centre: 'solar', label: { x: 445, y: 635 }, anchor: { x: 446, y: 637 } },
  { n: 37, centre: 'solar', label: { x: 420, y: 650 }, anchor: { x: 420, y: 653 } },
  { n: 6, centre: 'solar', label: { x: 394, y: 666 }, anchor: { x: 393, y: 667 } },
  { n: 49, centre: 'solar', label: { x: 420, y: 683 }, anchor: { x: 422, y: 685 } },
  { n: 55, centre: 'solar', label: { x: 445, y: 697 }, anchor: { x: 446, y: 698 } },
  { n: 30, centre: 'solar', label: { x: 469, y: 713 }, anchor: { x: 470, y: 715 } },
  { n: 53, centre: 'root', label: { x: 240, y: 800 }, anchor: { x: 240, y: 791 } },
  { n: 60, centre: 'root', label: { x: 270, y: 800 }, anchor: { x: 270, y: 794 } },
  { n: 52, centre: 'root', label: { x: 300, y: 800 }, anchor: { x: 299, y: 796 } },
  { n: 54, centre: 'root', label: { x: 220, y: 830 }, anchor: { x: 219, y: 832 } },
  { n: 38, centre: 'root', label: { x: 220, y: 860 }, anchor: { x: 221, y: 861 } },
  { n: 58, centre: 'root', label: { x: 220, y: 890 }, anchor: { x: 222, y: 890 } },
  { n: 19, centre: 'root', label: { x: 320, y: 830 }, anchor: { x: 322, y: 830 } },
  { n: 39, centre: 'root', label: { x: 320, y: 860 }, anchor: { x: 321, y: 860 } },
  { n: 41, centre: 'root', label: { x: 320, y: 890 }, anchor: { x: 323, y: 891 } },
]

export const GATE_SLOT_BY_N = new Map(GATE_SLOTS.map((g) => [g.n, g]))

export interface ChannelPath {
  key: string
  a: number
  b: number
  /** Orden de dibujo: mayor z, por encima. */
  z?: number
  d: string
  halfA: string
  halfB: string
}

export const CHANNEL_PATHS: ChannelPath[] = [
  {
    key: '26-44', a: 26, b: 44, z: -46,
    d: 'M 350 552 Q 144 582 121 648',
    halfA: 'M 350 552 Q 275.05 562.92 224.33 578.6',
    halfB: 'M 224.33 578.6 Q 135.63 606.01 121 648',
  },
  {
    key: '47-64', a: 64, b: 47, z: 0,
    d: 'M 230 100 L 230 135',
    halfA: 'M 230 100 L 230 117.5',
    halfB: 'M 230 117.5 L 230 135',
  },
  {
    key: '24-61', a: 61, b: 24, z: 1,
    d: 'M 270 100 L 270 135',
    halfA: 'M 270 100 L 270 117.5',
    halfB: 'M 270 117.5 L 270 135',
  },
  {
    key: '4-63', a: 63, b: 4, z: 2,
    d: 'M 310 100 L 310 135',
    halfA: 'M 310 100 L 310 117.5',
    halfB: 'M 310 117.5 L 310 135',
  },
  {
    key: '17-62', a: 17, b: 62, z: 3,
    d: 'M 251 179 L 238 251',
    halfA: 'M 251 179 L 244.5 215',
    halfB: 'M 244.5 215 L 238 251',
  },
  {
    key: '23-43', a: 43, b: 23, z: 4,
    d: 'M 270 203 L 270 256',
    halfA: 'M 270 203 L 270 229.5',
    halfB: 'M 270 229.5 L 270 256',
  },
  {
    key: '11-56', a: 11, b: 56, z: 5,
    d: 'M 292 180 L 302 255',
    halfA: 'M 292 180 L 297 217.5',
    halfB: 'M 297 217.5 L 302 255',
  },
  {
    key: '7-31', a: 31, b: 7, z: 6,
    d: 'M 240 365 L 240 449',
    halfA: 'M 240 365 L 240 407',
    halfB: 'M 240 407 L 240 449',
  },
  {
    key: '1-8', a: 8, b: 1, z: 7,
    d: 'M 271 373 L 270 427',
    halfA: 'M 271 373 L 270.5 400',
    halfB: 'M 270.5 400 L 270 427',
  },
  {
    key: '13-33', a: 33, b: 13, z: 8,
    d: 'M 300 365 L 300 446',
    halfA: 'M 300 365 L 300 405.5',
    halfB: 'M 300 405.5 L 300 446',
  },
  {
    key: '42-53', a: 42, b: 53, z: 12,
    d: 'M 239 712 L 240 791',
    halfA: 'M 239 712 L 239.5 751.5',
    halfB: 'M 239.5 751.5 L 240 791',
  },
  {
    key: '3-60', a: 3, b: 60, z: 13,
    d: 'M 270 711 L 270 794',
    halfA: 'M 270 711 L 270 752.5',
    halfB: 'M 270 752.5 L 270 794',
  },
  {
    key: '9-52', a: 9, b: 52, z: 14,
    d: 'M 299 714 L 299 796',
    halfA: 'M 299 714 L 299 755',
    halfB: 'M 299 755 L 299 796',
  },
  {
    key: '21-45', a: 45, b: 21, z: 15,
    d: 'M 326 342 Q 455 379 393 505',
    halfA: 'M 326 342 Q 391.89 360.9 407.95 403.01',
    halfB: 'M 407.95 403.01 Q 423.33 443.36 393 505',
  },
  {
    key: '25-51', a: 25, b: 51, z: 16,
    d: 'M 332 485 Q 340 520 379 526',
    halfA: 'M 332 485 Q 336.13 503.05 348.49 513.39',
    halfB: 'M 348.49 513.39 Q 360.11 523.09 379 526',
  },
  {
    key: '37-40', a: 40, b: 37, z: 17,
    d: 'M 423 546 Q 405 594 420 653',
    halfA: 'M 423 546 Q 413.59 571.1 413.2 599.2',
    halfB: 'M 413.2 599.2 Q 412.84 624.85 420 653',
  },
  {
    key: '35-36', a: 35, b: 36, z: 18,
    d: 'M 325 290 Q 539 332 471 620',
    halfA: 'M 325 290 Q 445.3 313.61 476.49 414.96',
    halfB: 'M 476.49 414.96 Q 500.77 493.9 471 620',
  },
  {
    key: '12-22', a: 12, b: 22, z: 19,
    d: 'M 324 315 Q 501 340 446 637',
    halfA: 'M 324 315 Q 430.1 329.99 452.84 442.7',
    halfB: 'M 452.84 442.7 Q 468.03 518.03 446 637',
  },
  {
    key: '6-59', a: 59, b: 6, z: 20,
    d: 'M 325 661 Q 365 640 393 667',
    halfA: 'M 325 661 Q 343.99 651.03 360.27 651.88',
    halfB: 'M 360.27 651.88 Q 378.29 652.82 393 667',
  },
  {
    key: '19-49', a: 49, b: 19, z: 21,
    d: 'M 422 685 Q 444 850 322 830',
    halfA: 'M 422 685 Q 431.39 755.4 414.56 792.13',
    halfB: 'M 414.56 792.13 Q 391.94 841.47 322 830',
  },
  {
    key: '39-55', a: 55, b: 39, z: 22,
    d: 'M 446 698 Q 470 875 321 860',
    halfA: 'M 446 698 Q 456.97 778.89 431.81 819.68',
    halfB: 'M 431.81 819.68 Q 401.91 868.15 321 860',
  },
  {
    key: '30-41', a: 30, b: 41, z: 23,
    d: 'M 470 715 Q 500 900 323 891',
    halfA: 'M 470 715 Q 484.59 804.98 450.22 849.07',
    halfB: 'M 450.22 849.07 Q 413.91 895.62 323 891',
  },
  {
    key: '16-48', a: 16, b: 48, z: 24,
    d: 'M 210 288 Q 0 348 71 618',
    halfA: 'M 210 288 Q 94.76 320.93 64.14 417.1',
    halfB: 'M 64.14 417.1 Q 38.96 496.17 71 618',
  },
  {
    key: '27-50', a: 27, b: 50, z: 31,
    d: 'M 216 679 Q 175 695 149 669',
    halfA: 'M 216 679 Q 196.69 686.54 180.71 684.75',
    halfB: 'M 180.71 684.75 Q 162.75 682.75 149 669',
  },
  {
    key: '32-54', a: 32, b: 54, z: 33,
    d: 'M 121 683 Q 90 850 219 832',
    halfA: 'M 121 683 Q 107.6 755.18 124.09 792.81',
    halfB: 'M 124.09 792.81 Q 145.76 842.22 219 832',
  },
  {
    key: '28-38', a: 28, b: 38, z: 34,
    d: 'M 95 701 Q 60 875 221 861',
    halfA: 'M 95 701 Q 78.35 783.78 106.06 824',
    halfB: 'M 106.06 824 Q 136.59 868.34 221 861',
  },
  {
    key: '18-58', a: 18, b: 58, z: 35,
    d: 'M 68 715 Q 33 900 222 890',
    halfA: 'M 68 715 Q 50.45 807.74 89.2 851.47',
    halfB: 'M 89.2 851.47 Q 127.74 894.99 222 890',
  },
  {
    key: '29-46', a: 46, b: 29, z: 46,
    d: 'M 299 521 L 300 615',
    halfA: 'M 299 521 L 299.5 568',
    halfB: 'M 299.5 568 L 300 615',
  },
  {
    key: '2-14', a: 2, b: 14, z: 53,
    d: 'M 268 540 Q 270 570 269 614',
    halfA: 'M 268 540 Q 269.09 556.4 269.29 576.98',
    halfB: 'M 269.29 576.98 Q 269.45 594.05 269 614',
  },
  {
    key: '5-15', a: 15, b: 5, z: 62,
    d: 'M 240 520 Q 240 571.5 240 613',
    halfA: 'M 240 520 Q 240 544.37 240 566.5',
    halfB: 'M 240 566.5 Q 240 591.14 240 613',
  },
  {
    key: '20-57', a: 20, b: 57, z: 68,
    // recorre el tronco 20–57
    d: 'M 215 328 C 204.5 330.67 171.33 333 152 344 C 132.67 355 111.17 375.17 99 394 C 86.83 412.83 82.5 433.83 79 457 C 75.5 480.17 75.33 503.67 78 533 C 80.67 562.33 92.16 616.32 95 633',
    halfA: 'M 215 328 C 204.5 330.67 171.33 333 152 344 C 132.67 355 111.17 375.17 99 394 C 89.27 409.05 84.55 425.49 81.26 443.32',
    halfB: 'M 81.26 443.32 C 80.44 447.79 79.7 452.35 79 457 C 75.5 480.17 75.33 503.67 78 533 C 80.67 562.33 92.16 616.32 95 632.99',
  },
  {
    key: '10-20', a: 10, b: 20, z: 68,
    // recorre el tronco 20–57
    d: 'M 210 484 C 201.67 478.83 176.5 456 160 453 C 143.5 450 124.93 456.53 111 466 C 97.07 475.47 82.2 502.53 76.44 509.83 C 75.68 490.66 76.47 473.75 79 457 C 82.5 433.83 86.83 412.83 99 394 C 111.17 375.17 132.67 355 152 344 C 171.33 333 204.5 330.67 215 328',
    halfA: 'M 210 484 C 201.67 478.83 176.5 456 160 453 C 143.5 450 124.93 456.53 111 466 C 97.07 475.47 82.2 502.53 76.44 509.83 C 75.79 493.46 76.27 478.73 78 464.35',
    halfB: 'M 78 464.35 C 78.3 461.89 78.63 459.44 79 457 C 82.5 433.83 86.83 412.83 99 394 C 111.17 375.17 132.67 355 152 344 C 171.33 333 204.49 330.67 215 328',
  },
  {
    key: '10-34', a: 10, b: 34, z: 68,
    // recorre el tronco 20–57
    d: 'M 210 484 C 201.67 478.83 176.5 456 160 453 C 143.5 450 124.93 456.53 111 466 C 97.07 475.47 82.2 502.53 76.44 509.83 C 76.54 512.28 76.67 514.77 76.81 517.3 C 84.84 529.24 101.97 568.55 125 589 C 148.03 609.45 200 631.5 215 640',
    halfA: 'M 210 484 C 201.67 478.83 176.5 456 160 453 C 143.5 450 124.93 456.53 111 466 C 97.07 475.47 82.2 502.53 76.44 509.83 C 76.54 512.28 76.67 514.77 76.81 517.3 C 77.97 519.02 79.32 521.32 80.85 524.05',
    halfB: 'M 80.85 524.05 C 89.92 540.21 105.3 571.5 125 589 C 148.03 609.45 199.99 631.5 214.99 640',
  },
  {
    key: '20-34', a: 20, b: 34, z: 68,
    // recorre el tronco 20–57
    d: 'M 215 328 C 204.5 330.67 171.33 333 152 344 C 132.67 355 111.17 375.17 99 394 C 86.83 412.83 82.5 433.83 79 457 C 76.15 475.88 75.51 494.99 76.81 517.3 C 84.84 529.24 101.97 568.55 125 589 C 148.03 609.45 200 631.5 215 640',
    halfA: 'M 215 328 C 204.5 330.67 171.33 333 152 344 C 132.67 355 111.17 375.17 99 394 C 86.83 412.83 82.5 433.83 79 457 C 77.87 464.45 77.09 471.93 76.64 479.64',
    halfB: 'M 76.64 479.64 C 75.95 491.46 76.02 503.79 76.81 517.3 C 84.84 529.24 101.97 568.55 125 589 C 148.03 609.45 199.99 631.5 214.99 640',
  },
  {
    key: '10-57', a: 10, b: 57, z: 68,
    // recorre el tronco 20–57
    d: 'M 210 484 C 201.67 478.83 176.5 456 160 453 C 143.5 450 124.93 456.53 111 466 C 97.07 475.47 82.2 502.53 76.44 509.83 C 76.74 517.19 77.26 524.87 78 533 C 80.67 562.33 92.16 616.32 95 633',
    halfA: 'M 210 484 C 201.67 478.83 176.5 456 160 453 C 143.5 450 124.93 456.53 111 466 C 103.13 471.35 94.96 482.32 88.3 492.17',
    halfB: 'M 88.3 492.17 C 83.18 499.74 78.95 506.65 76.44 509.83 C 76.74 517.19 77.26 524.87 78 533 C 80.67 562.33 92.16 616.32 95 632.99',
  },
  {
    key: '34-57', a: 34, b: 57, z: 68,
    // recorre el tronco 20–57
    d: 'M 215 640 C 200 631.5 148.03 609.45 125 589 C 101.97 568.55 84.84 529.24 76.81 517.29 C 77.11 522.35 77.51 527.58 78 533 C 80.67 562.33 92.16 616.32 95 633',
    halfA: 'M 215 640 C 200 631.5 148.03 609.45 125 589 C 113.27 578.58 103.07 563.28 94.83 549.18',
    halfB: 'M 94.83 549.18 C 86.88 535.61 80.75 523.16 76.81 517.29 C 77.11 522.35 77.51 527.58 78 533 C 80.67 562.33 92.16 616.32 95 632.99',
  },
]

export const CHANNEL_PATH_BY_KEY = new Map(CHANNEL_PATHS.map((c) => [c.key, c]))
