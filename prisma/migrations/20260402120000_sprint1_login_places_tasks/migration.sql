-- User: loginName + admin analytics
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "loginName" TEXT;
UPDATE "users" SET "loginName" = lower(split_part(email, '@', 1)) || '-' || left(replace(id::text, '-', ''), 10)
WHERE "loginName" IS NULL;
ALTER TABLE "users" ALTER COLUMN "loginName" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "users_loginName_key" ON "users"("loginName");

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isServiceUser" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "monthlyBudgetByCategory" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sembonManualAdjust" INTEGER NOT NULL DEFAULT 0;

-- Expense places + expense analytics
CREATE TABLE IF NOT EXISTS "expense_places" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "expense_places_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "expense_places_name_key" ON "expense_places"("name");

CREATE TYPE "ExpenseBeneficiary" AS ENUM ('FAMILY', 'MEMBER');

ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "beneficiary" "ExpenseBeneficiary" NOT NULL DEFAULT 'FAMILY';
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "beneficiaryUserId" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "placeId" TEXT;

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "expense_places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Task author
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "authorId" TEXT;
UPDATE "tasks" t
SET "authorId" = COALESCE(
  t."assigneeId",
  (SELECT u.id FROM "users" u ORDER BY u."createdAt" ASC LIMIT 1)
)
WHERE "authorId" IS NULL;
ALTER TABLE "tasks" ALTER COLUMN "authorId" SET NOT NULL;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
