-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "recipient" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'sms',
    "text" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "path" TEXT,
    "text" TEXT,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_tokens" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tv_view_state" (
    "id" TEXT NOT NULL,
    "view" TEXT NOT NULL DEFAULT 'month',
    "anchor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tv_view_state_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "events" ADD COLUMN "categoryId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "reminders_remindAt_sentAt_idx" ON "reminders"("remindAt", "sentAt");

-- CreateIndex
CREATE INDEX "attachments_eventId_idx" ON "attachments"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "upload_tokens_token_key" ON "upload_tokens"("token");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_tokens" ADD CONSTRAINT "upload_tokens_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
