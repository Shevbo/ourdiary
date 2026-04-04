-- Личный кабинет: заметки о себе
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bioNote" TEXT;

CREATE TYPE "DreamStatus" AS ENUM ('DRAFTING', 'ACTIVE', 'FULFILLED', 'POSTPONED', 'DROPPED');
CREATE TYPE "DreamSupportResponse" AS ENUM ('PENDING', 'DECLINED', 'AGREED');

CREATE TABLE "dreams" (
    "id" TEXT NOT NULL,
    "orderNo" INTEGER NOT NULL,
    "shortTitle" TEXT NOT NULL,
    "bodyRich" TEXT NOT NULL,
    "status" "DreamStatus" NOT NULL DEFAULT 'DRAFTING',
    "authorId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dreams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dream_supports" (
    "id" TEXT NOT NULL,
    "dreamId" TEXT NOT NULL,
    "supporterId" TEXT NOT NULL,
    "requestedSembons" INTEGER NOT NULL,
    "agreedSembons" INTEGER,
    "responseStatus" "DreamSupportResponse" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dream_supports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dream_supports_dreamId_supporterId_key" ON "dream_supports"("dreamId", "supporterId");
CREATE INDEX "dreams_authorId_idx" ON "dreams"("authorId");
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

ALTER TABLE "dreams" ADD CONSTRAINT "dreams_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dream_supports" ADD CONSTRAINT "dream_supports_dreamId_fkey" FOREIGN KEY ("dreamId") REFERENCES "dreams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dream_supports" ADD CONSTRAINT "dream_supports_supporterId_fkey" FOREIGN KEY ("supporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
