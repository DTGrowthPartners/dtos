-- CreateTable
CREATE TABLE "PagoConciliado" (
    "id" TEXT NOT NULL,
    "sheetKey" TEXT NOT NULL,
    "invoiceId" TEXT,
    "invoiceNumber" TEXT,
    "tercero" TEXT NOT NULL,
    "importe" DOUBLE PRECISION NOT NULL,
    "fecha" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoConciliado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PagoConciliado_sheetKey_key" ON "PagoConciliado"("sheetKey");
