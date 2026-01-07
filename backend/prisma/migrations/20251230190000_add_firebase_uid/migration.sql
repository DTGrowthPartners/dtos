-- Add firebaseUid field to User table
ALTER TABLE "User" ADD COLUMN "firebaseUid" TEXT UNIQUE;

-- Make password optional for Firebase users
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;
