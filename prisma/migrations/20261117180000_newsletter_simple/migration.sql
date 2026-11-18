-- Newsletter más sencilla: sin segmentos, sin secuencias (automatizaciones por pasos) y sin etiquetas.
DROP TABLE IF EXISTS "FlowLog";
DROP TABLE IF EXISTS "FlowRun";
DROP TABLE IF EXISTS "FlowOptOut";
DROP TABLE IF EXISTS "NewsletterFlow";
DROP TABLE IF EXISTS "NewsletterSegment";
DROP INDEX IF EXISTS "EmailMessage_flowId_flowStepId_idx";
ALTER TABLE "EmailMessage" DROP COLUMN IF EXISTS "flowId", DROP COLUMN IF EXISTS "flowStepId";
ALTER TABLE "Subscriber" DROP COLUMN IF EXISTS "tags";
-- Las newsletters que iban a una etiqueta o a un segmento pasan a ir a todas.
UPDATE "Campaign" SET "segment" = '{"kind":"all"}'::jsonb WHERE "segment"->>'kind' IN ('tag', 'saved');
