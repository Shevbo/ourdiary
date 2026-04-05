-- Новости приложения
CREATE TABLE "app_news" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "app_news_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_news_createdAt_idx" ON "app_news"("createdAt" DESC);

-- Справочник категорий расходов
CREATE TABLE "expense_category_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "expense_category_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "expense_category_definitions_code_key" ON "expense_category_definitions"("code");

INSERT INTO "expense_category_definitions" ("id", "code", "label", "sortOrder", "isActive") VALUES
  ('cmexpdef0001food', 'FOOD', 'Еда', 10, true),
  ('cmexpdef0002tr', 'TRANSPORT', 'Транспорт', 20, true),
  ('cmexpdef0003ent', 'ENTERTAINMENT', 'Развлечения', 30, true),
  ('cmexpdef0004hl', 'HEALTH', 'Здоровье', 40, true),
  ('cmexpdef0005edu', 'EDUCATION', 'Образование', 50, true),
  ('cmexpdef0006clo', 'CLOTHING', 'Одежда', 60, true),
  ('cmexpdef0007hom', 'HOME', 'Дом', 70, true),
  ('cmexpdef0008vac', 'VACATION', 'Отпуск', 80, true),
  ('cmexpdef0009shp', 'SHOPPING_PLAN', 'План покупок', 90, true),
  ('cmexpdef0010oth', 'OTHER', 'Прочее', 100, true);

-- Фото к расходам
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "receiptImageUrl" TEXT;

-- Категория: enum -> строка
ALTER TABLE "expenses" ADD COLUMN "category_str" TEXT NOT NULL DEFAULT 'OTHER';
UPDATE "expenses" SET "category_str" = "category"::text;
ALTER TABLE "expenses" DROP COLUMN "category";
ALTER TABLE "expenses" RENAME COLUMN "category_str" TO "category";

DROP TYPE "ExpenseCategory";
