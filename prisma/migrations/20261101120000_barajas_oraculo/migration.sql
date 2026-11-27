-- Barajas de oráculo propias (Panel → Barajas; lib/oracle-decks.ts).
-- CreateTable
CREATE TABLE "OracleDeck" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "backImageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OracleDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OracleCard" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyword" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "question" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "motif" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "reversible" BOOLEAN NOT NULL DEFAULT false,
    "reversedMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OracleCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OracleDeck_creatorId_status_sortOrder_idx" ON "OracleDeck"("creatorId", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OracleDeck_creatorId_slug_key" ON "OracleDeck"("creatorId", "slug");

-- CreateIndex
CREATE INDEX "OracleCard_deckId_sortOrder_idx" ON "OracleCard"("deckId", "sortOrder");

-- CreateIndex
CREATE INDEX "OracleCard_creatorId_idx" ON "OracleCard"("creatorId");

-- AddForeignKey
ALTER TABLE "OracleDeck" ADD CONSTRAINT "OracleDeck_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OracleCard" ADD CONSTRAINT "OracleCard_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OracleCard" ADD CONSTRAINT "OracleCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "OracleDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

