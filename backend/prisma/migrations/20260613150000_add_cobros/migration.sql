-- CreateTable
CREATE TABLE "Cobro" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "fechaCobro" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "paidAt" TIMESTAMP(3),
    "metodoPago" TEXT,
    "referencia" TEXT,
    "nota" TEXT,
    "registradoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cobro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cobro_clientId_periodo_key" ON "Cobro"("clientId", "periodo");

-- AddForeignKey
ALTER TABLE "Cobro" ADD CONSTRAINT "Cobro_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
