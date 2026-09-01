-- Enlace entre la cita de DT-OS y su evento en Google Calendar.
-- Nulo = la cita solo vive en DT-OS (Google no configurado o fallo la copia).
ALTER TABLE "CalendarEvent" ADD COLUMN "googleEventId" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN "googleHtmlLink" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN "meetLink" TEXT;
