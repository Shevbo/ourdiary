-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'OVERDUE';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "seriesEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "event_reactions" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_reactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_reactions_eventId_userId_emoji_key" ON "event_reactions"("eventId", "userId", "emoji");
CREATE INDEX IF NOT EXISTS "event_reactions_eventId_idx" ON "event_reactions"("eventId");

ALTER TABLE "event_reactions" ADD CONSTRAINT "event_reactions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_reactions" ADD CONSTRAINT "event_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "task_completion_logs" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_completion_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "task_completion_logs_taskId_idx" ON "task_completion_logs"("taskId");
CREATE INDEX IF NOT EXISTS "task_completion_logs_userId_idx" ON "task_completion_logs"("userId");

ALTER TABLE "task_completion_logs" ADD CONSTRAINT "task_completion_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_completion_logs" ADD CONSTRAINT "task_completion_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
