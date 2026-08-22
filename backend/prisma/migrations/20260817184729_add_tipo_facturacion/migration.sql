-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "tipoFacturacion" TEXT NOT NULL DEFAULT 'cuenta_cobro';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "tipoDocumento" TEXT NOT NULL DEFAULT 'cuenta_cobro';
