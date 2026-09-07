-- Ítems de Servicio del borrador (descripcion, cantidad, precio_unitario),
-- guardados como snapshot para poder desglosar la factura electrónica en
-- Factus y en el PDF propio. Antes solo se persistía el total agregado.
ALTER TABLE "Invoice" ADD COLUMN "items" JSONB;
