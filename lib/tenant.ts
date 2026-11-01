import { Prisma } from "@prisma/client";
import { prisma } from "./db";

/**
 * Aislamiento multi-tenant.
 *
 * `tenantDb(creatorId)` devuelve un cliente Prisma que, para cada modelo que
 * pertenece a una creadora, inyecta automáticamente `creatorId` en:
 *   · el `where` de lecturas, actualizaciones, borrados, conteos y agregados
 *   · el `data` de las creaciones
 *
 * Así, aunque un id llegue manipulado desde el cliente (p. ej. el id de un
 * producto de María en una petición de Ana), la consulta simplemente no
 * encuentra nada. Todo el código del panel de creadora usa este cliente.
 *
 * Reglas para mantenerlo seguro:
 *   1. En el panel, NO uses `prisma` directamente para modelos de tenant.
 *   2. En las escrituras usa claves foráneas escalares (productId: "...") en
 *      lugar de `connect`, para que la inyección de `creatorId` sea válida.
 *   3. Si añades un modelo con `creatorId`, añádelo a TENANT_MODELS.
 */
export const TENANT_MODELS = new Set<Prisma.ModelName>([
  "Product",
  "ProductFile",
  "CourseModule",
  "Lesson",
  "LessonPart",
  "LessonProgress",
  "MembershipPost",
  "MembershipComment",
  "MembershipPostLike",
  "ProductInclusion",
  "Customer",
  "Order",
  "Transaction",
  "Access",
  "Booking",
  "AvailabilityRule",
  "BlockedDate",
  "AvailabilityOverride",
  "OrderFile",
  "Subscription",
  "AnalyticsEvent",
  "Automation",
  "EmailMessage",
  "Refund",
  "LegalSnapshot",
  "Invoice",
  "RecoveryOptOut",
  "Post",
  "PortalItem",
  "DiscountCode",
  "SitePage",
  "Subscriber",
  "Campaign",
  "CampaignRecipient",
  "CalendarNote",
  "OracleDeck",
  "OracleCard",
  "BirthProfile",
  "SectionSeen",
]);

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

export function tenantDb(creatorId: string) {
  if (!creatorId) throw new Error("tenantDb: creatorId requerido");
  return prisma.$extends({
    name: "tenant-isolation",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model as Prisma.ModelName)) return query(args);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a: any = args ?? {};
          if (WHERE_OPS.has(operation)) {
            a.where = { ...(a.where ?? {}), creatorId };
          } else if (operation === "create") {
            a.data = { ...(a.data ?? {}), creatorId };
          } else if (operation === "createMany" || operation === "createManyAndReturn") {
            a.data = Array.isArray(a.data)
              ? a.data.map((d: object) => ({ ...d, creatorId }))
              : { ...a.data, creatorId };
          } else if (operation === "upsert") {
            a.where = { ...(a.where ?? {}), creatorId };
            a.create = { ...(a.create ?? {}), creatorId };
          }
          return query(a);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;
