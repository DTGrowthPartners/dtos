-- AlterTable
ALTER TABLE "ClientService" ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'activo',
ADD COLUMN     "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fechaProximoCobro" TIMESTAMP(3),
ADD COLUMN     "fechaVencimiento" TIMESTAMP(3),
ADD COLUMN     "frecuencia" TEXT NOT NULL DEFAULT 'mensual',
ADD COLUMN     "notas" TEXT,
ADD COLUMN     "precioCliente" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "permissions" TEXT[];
