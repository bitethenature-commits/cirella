export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Modo demo (accesos rápidos, buzón /dev/correo): solo si se activa explícitamente. */
export function isDemoMode() {
  return process.env.DEMO_MODE === "true";
}

export function storageDir() {
  return process.env.STORAGE_DIR || "./storage";
}

export function appHost() {
  return appUrl().replace(/^https?:\/\//, "");
}
