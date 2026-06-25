-- Bloque 3 del brief: campos de valor (implementación / MRR / meses de contrato) para el ACV
ALTER TABLE "Deal" ADD COLUMN "implementationValue" DOUBLE PRECISION;
ALTER TABLE "Deal" ADD COLUMN "monthlyRecurring" DOUBLE PRECISION;
ALTER TABLE "Deal" ADD COLUMN "contractMonths" INTEGER;
