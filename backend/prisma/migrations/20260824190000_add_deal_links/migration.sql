-- CreateTable
CREATE TABLE "DealLink" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'enlace',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealLink_dealId_idx" ON "DealLink"("dealId");

-- AddForeignKey
ALTER TABLE "DealLink" ADD CONSTRAINT "DealLink_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
