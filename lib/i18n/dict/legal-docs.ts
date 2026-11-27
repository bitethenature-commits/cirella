import type { DictEntries } from "./types";

/**
 * Las plantillas de los textos legales (lib/legal-templates.ts) en alemán e inglés, línea a línea: cada apartado
 * («## »), viñeta («• ») y párrafo es una entrada. Los huecos: {nombre} (la dueña), {plataforma}, {horas} («24 h»),
 * {metodos} y {procesadores} (cómo se paga y quién cobra). Lo usa lib/i18n/legal-docs.ts.
 * BORRADOR, como el español: que lo revise una asesoría antes de publicarlo en alemán o en inglés.
 */
export const LEGAL_DOCS: DictEntries = {
  // ── Apartados ──
  "Qué datos": { de: "Welche Daten", en: "What data" },
  "Para qué y con qué base": { de: "Wofür und auf welcher Rechtsgrundlage", en: "What for and on what legal basis" },
  "Pagos en otras webs": { de: "Zahlungen auf anderen Websites", en: "Payments on other websites" },
  "Proveedores": { de: "Dienstleister", en: "Providers" },
  "Cuánto tiempo": { de: "Wie lange", en: "How long" },
  "Tus derechos": { de: "Deine Rechte", en: "Your rights" },
  "Responsable": { de: "Verantwortliche", en: "Controller" },
  "Quién más trata tus datos": { de: "Wer deine Daten außerdem verarbeitet", en: "Who else processes your data" },
  "Pagos": { de: "Zahlungen", en: "Payments" },
  "Enlaces y códigos de descuento": { de: "Links und Rabattcodes", en: "Links and discount codes" },
  "Productos de pago": { de: "Kostenpflichtige Produkte", en: "Paid products" },
  "Productos que se compran en otra web": { de: "Produkte, die auf einer anderen Website gekauft werden", en: "Products bought on another website" },
  "1. Quién vende": { de: "1. Wer verkauft", en: "1. Who sells" },
  "2. Productos y precios": { de: "2. Produkte und Preise", en: "2. Products and prices" },
  "3. Cómo se compra": { de: "3. Wie gekauft wird", en: "3. How to buy" },
  "4. Pago": { de: "4. Zahlung", en: "4. Payment" },
  "5. Entrega": { de: "5. Lieferung", en: "5. Delivery" },
  "6. Desistimiento, cambios y reembolsos": { de: "6. Widerruf, Umtausch und Rückerstattung", en: "6. Withdrawal, exchanges and refunds" },
  "7. Atención y reclamaciones": { de: "7. Kundenservice und Beschwerden", en: "7. Customer service and complaints" },
  "8. Ley aplicable": { de: "8. Anwendbares Recht", en: "8. Applicable law" },
  "Tu derecho de desistimiento": { de: "Dein Widerrufsrecht", en: "Your right of withdrawal" },
  "Contenido digital, cursos y lo que se prepara para ti": { de: "Digitale Inhalte, Kurse und was für dich vorbereitet wird", en: "Digital content, courses and things prepared for you" },
  "Sesiones en directo": { de: "Live-Sitzungen", en: "Live sessions" },
  "Talleres con fecha fija": { de: "Workshops mit festem Termin", en: "Workshops with a fixed date" },
  "Membresías": { de: "Mitgliedschaften", en: "Memberships" },
  "Cambios de fecha": { de: "Terminänderungen", en: "Date changes" },
  "Cancelar una membresía": { de: "Eine Mitgliedschaft kündigen", en: "Cancelling a membership" },
  "Cómo desistir": { de: "So widerrufst du", en: "How to withdraw" },
  "Reembolsos": { de: "Rückerstattungen", en: "Refunds" },

  // ── Privacidad de la web personal (sin cobros) ──
  "Tu nombre y tu email cuando te apuntas a un contenido gratuito o cuando {nombre} te da acceso a algo que compraste en otra web, los contenidos a los que tienes acceso, tu progreso en los cursos y los mensajes que envíes. Si los guardas en «Mi energía», los datos de nacimiento (nombre, fecha, hora y lugar) tuyos y de las personas que añadas.": {
    de: "Dein Name und deine E-Mail-Adresse, wenn du dich für einen kostenlosen Inhalt anmeldest oder wenn {nombre} dir Zugang zu etwas gibt, das du auf einer anderen Website gekauft hast, die Inhalte, auf die du Zugriff hast, dein Fortschritt in den Kursen und die Nachrichten, die du sendest. Wenn du sie in „Meine Energie“ speicherst, die Geburtsdaten (Name, Datum, Uhrzeit und Ort) von dir und von den Personen, die du hinzufügst.",
    en: "Your name and email when you sign up for free content or when {nombre} gives you access to something you bought on another website, the content you have access to, your progress in the courses and the messages you send. If you save them in “My energy”, the birth details (name, date, time and place) for you and for the people you add.",
  },
  "Darte acceso al contenido que pides y enviarte el enlace para entrar: ejecución de lo que solicitas.": {
    de: "Dir Zugang zu den Inhalten geben, die du anforderst, und dir den Link zum Anmelden schicken: Erfüllung deiner Anfrage.",
    en: "Giving you access to the content you request and sending you the link to sign in: carrying out what you ask for.",
  },
  "Calcular cartas con los datos de nacimiento que guardas en «Mi energía»: consentimiento, que das al marcar la casilla al guardarlos (si son de otra persona, confirmas que tienes su permiso). Solo los ves tú; puedes borrarlos cuando quieras desde tu área y se borran del todo.": {
    de: "Horoskope mit den Geburtsdaten berechnen, die du in „Meine Energie“ speicherst: Einwilligung, die du gibst, wenn du beim Speichern das Kästchen ankreuzt (sind es die Daten einer anderen Person, bestätigst du, dass du ihre Erlaubnis hast). Nur du siehst sie; du kannst sie jederzeit in deinem Bereich löschen, und sie werden vollständig gelöscht.",
    en: "Calculating charts with the birth details you save in “My energy”: consent, which you give by ticking the box when saving them (if they belong to someone else, you confirm you have their permission). Only you can see them; you can delete them whenever you like from your area and they are deleted completely.",
  },
  "Enviarte novedades, solo si marcas la casilla: consentimiento. Puedes retirarlo cuando quieras desde el enlace de cada email o desde tu cuenta.": {
    de: "Dir Neuigkeiten schicken, nur wenn du das Kästchen ankreuzt: Einwilligung. Du kannst sie jederzeit über den Link in jeder E-Mail oder in deinem Konto widerrufen.",
    en: "Sending you news, only if you tick the box: consent. You can withdraw it whenever you like via the link in each email or from your account.",
  },
  "Contar las visitas de la página de forma agregada y anónima, sin cookies: interés legítimo.": {
    de: "Die Besuche der Seite zusammengefasst und anonym zählen, ohne Cookies: berechtigtes Interesse.",
    en: "Counting visits to the page in aggregate and anonymously, without cookies: legitimate interest.",
  },
  "Aquí no se cobra nada ni se guardan datos de tarjetas. Lo que es de pago se compra en la web que indica cada producto (por ejemplo Hotmart, PayPal o Calendly), que trata tus datos de pago como responsable independiente, con su propia política de privacidad.": {
    de: "Hier wird nichts berechnet und es werden keine Kartendaten gespeichert. Kostenpflichtiges kaufst du auf der Website, die beim jeweiligen Produkt angegeben ist (zum Beispiel Hotmart, PayPal oder Calendly); sie verarbeitet deine Zahlungsdaten als eigenständige Verantwortliche nach ihrer eigenen Datenschutzerklärung.",
    en: "Nothing is charged here and no card details are stored. Paid products are bought on the website shown for each product (for example Hotmart, PayPal or Calendly), which processes your payment details as an independent controller, under its own privacy policy.",
  },
  "Para alojar la web, guardar los archivos y enviar los emails se usan proveedores tecnológicos que tratan los datos solo por encargo y con las garantías del Reglamento General de Protección de Datos.": {
    de: "Für das Hosting der Website, die Speicherung der Dateien und den Versand der E-Mails werden technische Dienstleister eingesetzt, die die Daten nur im Auftrag und mit den Garantien der Datenschutz-Grundverordnung verarbeiten.",
    en: "To host the website, store the files and send the emails, technology providers are used that process the data only on our behalf and with the safeguards of the General Data Protection Regulation.",
  },
  "Mientras mantengas el acceso a los contenidos o hasta que pidas que se borren tus datos. Los de las novedades, hasta que retires tu consentimiento. Los datos de nacimiento guardados, hasta que los borres.": {
    de: "Solange du Zugang zu den Inhalten hast oder bis du die Löschung deiner Daten verlangst. Die für die Neuigkeiten, bis du deine Einwilligung widerrufst. Die gespeicherten Geburtsdaten, bis du sie löschst.",
    en: "For as long as you keep access to the content or until you ask for your data to be deleted. Data for news, until you withdraw your consent. Saved birth details, until you delete them.",
  },
  "Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación y la portabilidad de tus datos escribiendo al email del aviso legal. También puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).": {
    de: "Du kannst Auskunft, Berichtigung, Löschung, Widerspruch, Einschränkung und Übertragbarkeit deiner Daten verlangen, indem du an die E-Mail-Adresse im Impressum schreibst. Du kannst dich auch bei der spanischen Datenschutzbehörde beschweren (Agencia Española de Protección de Datos, www.aepd.es).",
    en: "You can request access to, rectification, erasure, objection to, restriction and portability of your data by writing to the email in the legal notice. You can also complain to the Spanish Data Protection Agency (www.aepd.es).",
  },

  // ── Otras webs (página legal de la web personal) ──
  "Los enlaces y los códigos de descuento de otras marcas llevan a webs que no son de esta página: cada una tiene sus propias condiciones y su propia política de privacidad. Algunos pueden ser enlaces de afiliación: si compras con ellos, puede que se reciba una comisión, sin que te cueste nada más.": {
    de: "Die Links und Rabattcodes anderer Marken führen zu Websites, die nicht zu dieser Seite gehören: Jede hat ihre eigenen Bedingungen und ihre eigene Datenschutzerklärung. Manche können Affiliate-Links sein: Wenn du über sie kaufst, kann eine Provision gezahlt werden, ohne dass es dich mehr kostet.",
    en: "Links and discount codes from other brands lead to websites that are not part of this page: each has its own terms and its own privacy policy. Some may be affiliate links: if you buy through them, a commission may be received, at no extra cost to you.",
  },
  "Los productos de pago se compran en la web que indica su ficha (por ejemplo Hotmart, PayPal o Calendly). Las condiciones de venta, los pagos, y los reembolsos son los de esa compra.": {
    de: "Kostenpflichtige Produkte kaufst du auf der Website, die auf ihrer Produktseite angegeben ist (zum Beispiel Hotmart, PayPal oder Calendly). Es gelten die Verkaufsbedingungen, Zahlungs- und Erstattungsregeln dieses Kaufs.",
    en: "Paid products are bought on the website shown on their product page (for example Hotmart, PayPal or Calendly). The terms of sale, payments and refunds are those of that purchase.",
  },
  "Si la ficha de un producto lleva a otra web para pagar o reservar (por ejemplo Calendly), las condiciones de venta, los pagos, y los reembolsos de esa compra son los de esa web.": {
    de: "Wenn die Produktseite zum Bezahlen oder Buchen auf eine andere Website führt (zum Beispiel Calendly), gelten für diesen Kauf die Verkaufsbedingungen, Zahlungs- und Erstattungsregeln dieser Website.",
    en: "If a product page leads to another website to pay or book (for example Calendly), the terms of sale, payments and refunds of that purchase are those of that website.",
  },

  // ── Condiciones de venta ──
  "Estas condiciones regulan las compras en la página de {nombre}. La vendedora es la titular identificada en el aviso legal. {plataforma} solo presta la tecnología de la página y de los pagos; no es parte del contrato.": {
    de: "Diese Bedingungen regeln die Käufe auf der Seite von {nombre}. Verkäuferin ist die im Impressum genannte Inhaberin. {plataforma} stellt nur die Technik der Seite und der Zahlungen bereit und ist nicht Vertragspartei.",
    en: "These terms govern purchases on {nombre}'s page. The seller is the owner identified in the legal notice. {plataforma} only provides the technology for the page and the payments; it is not a party to the contract.",
  },
  "Estas condiciones regulan las compras en la web de {nombre}. La vendedora es la titular identificada en el aviso legal.": {
    de: "Diese Bedingungen regeln die Käufe auf der Website von {nombre}. Verkäuferin ist die im Impressum genannte Inhaberin.",
    en: "These terms govern purchases on {nombre}'s website. The seller is the owner identified in the legal notice.",
  },
  "Cada ficha describe qué incluye el producto. Los precios se muestran en euros y son el precio final.": {
    de: "Jede Produktseite beschreibt, was das Produkt enthält. Die Preise werden in Euro angezeigt und sind Endpreise.",
    en: "Each product page describes what the product includes. Prices are shown in euros and are final prices.",
  },
  "Cada ficha describe qué incluye el producto. Los precios se muestran en euros y son el precio final, el mismo que aparece en el resumen de la compra.": {
    de: "Jede Produktseite beschreibt, was das Produkt enthält. Die Preise werden in Euro angezeigt und sind Endpreise, dieselben wie in der Kaufübersicht.",
    en: "Each product page describes what the product includes. Prices are shown in euros and are final prices, the same as in the purchase summary.",
  },
  "El contrato se perfecciona cuando se confirma el pago. Recibirás por email la confirmación con estas condiciones.": {
    de: "Der Vertrag kommt zustande, sobald die Zahlung bestätigt ist. Du erhältst per E-Mail die Bestätigung mit diesen Bedingungen.",
    en: "The contract is concluded when payment is confirmed. You will receive the confirmation with these terms by email.",
  },
  "Tarjeta, Apple Pay o Google Pay a través de una pasarela segura. Ni la vendedora ni {plataforma} guardan los datos de tu tarjeta.": {
    de: "Karte, Apple Pay oder Google Pay über einen sicheren Zahlungsdienst. Weder die Verkäuferin noch {plataforma} speichern deine Kartendaten.",
    en: "Card, Apple Pay or Google Pay through a secure payment gateway. Neither the seller nor {plataforma} stores your card details.",
  },
  "Se paga {metodos}, en sus páginas seguras. En esta web no se guardan los datos de tu tarjeta ni de tu cuenta de PayPal. Las membresías se renuevan con el mismo medio de pago con el que te uniste.": {
    de: "Bezahlt wird {metodos}, auf deren sicheren Seiten. Auf dieser Website werden weder deine Kartendaten noch die Daten deines PayPal-Kontos gespeichert. Mitgliedschaften werden mit derselben Zahlungsart verlängert, mit der du beigetreten bist.",
    en: "Payment is made {metodos}, on their secure pages. This website does not store your card details or your PayPal account details. Memberships renew with the same payment method you joined with.",
  },
  "con tarjeta (también Apple Pay y Google Pay) a través de Stripe": { de: "per Karte (auch Apple Pay und Google Pay) über Stripe", en: "by card (also Apple Pay and Google Pay) through Stripe" },
  "con PayPal": { de: "mit PayPal", en: "with PayPal" },
  "con tarjeta (también Apple Pay y Google Pay) a través de Stripe o con PayPal": { de: "per Karte (auch Apple Pay und Google Pay) über Stripe oder mit PayPal", en: "by card (also Apple Pay and Google Pay) through Stripe or with PayPal" },
  "con los medios de pago que se indican al comprar": { de: "mit den beim Kauf angegebenen Zahlungsarten", en: "with the payment methods shown at checkout" },
  "Productos digitales: acceso inmediato en tu área de cliente.": { de: "Digitale Produkte: sofortiger Zugang in deinem Kundenbereich.", en: "Digital products: immediate access in your customer area." },
  "Productos que la vendedora prepara para ti: se empiezan a preparar en cuanto pagas y te llegan en el plazo y por el medio indicados en la ficha.": {
    de: "Produkte, die die Verkäuferin für dich vorbereitet: Die Vorbereitung beginnt, sobald du bezahlst, und du erhältst sie in der Frist und auf dem Weg, die auf der Produktseite angegeben sind.",
    en: "Products the seller prepares for you: preparation starts as soon as you pay and they reach you within the time and by the means stated on the product page.",
  },
  "Cursos: acceso de por vida mientras el curso exista.": { de: "Kurse: lebenslanger Zugang, solange der Kurs besteht.", en: "Courses: lifetime access for as long as the course exists." },
  "Sesiones: por videollamada en la fecha reservada, siempre a partir del día 15 desde la compra.": {
    de: "Sitzungen: per Videoanruf am gebuchten Termin, immer ab dem 15. Tag nach dem Kauf.",
    en: "Sessions: by video call on the booked date, always from day 15 after purchase.",
  },
  "Talleres: por videollamada en la fecha fija indicada en la ficha. Al tener una fecha de realización determinada, no admiten desistimiento (ver «Cambios y reembolsos»).": {
    de: "Workshops: per Videoanruf an dem festen Termin, der auf der Produktseite steht. Da sie an einem bestimmten Termin stattfinden, besteht kein Widerrufsrecht (siehe „Umtausch und Rückerstattung“).",
    en: "Workshops: by video call on the fixed date stated on the product page. As they take place on a specific date, they cannot be withdrawn from (see “Exchanges and refunds”).",
  },
  "Membresías: empiezas en cuanto pagas, se renuevan automáticamente y puedes cancelarlas desde tu cuenta; mantienes el acceso hasta el final del periodo pagado. Si desistes en los 14 días siguientes al primer pago, te devolvemos la parte proporcional de los días que no hayas disfrutado.": {
    de: "Mitgliedschaften: Sie beginnen, sobald du bezahlst, verlängern sich automatisch und du kannst sie in deinem Konto kündigen; du behältst den Zugang bis zum Ende des bezahlten Zeitraums. Widerrufst du innerhalb von 14 Tagen nach der ersten Zahlung, erstatten wir dir den anteiligen Betrag für die Tage, die du nicht genutzt hast.",
    en: "Memberships: they start as soon as you pay, renew automatically and you can cancel them from your account; you keep access until the end of the paid period. If you withdraw within 14 days of the first payment, we refund the proportional part for the days you have not used.",
  },
  "Consulta la sección «Cambios y reembolsos».": { de: "Siehe den Abschnitt „Umtausch und Rückerstattung“.", en: "See the “Exchanges and refunds” section." },
  "Escribe al email del aviso legal. Responderemos en un máximo de 30 días.": {
    de: "Schreib an die E-Mail-Adresse im Impressum. Wir antworten innerhalb von höchstens 30 Tagen.",
    en: "Write to the email in the legal notice. We will reply within 30 days at most.",
  },
  "Ley española. Si eres consumidora, puedes acudir a los tribunales de tu domicilio.": {
    de: "Es gilt spanisches Recht. Als Verbraucherin kannst du dich an die Gerichte an deinem Wohnsitz wenden.",
    en: "Spanish law applies. If you are a consumer, you can go to the courts of your place of residence.",
  },
  "Si eres consumidora, conservas siempre la protección que te dan las leyes de tu país de residencia y puedes reclamar ante los tribunales de tu domicilio.": {
    de: "Als Verbraucherin behältst du immer den Schutz, den dir die Gesetze deines Wohnsitzlandes geben, und kannst vor den Gerichten an deinem Wohnsitz klagen.",
    en: "If you are a consumer, you always keep the protection given to you by the laws of your country of residence and can bring a claim before the courts of your place of residence.",
  },

  // ── Cambios y reembolsos ──
  "Tienes 14 días naturales para desistir sin dar explicaciones. El día de la compra no cuenta: el plazo empieza al día siguiente y termina a las 23:59 del día 14 (hora de la vendedora).": {
    de: "Du hast 14 Kalendertage Zeit, ohne Angabe von Gründen zu widerrufen. Der Tag des Kaufs zählt nicht: Die Frist beginnt am folgenden Tag und endet am 14. Tag um 23:59 Uhr (Zeit der Verkäuferin).",
    en: "You have 14 calendar days to withdraw without giving any reason. The day of purchase does not count: the period starts the next day and ends at 23:59 on day 14 (the seller's time).",
  },
  "Para comprarlos tienes que pedir el acceso inmediato (o, si la vendedora lo prepara para ti, que se empiece a preparar ya) y aceptar expresamente que con ello pierdes tu derecho de desistimiento (art. 103.m del texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios). Sin esa casilla no se puede pagar y, una vez pagados, no se puede desistir. En el email de la compra te confirmamos lo que aceptaste, con la fecha y el texto exacto.": {
    de: "Um sie zu kaufen, musst du den sofortigen Zugang verlangen (oder, wenn die Verkäuferin etwas für dich vorbereitet, dass sofort damit begonnen wird) und ausdrücklich zustimmen, dass du damit dein Widerrufsrecht verlierst (Art. 103 Buchst. m des spanischen Verbraucherschutzgesetzes, Texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios). Ohne dieses Kästchen kannst du nicht bezahlen, und nach der Zahlung ist kein Widerruf mehr möglich. In der Kauf-E-Mail bestätigen wir dir, was du akzeptiert hast, mit Datum und genauem Wortlaut.",
    en: "To buy them you must request immediate access (or, if the seller prepares it for you, that preparation starts straight away) and expressly accept that you thereby lose your right of withdrawal (art. 103.m of the consolidated text of the Spanish General Law for the Defence of Consumers and Users). Without that box you cannot pay and, once paid, you cannot withdraw. In the purchase email we confirm what you accepted, with the date and the exact text.",
  },
  "Las sesiones que se pagan en esta web se reservan a partir del día 15 desde la compra: así nunca caen dentro de tus 14 días para desistir. La regla es la misma si eliges la fecha después de pagar, si la cambias o si la vendedora te propone otra (siempre contando desde el día en que pagaste). Durante esos 14 días puedes desistir desde tu área de cliente: te devolvemos el importe completo y se cancela la reserva. Las sesiones que la vendedora te da a mano (de regalo o pagadas por otra vía) no siguen esta regla.": {
    de: "Sitzungen, die auf dieser Website bezahlt werden, werden ab dem 15. Tag nach dem Kauf gebucht: So fallen sie nie in deine 14 Tage zum Widerrufen. Die Regel gilt auch, wenn du den Termin nach der Zahlung wählst, ihn änderst oder die Verkäuferin dir einen anderen vorschlägt (immer ab dem Tag gerechnet, an dem du bezahlt hast). In diesen 14 Tagen kannst du in deinem Kundenbereich widerrufen: Wir erstatten dir den vollen Betrag und die Buchung wird storniert. Sitzungen, die dir die Verkäuferin von Hand gibt (als Geschenk oder auf anderem Weg bezahlt), folgen dieser Regel nicht.",
    en: "Sessions paid for on this website are booked from day 15 after purchase: that way they never fall within your 14 days to withdraw. The rule is the same if you choose the date after paying, change it, or the seller suggests another one (always counting from the day you paid). During those 14 days you can withdraw from your customer area: we refund the full amount and the booking is cancelled. Sessions the seller gives you manually (as a gift or paid another way) do not follow this rule.",
  },
  "Los talleres son actividades de esparcimiento con una fecha de realización determinada: no tienen derecho de desistimiento, queden los días que queden hasta el taller (art. 103 l) del texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios). Te lo indicamos en la ficha y en el pago, y para comprarlo marcas una casilla que lo confirma; en el email de la compra te confirmamos lo que marcaste, con la fecha y el texto exacto.": {
    de: "Workshops sind Freizeitaktivitäten mit einem bestimmten Termin: Für sie besteht kein Widerrufsrecht, egal wie viele Tage es noch bis zum Workshop sind (Art. 103 Buchst. l des spanischen Verbraucherschutzgesetzes). Wir weisen dich auf der Produktseite und bei der Zahlung darauf hin, und zum Kauf kreuzt du ein Kästchen an, das dies bestätigt; in der Kauf-E-Mail bestätigen wir dir, was du angekreuzt hast, mit Datum und genauem Wortlaut.",
    en: "Workshops are leisure activities with a specific date: there is no right of withdrawal, however many days are left until the workshop (art. 103 l) of the consolidated text of the Spanish General Law for the Defence of Consumers and Users). We tell you on the product page and at payment, and to buy it you tick a box confirming this; in the purchase email we confirm what you ticked, with the date and the exact text.",
  },
  "Al unirte pides expresamente empezar en cuanto pagas, dentro del plazo de desistimiento. Aun así, durante los 14 días siguientes al primer pago puedes desistir desde tu área de cliente: te devolvemos la parte proporcional de los días que no hayas disfrutado (importe pagado × días sin disfrutar ÷ días del periodo pagado, redondeado al céntimo hacia abajo; el día en que empezaste y el día en que desistes cuentan como disfrutados) y la membresía termina en ese momento (art. 108.3). Las renovaciones no dan un nuevo plazo de desistimiento.": {
    de: "Mit dem Beitritt verlangst du ausdrücklich, dass die Mitgliedschaft beginnt, sobald du bezahlst, also innerhalb der Widerrufsfrist. Trotzdem kannst du in den 14 Tagen nach der ersten Zahlung in deinem Kundenbereich widerrufen: Wir erstatten dir den anteiligen Betrag für die nicht genutzten Tage (gezahlter Betrag × nicht genutzte Tage ÷ Tage des bezahlten Zeitraums, auf den Cent abgerundet; der Tag des Beginns und der Tag des Widerrufs zählen als genutzt), und die Mitgliedschaft endet in diesem Moment (Art. 108.3). Verlängerungen eröffnen keine neue Widerrufsfrist.",
    en: "When you join you expressly ask to start as soon as you pay, within the withdrawal period. Even so, during the 14 days after the first payment you can withdraw from your customer area: we refund the proportional part for the days you have not used (amount paid × unused days ÷ days in the paid period, rounded down to the cent; the day you started and the day you withdraw count as used) and the membership ends at that moment (art. 108.3). Renewals do not give a new withdrawal period.",
  },
  "Cambios gratis hasta {horas} antes desde tu área de cliente. Con menos antelación, escribe a la vendedora.": {
    de: "Kostenlose Änderungen bis {horas} vorher in deinem Kundenbereich. Bei kürzerer Frist schreib der Verkäuferin.",
    en: "Free changes up to {horas} before, from your customer area. With less notice, write to the seller.",
  },
  "Puedes cancelarla cuando quieras desde tu área de cliente. No se renovará y mantienes el acceso hasta el final del periodo pagado (cancelar no es desistir: no hay reembolso del periodo en curso).": {
    de: "Du kannst sie jederzeit in deinem Kundenbereich kündigen. Sie verlängert sich dann nicht, und du behältst den Zugang bis zum Ende des bezahlten Zeitraums (Kündigen ist kein Widerruf: Der laufende Zeitraum wird nicht erstattet).",
    en: "You can cancel it whenever you like from your customer area. It will not renew and you keep access until the end of the paid period (cancelling is not withdrawing: the current period is not refunded).",
  },
  "Desde tu área de cliente, escribiendo al email del aviso legal o enviando el formulario de desistimiento que encontrarás más abajo. Basta con una declaración clara de tu decisión.": {
    de: "In deinem Kundenbereich, per E-Mail an die Adresse im Impressum oder mit dem Widerrufsformular weiter unten. Eine eindeutige Erklärung deiner Entscheidung genügt.",
    en: "From your customer area, by writing to the email in the legal notice or by sending the withdrawal form you will find below. A clear statement of your decision is enough.",
  },
  "Te devolvemos el dinero en un máximo de 14 días desde que nos comunicas tu decisión, por el mismo medio de pago que usaste.": {
    de: "Wir erstatten dir das Geld innerhalb von höchstens 14 Tagen, nachdem du uns deine Entscheidung mitgeteilt hast, über dasselbe Zahlungsmittel, das du verwendet hast.",
    en: "We refund the money within 14 days at most from when you tell us your decision, using the same payment method you used.",
  },

  // ── Privacidad con ventas ──
  "{plataforma} trata tus datos por encargo de la vendedora para alojar la página, gestionar las compras y enviarte los emails. Stripe trata los datos del pago como responsable independiente.": {
    de: "{plataforma} verarbeitet deine Daten im Auftrag der Verkäuferin, um die Seite zu hosten, die Käufe abzuwickeln und dir die E-Mails zu senden. Stripe verarbeitet die Zahlungsdaten als eigenständiger Verantwortlicher.",
    en: "{plataforma} processes your data on behalf of the seller to host the page, manage purchases and send you the emails. Stripe processes payment data as an independent controller.",
  },
  "Nombre, email, compras, reservas y los mensajes que nos envíes. Si reservas una lectura, los datos de nacimiento (fecha, hora y lugar) y las respuestas que des para prepararla.": {
    de: "Name, E-Mail, Käufe, Buchungen und die Nachrichten, die du uns schickst. Wenn du eine Deutung buchst, die Geburtsdaten (Datum, Uhrzeit und Ort) und die Antworten, die du zu ihrer Vorbereitung gibst.",
    en: "Name, email, purchases, bookings and the messages you send us. If you book a reading, the birth details (date, time and place) and the answers you give to prepare it.",
  },
  "Gestionar tu compra y darte acceso: ejecución del contrato.": { de: "Deinen Kauf abwickeln und dir Zugang geben: Vertragserfüllung.", en: "Managing your purchase and giving you access: performance of the contract." },
  "Preparar tu lectura con tus datos de nacimiento y tus respuestas: ejecución del contrato.": {
    de: "Deine Deutung mit deinen Geburtsdaten und deinen Antworten vorbereiten: Vertragserfüllung.",
    en: "Preparing your reading with your birth details and your answers: performance of the contract.",
  },
  "Cumplir las obligaciones legales: obligación legal.": { de: "Gesetzliche Pflichten erfüllen: rechtliche Verpflichtung.", en: "Complying with legal obligations: legal obligation." },
  "Recordarte una vez una compra que dejaste a medias: interés legítimo. Puedes oponerte en cualquier momento.": {
    de: "Dich einmal an einen nicht abgeschlossenen Kauf erinnern: berechtigtes Interesse. Du kannst jederzeit widersprechen.",
    en: "Reminding you once about a purchase you left unfinished: legitimate interest. You can object at any time.",
  },
  "Enviarte novedades, solo si marcas la casilla: consentimiento. Puedes retirarlo desde tu cuenta.": {
    de: "Dir Neuigkeiten schicken, nur wenn du das Kästchen ankreuzt: Einwilligung. Du kannst sie in deinem Konto widerrufen.",
    en: "Sending you news, only if you tick the box: consent. You can withdraw it from your account.",
  },
  "Los datos de las compras, 6 años (obligaciones mercantiles). Los datos para la lectura, hasta que pidas que se borren (los de una compra que no se terminó, 30 días). Los de las novedades, hasta que retires tu consentimiento.": {
    de: "Die Kaufdaten 6 Jahre (handelsrechtliche Pflichten). Die Daten für die Deutung, bis du ihre Löschung verlangst (die eines nicht abgeschlossenen Kaufs 30 Tage). Die für die Neuigkeiten, bis du deine Einwilligung widerrufst.",
    en: "Purchase data, 6 years (commercial obligations). Data for the reading, until you ask for it to be deleted (that of an unfinished purchase, 30 days). Data for news, until you withdraw your consent.",
  },
  "Tu nombre y tu email; tus compras, reservas y membresías; los contenidos a los que tienes acceso y tu progreso en los cursos; si reservas una lectura, los datos de nacimiento (fecha, hora y lugar) y las respuestas que des para prepararla; los datos de nacimiento que guardes en «Mi energía» (tuyos y de las personas que añadas), y los mensajes que envíes.": {
    de: "Dein Name und deine E-Mail-Adresse; deine Käufe, Buchungen und Mitgliedschaften; die Inhalte, auf die du Zugriff hast, und dein Fortschritt in den Kursen; wenn du eine Deutung buchst, die Geburtsdaten (Datum, Uhrzeit und Ort) und die Antworten, die du zu ihrer Vorbereitung gibst; die Geburtsdaten, die du in „Meine Energie“ speicherst (deine und die der Personen, die du hinzufügst), und die Nachrichten, die du sendest.",
    en: "Your name and email; your purchases, bookings and memberships; the content you have access to and your progress in the courses; if you book a reading, the birth details (date, time and place) and the answers you give to prepare it; the birth details you save in “My energy” (yours and those of the people you add), and the messages you send.",
  },
  "Gestionar tu compra o tu reserva, darte acceso y enviarte el enlace para entrar: ejecución del contrato.": {
    de: "Deinen Kauf oder deine Buchung abwickeln, dir Zugang geben und dir den Link zum Anmelden schicken: Vertragserfüllung.",
    en: "Managing your purchase or booking, giving you access and sending you the link to sign in: performance of the contract.",
  },
  "Darte acceso a los contenidos gratuitos que pides: ejecución de lo que solicitas.": {
    de: "Dir Zugang zu den kostenlosen Inhalten geben, die du anforderst: Erfüllung deiner Anfrage.",
    en: "Giving you access to the free content you request: carrying out what you ask for.",
  },
  "{procesadores} como responsables independientes, con su propia política de privacidad. Aquí no se guardan los datos de tu tarjeta ni de tu cuenta de PayPal.": {
    de: "{procesadores} als eigenständige Verantwortliche nach ihrer eigenen Datenschutzerklärung. Hier werden weder deine Kartendaten noch die Daten deines PayPal-Kontos gespeichert.",
    en: "{procesadores} as independent controllers, under their own privacy policy. Your card and PayPal account details are not stored here.",
  },
  "Los pagos los procesa Stripe": { de: "Die Zahlungen verarbeitet Stripe", en: "Payments are processed by Stripe" },
  "Los pagos los procesa PayPal": { de: "Die Zahlungen verarbeitet PayPal", en: "Payments are processed by PayPal" },
  "Los pagos los procesan Stripe y PayPal": { de: "Die Zahlungen verarbeiten Stripe und PayPal", en: "Payments are processed by Stripe and PayPal" },
  "Los pagos los procesan pasarelas de pago seguras": { de: "Die Zahlungen verarbeiten sichere Zahlungsdienste", en: "Payments are processed by secure payment gateways" },
  "Para alojar la web, guardar los archivos y enviar los emails se usan proveedores tecnológicos que tratan los datos solo por encargo y con las garantías del Reglamento General de Protección de Datos. Si alguno está fuera del Espacio Económico Europeo, la transferencia se hace con esas garantías (cláusulas contractuales tipo o el Marco de Privacidad de Datos UE-EE. UU.).": {
    de: "Für das Hosting der Website, die Speicherung der Dateien und den Versand der E-Mails werden technische Dienstleister eingesetzt, die die Daten nur im Auftrag und mit den Garantien der Datenschutz-Grundverordnung verarbeiten. Sitzt einer davon außerhalb des Europäischen Wirtschaftsraums, erfolgt die Übermittlung mit diesen Garantien (Standardvertragsklauseln oder das EU-US Data Privacy Framework).",
    en: "To host the website, store the files and send the emails, technology providers are used that process the data only on our behalf and with the safeguards of the General Data Protection Regulation. If any of them is outside the European Economic Area, the transfer is made with those safeguards (standard contractual clauses or the EU-US Data Privacy Framework).",
  },
  "Los datos de las compras, el tiempo que exigen las obligaciones mercantiles (en general, 6 años). El resto, mientras mantengas el acceso a los contenidos o hasta que pidas que se borren tus datos; los datos para la lectura de una compra que no se terminó, 30 días. Los de las novedades, hasta que retires tu consentimiento. Los datos de nacimiento guardados en «Mi energía», hasta que los borres.": {
    de: "Die Kaufdaten so lange, wie es die handelsrechtlichen Pflichten verlangen (in der Regel 6 Jahre). Der Rest, solange du Zugang zu den Inhalten hast oder bis du die Löschung deiner Daten verlangst; die Daten für die Deutung eines nicht abgeschlossenen Kaufs 30 Tage. Die für die Neuigkeiten, bis du deine Einwilligung widerrufst. Die in „Meine Energie“ gespeicherten Geburtsdaten, bis du sie löschst.",
    en: "Purchase data, for as long as commercial obligations require (generally 6 years). The rest, for as long as you keep access to the content or until you ask for your data to be deleted; data for the reading of an unfinished purchase, 30 days. Data for news, until you withdraw your consent. Birth details saved in “My energy”, until you delete them.",
  },
  "Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación y la portabilidad de tus datos escribiendo al email del aviso legal. También puedes reclamar ante la autoridad de protección de datos de tu país (en España, la Agencia Española de Protección de Datos, www.aepd.es).": {
    de: "Du kannst Auskunft, Berichtigung, Löschung, Widerspruch, Einschränkung und Übertragbarkeit deiner Daten verlangen, indem du an die E-Mail-Adresse im Impressum schreibst. Du kannst dich auch bei der Datenschutzbehörde deines Landes beschweren (in Spanien bei der Agencia Española de Protección de Datos, www.aepd.es).",
    en: "You can request access to, rectification, erasure, objection to, restriction and portability of your data by writing to the email in the legal notice. You can also complain to the data protection authority in your country (in Spain, the Spanish Data Protection Agency, www.aepd.es).",
  },

  // ── Formulario de desistimiento (entero) ──
  "A la atención de: [la vendedora indicada en el aviso legal, con su nombre, dirección y email]\n\nPor la presente le comunico que desisto de mi contrato de venta del siguiente bien / prestación del siguiente servicio:\n[producto]\n\nPedido el / recibido el: [fecha]\nNombre de la consumidora: [nombre]\nDomicilio de la consumidora: [dirección]\nFirma de la consumidora (solo si este formulario se presenta en papel)\nFecha: [fecha]": {
    de: "An: [die im Impressum angegebene Verkäuferin, mit Name, Anschrift und E-Mail]\n\nHiermit widerrufe ich den von mir abgeschlossenen Vertrag über den Kauf der folgenden Waren / die Erbringung der folgenden Dienstleistung:\n[Produkt]\n\nBestellt am / erhalten am: [Datum]\nName der Verbraucherin: [Name]\nAnschrift der Verbraucherin: [Anschrift]\nUnterschrift der Verbraucherin (nur bei Mitteilung auf Papier)\nDatum: [Datum]",
    en: "To: [the seller named in the legal notice, with her name, address and email]\n\nI hereby give notice that I withdraw from my contract of sale of the following goods / for the provision of the following service:\n[product]\n\nOrdered on / received on: [date]\nName of consumer: [name]\nAddress of consumer: [address]\nSignature of consumer (only if this form is submitted on paper)\nDate: [date]",
  },
};
