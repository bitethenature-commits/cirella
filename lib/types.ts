export const PRODUCT_TYPES = ["DIGITAL", "SESSION", "COURSE", "MEMBERSHIP"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  DIGITAL: "Producto digital",
  SESSION: "Sesión / servicio",
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
  PAID: "Pagado",
  FAILED: "Fallido",
  REFUNDED: "Reembolsado",
  ABANDONED: "Abandonado",
};

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  PENDING_SCHEDULE: "Pendiente de fecha",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
};

export const LESSON_KINDS = ["VIDEO", "AUDIO", "PDF", "TEXT", "EXERCISE"] as const;
export type LessonKind = (typeof LESSON_KINDS)[number];
export const LESSON_KIND_LABEL: Record<LessonKind, string> = {
  VIDEO: "Vídeo",
  AUDIO: "Audio",
  PDF: "PDF",
  TEXT: "Lectura",
  EXERCISE: "Ejercicio",
};

export const EVENT_TYPES = [
  "PAGE_VIEW",
  "PRODUCT_VIEW",
  "PRODUCT_CLICK",
  "CHECKOUT_STARTED",
  "PURCHASE",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
