-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "lastReminderAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "remindersSent" INTEGER NOT NULL DEFAULT 0;
