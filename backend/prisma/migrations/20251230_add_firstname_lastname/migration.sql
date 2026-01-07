-- AddColumn firstName and lastName to User table
ALTER TABLE "User" ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';

-- Update existing users to split name into firstName and lastName
UPDATE "User"
SET "firstName" = SPLIT_PART("name", ' ', 1),
    "lastName" = CASE
        WHEN POSITION(' ' IN "name") > 0
        THEN SUBSTRING("name" FROM POSITION(' ' IN "name") + 1)
        ELSE ''
    END
WHERE "name" IS NOT NULL;

-- Drop the old name column
ALTER TABLE "User" DROP COLUMN "name";
