export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function isDemoMode() {
  return process.env.DEMO_MODE !== "false";
}

export function storageDir() {
  return process.env.STORAGE_DIR || "./storage";
}

export function appHost() {
  return appUrl().replace(/^https?:\/\//, "");
}
