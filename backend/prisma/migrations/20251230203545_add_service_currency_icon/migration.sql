-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "icon" TEXT NOT NULL DEFAULT 'Briefcase';
