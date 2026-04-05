-- Расширение задач: статусы, регулярность, сембон-логика согласований

CREATE TYPE "TaskRecurrenceKind" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

ALTER TABLE "tasks" ADD COLUMN "authorSeeksSembons" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tasks" ADD COLUMN "isRecurring" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tasks" ADD COLUMN "recurrenceKind" "TaskRecurrenceKind" NOT NULL DEFAULT 'NONE';
ALTER TABLE "tasks" ADD COLUMN "recurrencePayload" JSONB;
ALTER TABLE "tasks" ADD COLUMN "nextDueAt" TIMESTAMP(3);

ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";

CREATE TYPE "TaskStatus" AS ENUM (
  'DRAFT',
  'APPROVAL_PENDING',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
  'POSTPONED',
  'CANCELLED'
);

ALTER TABLE "tasks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tasks" ALTER COLUMN "status" TYPE "TaskStatus" USING (
  CASE "status"::text
    WHEN 'PENDING' THEN 'DRAFT'::"TaskStatus"
    WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::"TaskStatus"
    WHEN 'DONE' THEN 'DONE'::"TaskStatus"
    WHEN 'OVERDUE' THEN 'IN_PROGRESS'::"TaskStatus"
    ELSE 'DRAFT'::"TaskStatus"
  END
);
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"TaskStatus";

DROP TYPE "TaskStatus_old";

CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks"("status");
CREATE INDEX IF NOT EXISTS "tasks_assigneeId_idx" ON "tasks"("assigneeId");
