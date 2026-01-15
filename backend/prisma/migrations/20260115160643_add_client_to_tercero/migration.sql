-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "terceroId" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '3007189383';

-- CreateTable
CREATE TABLE "Organizacion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nit" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "logo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tercero" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "telefonoCodigo" TEXT NOT NULL DEFAULT '+57',
    "direccion" TEXT,
    "documento" TEXT,
    "esProspecto" BOOLEAN NOT NULL DEFAULT false,
    "esCliente" BOOLEAN NOT NULL DEFAULT false,
    "esProveedor" BOOLEAN NOT NULL DEFAULT false,
    "esEmpleado" BOOLEAN NOT NULL DEFAULT false,
    "organizacionId" TEXT,
    "clientId" TEXT,
    "categoriaProveedor" TEXT,
    "cuentaBancaria" TEXT,
    "cargo" TEXT,
    "salarioBase" DOUBLE PRECISION,
    "fechaIngreso" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "notas" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tercero_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organizacion_nit_key" ON "Organizacion"("nit");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "Tercero"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tercero" ADD CONSTRAINT "Tercero_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tercero" ADD CONSTRAINT "Tercero_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
