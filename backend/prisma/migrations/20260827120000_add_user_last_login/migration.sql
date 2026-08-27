-- Ultimo inicio de sesion de cada usuario (se ve en el panel de Equipo).
-- Nulo = nunca ha entrado desde que se empezo a registrar.
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
