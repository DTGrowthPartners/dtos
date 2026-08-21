-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "municipio" TEXT,
ADD COLUMN     "tipoFacturacion" TEXT NOT NULL DEFAULT 'cuenta_cobro';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "factusCufe" TEXT,
ADD COLUMN     "factusNcNumber" TEXT,
ADD COLUMN     "factusNdNumber" TEXT,
ADD COLUMN     "factusNumber" TEXT,
ADD COLUMN     "factusReference" TEXT,
ADD COLUMN     "factusStatus" TEXT,
ADD COLUMN     "factusValidatedAt" TIMESTAMP(3),
ADD COLUMN     "tipoDocumento" TEXT NOT NULL DEFAULT 'cuenta_cobro';

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "emailUid" INTEGER,
    "tipo" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "cuenta" TEXT NOT NULL DEFAULT 'Bancolombia',
    "entidad" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "sheetOk" BOOLEAN NOT NULL DEFAULT false,
    "notificado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NpsContacto" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NpsContacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NpsEnvio" (
    "id" TEXT NOT NULL,
    "contactoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "trimestre" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "enviadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "venceAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NpsEnvio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NpsRespuesta" (
    "id" TEXT NOT NULL,
    "envioId" TEXT NOT NULL,
    "puntaje" INTEGER NOT NULL,
    "comentario" TEXT,
    "aspectos" TEXT[],
    "quiereLlamada" BOOLEAN NOT NULL DEFAULT false,
    "respondidoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NpsRespuesta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocProject" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "color" TEXT NOT NULL DEFAULT '#7c3aed',
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'doc',
    "contenido" TEXT NOT NULL DEFAULT '',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "NpsEnvio_token_key" ON "NpsEnvio"("token");

-- CreateIndex
CREATE UNIQUE INDEX "NpsRespuesta_envioId_key" ON "NpsRespuesta"("envioId");

-- AddForeignKey
ALTER TABLE "NpsEnvio" ADD CONSTRAINT "NpsEnvio_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "NpsContacto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NpsRespuesta" ADD CONSTRAINT "NpsRespuesta_envioId_fkey" FOREIGN KEY ("envioId") REFERENCES "NpsEnvio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocEntry" ADD CONSTRAINT "DocEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "DocProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
