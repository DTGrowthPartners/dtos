-- Fecha en que se validó ante la DIAN la nota crédito que anuló una factura
-- (antes solo se guardaba el número, factusNcNumber). Nulo = no aplica o no
-- se sabe la fecha de notas crédito emitidas antes de este campo.
ALTER TABLE "Invoice" ADD COLUMN "factusNcValidatedAt" TIMESTAMP(3);
