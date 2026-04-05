-- CreateTable
CREATE TABLE "app_news_comments" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "appNewsId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_news_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_news_reactions" (
    "id" TEXT NOT NULL,
    "appNewsId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_news_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_news_votes" (
    "id" TEXT NOT NULL,
    "value" "VoteValue" NOT NULL,
    "userId" TEXT NOT NULL,
    "appNewsId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_news_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_news_reactions_appNewsId_userId_emoji_key" ON "app_news_reactions"("appNewsId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "app_news_reactions_appNewsId_idx" ON "app_news_reactions"("appNewsId");

-- CreateIndex
CREATE INDEX "app_news_comments_appNewsId_idx" ON "app_news_comments"("appNewsId");

-- CreateIndex
CREATE UNIQUE INDEX "app_news_votes_userId_appNewsId_key" ON "app_news_votes"("userId", "appNewsId");

-- AddForeignKey
ALTER TABLE "app_news_comments" ADD CONSTRAINT "app_news_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_news_comments" ADD CONSTRAINT "app_news_comments_appNewsId_fkey" FOREIGN KEY ("appNewsId") REFERENCES "app_news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_news_reactions" ADD CONSTRAINT "app_news_reactions_appNewsId_fkey" FOREIGN KEY ("appNewsId") REFERENCES "app_news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_news_reactions" ADD CONSTRAINT "app_news_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_news_votes" ADD CONSTRAINT "app_news_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_news_votes" ADD CONSTRAINT "app_news_votes_appNewsId_fkey" FOREIGN KEY ("appNewsId") REFERENCES "app_news"("id") ON DELETE CASCADE ON UPDATE CASCADE;
