import type { DictEntries } from "./types";

/**
 * Textos fijos que salían en español en la web en alemán o inglés (repaso de noviembre de 2026): los botones
 * «Escríbeme…», los textos de partida de «Lecturas y sesiones», las etiquetas de los tipos de producto, de los
 * bloques y de los modelos, y las etiquetas para lectores de pantalla.
 */
export const AUDIT: DictEntries = {
  // ── Botones de lo que se pide escribiendo ──
  "Escríbeme para pedirlo": { de: "Schreib mir, um es zu bestellen", en: "Write to me to order it" },
  "Escríbeme para reservar": { de: "Schreib mir, um zu buchen", en: "Write to me to book" },
  "Escríbeme y te apunto": { de: "Schreib mir und ich trage dich ein", en: "Write to me and I'll sign you up" },
  "Escríbeme para unirte": { de: "Schreib mir, um beizutreten", en: "Write to me to join" },
  Unirme: { de: "Beitreten", en: "Join" },
  "Unirme a {title}": { de: "{title} beitreten", en: "Join {title}" },

  // ── Tipos de producto ──
  "Producto digital": { de: "Digitales Produkt", en: "Digital product" },
  "PDF, ebook, audio, meditación, guía… acceso inmediato tras el pago": {
    de: "PDF, E-Book, Audio, Meditation, Leitfaden … sofortiger Zugang nach der Zahlung",
    en: "PDF, ebook, audio, meditation, guide… immediate access after payment",
  },
  "Lecturas y sesiones 1:1 con reserva de fecha y hora": { de: "Deutungen und 1:1-Sitzungen mit Termin und Uhrzeit", en: "Readings and 1:1 sessions with a booked date and time" },
  "Módulos y lecciones con vídeo, audio, PDF y progreso": { de: "Module und Lektionen mit Video, Audio, PDF und Fortschritt", en: "Modules and lessons with video, audio, PDF and progress" },
  "Contenido privado con suscripción mensual": { de: "Private Inhalte im Monatsabo", en: "Private content with a monthly subscription" },
  "Sesión 1:1": { de: "1:1-Sitzung", en: "1:1 session" },
  "Lecturas y sesiones": { de: "Deutungen und Sitzungen", en: "Readings and sessions" },

  // ── «Lecturas, sesiones y círculos»: textos de partida ──
  "Te la preparo yo": { de: "Ich bereite sie für dich vor", en: "I prepare it for you" },
  "Me das tus datos y te la envío por email, grabada o en PDF.": {
    de: "Du gibst mir deine Daten und ich schicke sie dir per E-Mail, als Aufnahme oder als PDF.",
    en: "You give me your details and I send it to you by email, recorded or as a PDF.",
  },
  "Elige la lectura que te llama.": { de: "Wähle die Deutung, die dich anspricht.", en: "Choose the reading that calls to you." },
  "Escríbeme desde su ficha: tu mensaje me llega a mí.": { de: "Schreib mir über ihre Seite: Deine Nachricht kommt direkt bei mir an.", en: "Write to me from its page: your message comes straight to me." },
  "Te respondo por email, me das tus datos y cerramos el pago.": { de: "Ich antworte dir per E-Mail, du gibst mir deine Daten und wir klären die Zahlung.", en: "I reply by email, you give me your details and we settle the payment." },
  "Te la preparo con calma y te la envío por email.": { de: "Ich bereite sie in Ruhe vor und schicke sie dir per E-Mail.", en: "I prepare it calmly and send it to you by email." },
  "En directo por Zoom": { de: "Live per Zoom", en: "Live on Zoom" },
  "Eliges día y hora y hablamos de tu carta.": { de: "Du wählst Tag und Uhrzeit und wir sprechen über dein Horoskop.", en: "You choose the day and time and we talk about your chart." },
  "Elige la sesión.": { de: "Wähle die Sitzung.", en: "Choose the session." },
  "Escríbeme y elige el día y la hora que te vayan bien.": { de: "Schreib mir und wähle den Tag und die Uhrzeit, die dir passen.", en: "Write to me and choose the day and time that suit you." },
  "Te respondo por email, cerramos el pago y te envío el enlace de Zoom.": { de: "Ich antworte dir per E-Mail, wir klären die Zahlung und ich schicke dir den Zoom-Link.", en: "I reply by email, we settle the payment and I send you the Zoom link." },
  "Nos vemos en directo por Zoom.": { de: "Wir sehen uns live per Zoom.", en: "See you live on Zoom." },
  "Círculos de la luna · sin ser miembro": { de: "Mondkreise · ohne Mitgliedschaft", en: "Moon circles · no membership needed" },
  "Los próximos círculos de la luna": { de: "Die nächsten Mondkreise", en: "The next moon circles" },
  "Los próximos círculos": { de: "Die nächsten Kreise", en: "The next circles" },
  "Te escribo de vez en cuando con lo que estoy preparando, lecturas y novedades. Sin spam.": {
    de: "Ich schreibe dir ab und zu, woran ich arbeite, mit Deutungen und Neuigkeiten. Kein Spam.",
    en: "I write to you now and then about what I'm preparing, readings and news. No spam.",
  },

  // ── Niveles de la comunidad ──
  "La más elegida": { de: "Am beliebtesten", en: "Most popular" },
  Tetraedro: { de: "Tetraeder", en: "Tetrahedron" },
  Cubo: { de: "Würfel", en: "Cube" },
  Octaedro: { de: "Oktaeder", en: "Octahedron" },
  Icosaedro: { de: "Ikosaeder", en: "Icosahedron" },
  Dodecaedro: { de: "Dodekaeder", en: "Dodecahedron" },

  // ── Bloques de las páginas ──
  Galería: { de: "Galerie", en: "Gallery" },
  "Foto y texto": { de: "Foto und Text", en: "Photo and text" },
  Trayectoria: { de: "Werdegang", en: "Journey" },
  "Enlaces en burbuja": { de: "Links als Blasen", en: "Bubble links" },
  "Próximos círculos de la luna": { de: "Nächste Mondkreise", en: "Upcoming moon circles" },
  Tarjeta: { de: "Karte", en: "Card" },
  "Sin burbuja": { de: "Ohne Blase", en: "No bubble" },
  "Panel dorado": { de: "Goldenes Feld", en: "Golden panel" },
  "Textos, imágenes, galerías y vídeos": { de: "Texte, Bilder, Galerien und Videos", en: "Text, images, galleries and videos" },

  // ── Modelos y geometría ──
  Eneagrama: { de: "Enneagramm", en: "Enneagram" },
  "Cubo de Metatrón": { de: "Metatrons Würfel", en: "Metatron's Cube" },
  Toro: { de: "Torus", en: "Torus" },
  "Bodygraph (Human Design)": { de: "Bodygraph (Human Design)", en: "Bodygraph (Human Design)" },
  "Gene Keys (perfil hologenético)": { de: "Gene Keys (hologenetisches Profil)", en: "Gene Keys (Hologenetic Profile)" },
  "Ciclo lunar y calendario": { de: "Mondzyklus und Kalender", en: "Lunar cycle and calendar" },
  "Tirada de runas": { de: "Runenlegung", en: "Rune reading" },
  "Una tirada de runas": { de: "Eine Runenlegung", en: "A rune reading" },
  "Filosofía · geometría sagrada": { de: "Philosophie · Heilige Geometrie", en: "Philosophy · sacred geometry" },
  "Frase con geometría sagrada": { de: "Satz mit Heiliger Geometrie", en: "Quote with sacred geometry" },
  "Kundalini: cuerpo sutil y 10 cuerpos": { de: "Kundalini: feinstofflicher Körper und 10 Körper", en: "Kundalini: subtle body and 10 bodies" },
  "Las dimensiones del ser (3D a 12D)": { de: "Die Dimensionen des Seins (3D bis 12D)", en: "The dimensions of being (3D to 12D)" },

  // ── Categorías de cursos ──
  Especiales: { de: "Specials", en: "Specials" },
  Especial: { de: "Spezial", en: "Special" },
  "De dónde viene": { de: "Woher es kommt", en: "Where it comes from" },

  // ── Estados (área y panel) ──
  "Pendiente de fecha": { de: "Termin offen", en: "Date pending" },
  Cancelada: { de: "Storniert", en: "Cancelled" },
  Completada: { de: "Abgeschlossen", en: "Completed" },
  Pagado: { de: "Bezahlt", en: "Paid" },
  Fallido: { de: "Fehlgeschlagen", en: "Failed" },
  Abandonado: { de: "Abgebrochen", en: "Abandoned" },
  Rechazada: { de: "Abgelehnt", en: "Rejected" },
  "Contracargo ganado": { de: "Rückbuchung gewonnen", en: "Chargeback won" },
  "Contracargo perdido": { de: "Rückbuchung verloren", en: "Chargeback lost" },

  // ── Etiquetas para lectores de pantalla ──
  "Días de {month}": { de: "Tage im {month}", en: "Days in {month}" },
  "hora libre": { de: "freie Zeit", en: "free time" },
  "horas libres": { de: "freie Zeiten", en: "free times" },
  "Elegir opinión": { de: "Bewertung wählen", en: "Choose a review" },
  "Información legal": { de: "Rechtliche Informationen", en: "Legal information" },
  "Responsable de la web": { de: "Verantwortlich für die Website", en: "Responsible for the website" },
  "Titular de la web y de las ventas": { de: "Inhaberin der Website und Verkäuferin", en: "Owner of the website and seller" },
  "1 novedad sin ver": { de: "1 ungesehene Neuigkeit", en: "1 unseen update" },
  "{n} novedades sin ver": { de: "{n} ungesehene Neuigkeiten", en: "{n} unseen updates" },
  "Ver foto {k} de {n}": { de: "Foto {k} von {n} ansehen", en: "View photo {k} of {n}" },
  "Ir a la foto {k}": { de: "Zu Foto {k}", en: "Go to photo {k}" },
  "Opinión {k} de {n}": { de: "Bewertung {k} von {n}", en: "Review {k} of {n}" },
  "Código de descuento de {brand}": { de: "Rabattcode von {brand}", en: "{brand} discount code" },
  "Copiado: {code}": { de: "Kopiert: {code}", en: "Copied: {code}" },
  "Copiar código {code}": { de: "Code {code} kopieren", en: "Copy code {code}" },
  "Código de descuento {code}": { de: "Rabattcode {code}", en: "Discount code {code}" },
};
