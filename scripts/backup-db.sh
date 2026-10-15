#!/usr/bin/env bash
# Copia manual de la base de datos a un bucket de R2 (o cualquier S3).
# La copia diaria la hace el proveedor (Neon: restauración a cualquier momento de los últimos 7 días);
# esto sirve para guardar una copia propia antes de una migración delicada o una vez al mes.
# Ver docs/despliegue.md, «Copias de seguridad».
#
#   BACKUP_DATABASE_URL="postgresql://…(conexión DIRECTA, sin pooler)…" \
#   BACKUP_S3_ENDPOINT="https://<cuenta>.eu.r2.cloudflarestorage.com" \
#   BACKUP_S3_BUCKET="cirella-backups" \
#   AWS_ACCESS_KEY_ID="…" AWS_SECRET_ACCESS_KEY="…" AWS_DEFAULT_REGION="auto" \
#   bash scripts/backup-db.sh
#
# Necesita Docker (pg_dump de Postgres 16, la misma versión que el servidor) y la CLI de AWS.
set -euo pipefail

: "${BACKUP_DATABASE_URL:?Falta BACKUP_DATABASE_URL (conexión directa a la base de datos)}"
: "${BACKUP_S3_ENDPOINT:?Falta BACKUP_S3_ENDPOINT}"
: "${BACKUP_S3_BUCKET:?Falta BACKUP_S3_BUCKET}"

STAMP=$(date -u +%Y%m%dT%H%MZ)
FILE="cirella-$STAMP.dump"
trap 'rm -f "$FILE"' EXIT

echo "Volcando la base de datos…"
docker run --rm postgres:16-alpine pg_dump --format=custom --no-owner --no-acl "$BACKUP_DATABASE_URL" > "$FILE"

SIZE=$(wc -c < "$FILE" | tr -d ' ')
if [ "$SIZE" -eq 0 ]; then
  echo "La copia está vacía: algo ha fallado. No se sube nada." >&2
  exit 1
fi

echo "Subiendo $FILE ($SIZE bytes) a s3://$BACKUP_S3_BUCKET/db/…"
# R2 no admite las sumas de comprobación automáticas de las versiones recientes de la CLI.
AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
  aws s3 cp "$FILE" "s3://$BACKUP_S3_BUCKET/db/$FILE" --endpoint-url "$BACKUP_S3_ENDPOINT"

REMOTE=$(AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
  aws s3api head-object --bucket "$BACKUP_S3_BUCKET" --key "db/$FILE" --endpoint-url "$BACKUP_S3_ENDPOINT" \
  --query ContentLength --output text)
if [ "$REMOTE" != "$SIZE" ]; then
  echo "El tamaño en el bucket ($REMOTE) no coincide con el local ($SIZE)." >&2
  exit 1
fi
echo "Copia guardada: db/$FILE ($SIZE bytes)."
