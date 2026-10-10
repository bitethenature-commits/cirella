"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DELIVERY_COUNT, deliveryFacts, deliveryIssue, deliveryIssueCopy } from "@/lib/delivery";
import { DEFAULT_FEATURES, type PlanFeatures } from "@/lib/plans";
import { setSetting } from "@/lib/settings";
import { slugify } from "@/lib/slug";
import { TEMPLATE_KEYS } from "@/lib/templates";
import { PRODUCT_TYPES } from "@/lib/types";

const done = (path: string, msg: string) => {
  revalidatePath("/admin", "layout");
  // Las acciones de admin son raras y pueden cambiar cualquier página pública cacheada
  // (bloqueo, planes, nombre de la plataforma): se invalida todo.
  revalidatePath("/", "layout");
  redirect(`${path}?ok=${encodeURIComponent(msg)}`);
};

export async function setUserStatus(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id"));
  const status = z.enum(["ACTIVE", "BLOCKED"]).parse(form.get("status"));
  if (id === admin.id) redirect("/admin");
  await prisma.user.update({ where: { id }, data: { status } });
  if (status === "BLOCKED") await prisma.session.deleteMany({ where: { userId: id } });
  done(String(form.get("back") ?? "/admin/clientes"), status === "BLOCKED" ? "Usuario bloqueado" : "Usuario desbloqueado");
}

export async function setCreatorStatus(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const status = z.enum(["ACTIVE", "BLOCKED"]).parse(form.get("status"));
  await prisma.creator.update({ where: { id }, data: { status } });
  done(String(form.get("back") ?? "/admin/creadoras"), status === "BLOCKED" ? "Creadora bloqueada: su página ya no es visible" : "Creadora reactivada");
}

export async function setCreatorPlan(form: FormData) {
  await requireAdmin();
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: String(form.get("planId")) } });
  await prisma.creator.update({ where: { id: String(form.get("id")) }, data: { planId: plan.id } });
  done("/admin/creadoras", `Plan cambiado a ${plan.name}`);
}

export async function setProductStatusAdmin(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const status = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).parse(form.get("status"));
  if (status === "PUBLISHED") {
    // La misma regla que en el panel: no se publica nada que no tenga qué entregar (lib/delivery.ts).
    const p = await prisma.product.findUniqueOrThrow({ where: { id }, include: DELIVERY_COUNT });
    const issue = deliveryIssue(deliveryFacts(p));
    if (issue?.blocking) redirect(`/admin/productos?error=${encodeURIComponent(`No se puede publicar: ${deliveryIssueCopy(issue, p.title).title}`)}`);
  }
  await prisma.product.update({ where: { id }, data: { status } });
  done("/admin/productos", "Producto actualizado");
}

export async function savePlan(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const num = (k: string) => Number(String(form.get(k) ?? "").replace(",", "."));
  const features: PlanFeatures = {
    ...DEFAULT_FEATURES,
    productTypes: PRODUCT_TYPES.filter((t) => form.get(`type_${t}`) === "on"),
    customDesign: form.get("customDesign") === "on",
    removeBranding: form.get("removeBranding") === "on",
    customerArea: form.get("customerArea") === "on",
    automations: form.get("automations") === "on",
    analytics: z.enum(["basic", "full", "advanced"]).catch("basic").parse(form.get("analytics")),
  };
  const maxRaw = String(form.get("maxProducts") ?? "").trim();
  const data = {
    name: String(form.get("name") ?? "").trim().slice(0, 40) || "Plan",
    tagline: String(form.get("tagline") ?? "").trim().slice(0, 120) || null,
    priceMonthlyCents: Math.max(0, Math.round(num("price") * 100) || 0),
    commissionBps: Math.max(0, Math.min(5000, Math.round(num("commission") * 100) || 0)),
    maxProducts: maxRaw === "" ? null : Math.max(1, Math.round(Number(maxRaw))),
    features,
    highlighted: form.get("highlighted") === "on",
    active: form.get("active") === "on",
    isDefault: form.get("isDefault") === "on",
    sortOrder: Math.round(num("sortOrder")) || 0,
  };
  if (data.isDefault) await prisma.plan.updateMany({ where: { NOT: { id } }, data: { isDefault: false } });
  if (id) await prisma.plan.update({ where: { id }, data });
  else {
    const key = slugify(String(form.get("key") || data.name)).replace(/-/g, "_") || `plan_${Date.now()}`;
    if (await prisma.plan.findUnique({ where: { key } })) redirect(`/admin/planes?error=${encodeURIComponent("Ya existe un plan con esa clave")}`);
    await prisma.plan.create({ data: { ...data, key } });
  }
  done("/admin/planes", `Plan «${data.name}» guardado`);
}

export async function saveCategory(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (!name) redirect("/admin/categorias");
  const data = {
    name,
    emoji: String(form.get("emoji") ?? "").slice(0, 8) || null,
    defaultTemplate: z.enum(TEMPLATE_KEYS).catch("mystical").parse(form.get("defaultTemplate")),
    active: form.get("active") === "on",
    sortOrder: Number(form.get("sortOrder") ?? 0) || 0,
  };
  if (id) await prisma.category.update({ where: { id }, data });
  else await prisma.category.create({ data: { ...data, slug: slugify(name), active: true } });
  done("/admin/categorias", "Categoría guardada");
}

export async function saveTemplateAdmin(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const t = await prisma.template.findUniqueOrThrow({ where: { id } });
  const active = form.get("active") === "on";
  if (!active && (await prisma.template.count({ where: { active: true } })) <= 1 && t.active) redirect(`/admin/disenos?error=${encodeURIComponent("Debe quedar al menos un diseño activo")}`);
  await prisma.template.update({
    where: { id },
    data: { name: String(form.get("name") ?? t.name).slice(0, 40), description: String(form.get("description") ?? "").slice(0, 160) || null, active, sortOrder: Number(form.get("sortOrder") ?? t.sortOrder) || 0 },
  });
  done("/admin/disenos", "Diseño actualizado");
}

export async function saveSettings(form: FormData) {
  await requireAdmin();
  await setSetting("platformName", String(form.get("platformName") ?? "Cirella").trim().slice(0, 40) || "Cirella");
  await setSetting("supportEmail", String(form.get("supportEmail") ?? "").trim().slice(0, 120));
  await setSetting("referralRewardType", z.enum(["FREE_MONTH", "CREDIT", "COMMISSION_DISCOUNT"]).parse(form.get("referralRewardType")));
  await setSetting("referralRewardValue", Math.max(0, Number(form.get("referralRewardValue") ?? 0) || 0));
  await setSetting("referralDiscountMonths", Math.max(1, Number(form.get("referralDiscountMonths") ?? 3) || 3));
  const text = (key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
  await setSetting("legalCompanyName", text("legalCompanyName", 200));
  await setSetting("legalTaxId", text("legalTaxId", 200).toUpperCase());
  await setSetting("legalAddress", text("legalAddress", 400));
  await setSetting("legalRegistry", text("legalRegistry", 200));
  await setSetting("privacyEmail", text("privacyEmail", 200).toLowerCase());
  done("/admin/ajustes", "Ajustes guardados");
}
