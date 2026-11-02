/**
 * «Personalizar mi panel» (Ajustes): colores del panel como variables CSS (con texto legible sobre
 * el acento y la barra), lectura tolerante de lo guardado y orden/visibilidad del menú, de la barra
 * de abajo del móvil y de las tarjetas de Inicio.
 */
import { mobileNav, mobileNavFor, panelNav, panelNavFor } from "../../app/panel/nav-items";
import { contrastRatio } from "../../lib/colors";
import { accentWarning, EMPTY_PANEL_PREFS, HOME_CARDS, orderHome, orderNav, PANEL_PRESETS, panelThemeVars, parsePanelPrefs, readPanelPrefs } from "../../lib/panel-prefs";
import { eq, ok, test } from "./harness";

const FLAGS = { personal: true, sales: false, showBookings: true };

test("un orden guardado antes de Cursos y Comunidad: las dos salen al final, sin mover la barra de abajo", () => {
  const before = panelNav(FLAGS).filter((i) => i.href !== "/panel/cursos" && i.href !== "/panel/comunidad").map((i) => i.href);
  const nav = { order: before, hidden: [] };
  eq(panelNavFor(FLAGS, nav).map((i) => i.href).slice(-2), ["/panel/cursos", "/panel/comunidad"]);
  eq(mobileNavFor(FLAGS, nav).map((i) => i.href).slice(0, 4), before.slice(0, 4));
});

test("sin preferencias: ninguna variable (el panel de siempre) y el menú y la barra de siempre", () => {
  eq(panelThemeVars(null), {});
  eq(readPanelPrefs(null), EMPTY_PANEL_PREFS);
  eq(readPanelPrefs("basura"), EMPTY_PANEL_PREFS);
  eq(panelNavFor(FLAGS, null), panelNav(FLAGS));
  eq(mobileNavFor(FLAGS, null), mobileNav(FLAGS));
});

test("variables del tema: tonos, acento y barra con su texto legible", () => {
  for (const p of PANEL_PRESETS) {
    const v = panelThemeVars(p.theme);
    ok(v["--panel-accent"] === p.theme.accent && !!v["--color-paper"] && !!v["--panel-surface"], p.key);
    ok(contrastRatio(v["--panel-accent-text"], v["--panel-accent"]) >= 4.5, `${p.key}: texto sobre el acento`);
    if (p.theme.sidebar) ok(contrastRatio(v["--panel-side-text"], v["--panel-side-bg"]) >= 4.5, `${p.key}: texto sobre la barra`);
    // Texto general sobre el fondo del tono.
    ok(contrastRatio(v["--color-ink"], v["--color-paper"]) >= 7 && contrastRatio(v["--color-muted"], v["--color-paper"]) >= 4.5, `${p.key}: textos`);
  }
  const noche = panelThemeVars({ accent: "#C9BBF2", tone: "dark", sidebar: "#0B0E1F" });
  eq(noche["--color-paper"], "#121428");
  eq(noche["--panel-accent-text"], "#0E1024");
  eq(noche["--panel-side-text"], "#F6F1E7");
  eq(panelThemeVars({ accent: "#6B58C4", tone: "cream", sidebar: null })["--panel-side-bg"], undefined);
});

test("aviso si el acento se confunde con el fondo", () => {
  ok(!!accentWarning({ accent: "#F6F1E7", tone: "cream", sidebar: null }));
  eq(accentWarning({ accent: "#6B58C4", tone: "cream", sidebar: null }), null);
});

test("lo guardado: colores solo hex, Inicio y Ajustes nunca ocultos, rutas del panel y tarjetas conocidas", () => {
  const p = readPanelPrefs({
    theme: { accent: "#abc", tone: "neón", sidebar: "url(x)" },
    nav: { order: ["/panel/newsletter", "/panel", "https://evil.io", "/panel/newsletter"], hidden: ["/panel", "/panel/ajustes", "/panel/codigos"] },
    home: ["atajos", "nada", "resumen"],
  });
  eq(p.theme, { accent: "#AABBCC", tone: "cream", sidebar: null });
  eq(p.nav, { order: ["/panel/newsletter", "/panel"], hidden: ["/panel/codigos"] });
  eq(p.home, ["atajos", "resumen"]);
  ok(!parsePanelPrefs({ theme: { accent: "red" } }).ok);
  ok(!parsePanelPrefs({ theme: { accent: "#000000", sidebar: "javascript:x" } }).ok);
  ok(parsePanelPrefs({ theme: null, nav: null, home: [] }).ok);
});

test("orden del menú: su orden, ocultas fuera, nuevas en su sitio de siempre", () => {
  const items = [{ href: "/panel" }, { href: "/panel/a" }, { href: "/panel/b" }, { href: "/panel/c" }, { href: "/panel/ajustes" }];
  const r = orderNav(items, { order: ["/panel/c", "/panel", "/panel/ajustes", "/panel/a"], hidden: ["/panel/a", "/panel"] });
  eq(r.visible.map((i) => i.href), ["/panel/c", "/panel", "/panel/ajustes", "/panel/b"]);
  // /panel/b no estaba en su orden: va al final.
  eq([...r.visible, ...r.hidden].map((i) => i.href).sort(), items.map((i) => i.href).sort());
  eq(r.hidden.map((i) => i.href), ["/panel/a"]);
  ok(r.visible.some((i) => i.href === "/panel"), "Inicio no se oculta");
});

test("barra de abajo: las 4 primeras visibles de su orden + «Más», con nombres cortos", () => {
  const nav = { order: ["/panel", "/panel/newsletter", "/panel/automatizaciones", "/panel/pagina", "/panel/productos"], hidden: ["/panel/automatizaciones"] };
  const bar = mobileNavFor(FLAGS, nav);
  eq(bar.map((i) => i.href), ["/panel", "/panel/newsletter", "/panel/pagina", "/panel/productos", "/panel/mas"]);
  eq(bar[2].label, "Página");
  ok(!panelNavFor(FLAGS, nav).some((i) => i.href === "/panel/automatizaciones"), "oculta también en la barra lateral");
  eq(panelNavFor(FLAGS, nav).length, panelNav(FLAGS).length - 1);
});

test("orden de Inicio: el suyo y las que falten al final", () => {
  eq(orderHome([]), HOME_CARDS.map((c) => c.key));
  eq(orderHome(["atajos", "pasos"]), ["atajos", "pasos", "resumen", "cifras", "graficos"]);
});
