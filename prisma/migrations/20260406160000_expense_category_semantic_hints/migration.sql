-- Справочник обучения: текст позиции чека -> категория
CREATE TABLE "expense_category_semantic_hints" (
    "id" TEXT NOT NULL,
    "textKey" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "confirmCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_category_semantic_hints_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "expense_category_semantic_hints_textKey_key" ON "expense_category_semantic_hints"("textKey");
