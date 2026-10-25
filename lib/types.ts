export const PRODUCT_TYPES = ["DIGITAL", "SESSION", "COURSE", "MEMBERSHIP"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  DIGITAL: "Producto digital",
  SESSION: "Sesión",
  COURSE: "Curso",
  MEMBERSHIP: "Membresía",
};

export const PRODUCT_TYPE_HINT: Record<ProductType, string> = {
  DIGITAL: "PDF, ebook, audio, meditación, guía… acceso inmediato tras el pago",
  SESSION: "Lecturas y sesiones 1:1 con reserva de fecha y hora",
  COURSE: "Módulos y lecciones con vídeo, audio, PDF y progreso",
  MEMBERSHIP: "Contenido privado con suscripción mensual",
};

export const DEFAULT_CTA: Record<ProductType, string> = {
  DIGITAL: "Comprar",
  SESSION: "Reservar",
  COURSE: "Ver curso",
  MEMBERSHIP: "Unirme",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  PROCESSING: "Pago pendiente",
  PAID: "Pagado",
  FAILED: "Fallido",
  REFUNDED: "Reembolsado",
  ABANDONED: "Abandonado",
};

export const PAYOUT_STATUS_LABEL: Record<string, string> = {
  NONE: "Sin conectar",
  PENDING: "Pendiente",
  VERIFYING: "Verificando",
  ACTION_REQUIRED: "Falta algo",
  ACTIVE: "Activada",
  REJECTED: "Rechazada",
};

export const DISPUTE_STATUS_LABEL: Record<string, string> = {
  OPEN: "Contracargo abierto",
  WON: "Contracargo ganado",
  LOST: "Contracargo perdido",
};

export const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activa",
  PAST_DUE: "Pago pendiente",
  CANCELED: "Cancelada",
};

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  PENDING_SCHEDULE: "Pendiente de fecha",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
};

/**
 * Solo para Lesson.kind (copia de compatibilidad calculada desde las partes, ver lib/lesson-parts.ts).
 * La interfaz usa partView/partsLabel.
 */
export const LESSON_KINDS = ["VIDEO", "AUDIO", "PDF", "TEXT", "EXERCISE"] as const;
export type LessonKind = (typeof LESSON_KINDS)[number];
export const LESSON_KIND_LABEL: Record<LessonKind, string> = {
  VIDEO: "Vídeo",
  AUDIO: "Audio",
  PDF: "PDF",
  TEXT: "Lectura",
  EXERCISE: "Ejercicio",
};

/**
 * Eventos de métricas (AnalyticsEvent.type). Sin cookies: el visitante del día lo calcula el servidor.
 *   · PURCHASE y SIGNUP (inscripción gratis con email) solo los registra el servidor.
 *   · CODE_COPY / CODE_CLICK: «Copiar código» e «Ir a la tienda» de un código de descuento. El id del
 *     código viaja como `codeId` y se guarda en AnalyticsEvent.productId (el «objeto» del evento):
 *     esa columna no es una relación, y las métricas de productos solo miran ids de productos.
 */
export const EVENT_TYPES = [
  "PAGE_VIEW",
  "PRODUCT_VIEW",
  "PRODUCT_CLICK",
  "CHECKOUT_STARTED",
  "PURCHASE",
  "SIGNUP",
  "CODE_COPY",
  "CODE_CLICK",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Eventos que solo escribe el servidor: /api/track los rechaza. */
export const SERVER_ONLY_EVENT_TYPES = ["PURCHASE", "SIGNUP"] as const satisfies readonly EventType[];

/** Eventos que se refieren a un código de descuento (llevan `codeId`). */
export const CODE_EVENT_TYPES = ["CODE_COPY", "CODE_CLICK"] as const satisfies readonly EventType[];
export type CodeEventType = (typeof CODE_EVENT_TYPES)[number];

export function isCodeEvent(type: string): type is CodeEventType {
  return (CODE_EVENT_TYPES as readonly string[]).includes(type);
}

/** «1 lección», «3 lecciones». */
export function lessonsLabel(n: number): string {
  return `${n} ${n === 1 ? "lección" : "lecciones"}`;
}

/** Duración de un curso: «45 min», «1 h», «1,5 h» (coma decimal, como el resto de la web). */
export function formatCourseLength(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  return `${(Math.round(minutes / 6) / 10).toLocaleString("es-ES")} h`;
}
