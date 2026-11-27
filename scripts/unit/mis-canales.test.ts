/**
 * «Mis canales» (área de cliente, web personal): qué es cada cosa en una palabra (lib/channel-kind.ts).
 */
import { channelKindLabel } from "../../lib/channel-kind";
import { PRODUCT_TYPE_LABEL } from "../../lib/types";
import { eq, test } from "./harness";

test("channelKindLabel: curso, membresía y descarga", () => {
  eq(channelKindLabel({ type: "COURSE", title: "Conócete" }), "Curso");
  eq(channelKindLabel({ type: "MEMBERSHIP", title: "Comunidad privada" }), "Membresía");
  eq(channelKindLabel({ type: "DIGITAL", title: "Gene Keys" }), "Descarga");
});

test("channelKindLabel: lectura (por nombre, datos de nacimiento o «Lo preparo yo»), sesión y taller", () => {
  eq(channelKindLabel({ type: "SESSION", title: "Lectura de Human Design" }), "Lectura");
  eq(channelKindLabel({ type: "SESSION", title: "Revolución solar", intake: { birth: "required", questions: [] } }), "Lectura");
  eq(channelKindLabel({ type: "DIGITAL", title: "Tu carta escrita", deliveryMode: "PERSONAL" }), "Lectura");
  eq(channelKindLabel({ type: "SESSION", title: "Sesión 1:1", intake: { birth: "off", questions: [] } }), "Sesión");
  eq(channelKindLabel({ type: "SESSION", title: "Lectura grupal", groupSession: true }), "Taller");
});

test("PRODUCT_TYPE_LABEL: «Sesión», sin «servicio»", () => {
  eq(PRODUCT_TYPE_LABEL.SESSION, "Sesión");
});
