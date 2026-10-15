import { resolveOwnerUsername, resolveSiteMode } from "../../lib/site-mode";
import { eq, test } from "./harness";

// Modo del sitio: «personal» solo si se pide expresamente
for (const [value, want] of [
  [undefined, "platform"],
  [null, "platform"],
  ["", "platform"],
  ["platform", "platform"],
  ["personal", "personal"],
  [" personal ", "personal"],
  ["Personal", "platform"],
  ["otro", "platform"],
] as const)
  test(`resolveSiteMode(${JSON.stringify(value)}) → ${want}`, () => eq(resolveSiteMode(value), want));

// Usuario de la dueña: normalizado y solo en modo personal
for (const [mode, value, want] of [
  ["personal", "ana", "ana"],
  ["personal", " @Ana ", "ana"],
  ["personal", "", null],
  ["personal", undefined, null],
  ["platform", "ana", null],
] as const)
  test(`resolveOwnerUsername(${mode}, ${JSON.stringify(value)}) → ${want}`, () => eq(resolveOwnerUsername(mode, value), want));
