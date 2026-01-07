-- DropForeignKey
ALTER TABLE "Service" DROP CONSTRAINT "Service_createdBy_fkey";

-- AlterTable
ALTER TABLE "Service" ALTER COLUMN "createdBy" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
