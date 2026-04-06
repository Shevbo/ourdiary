-- Категория «Не распознано»; перенос данных из «Прочее» (OTHER) в UNRECOGNIZED

INSERT INTO "expense_category_definitions" ("id", "code", "label", "sortOrder", "isActive")
SELECT 'cmexpdef_unrec', 'UNRECOGNIZED', 'Не распознано', 99, true
WHERE NOT EXISTS (SELECT 1 FROM "expense_category_definitions" WHERE "code" = 'UNRECOGNIZED');

UPDATE "expenses" SET "category" = 'UNRECOGNIZED' WHERE "category" = 'OTHER';
UPDATE "expense_receipt_lines" SET "category" = 'UNRECOGNIZED' WHERE "category" = 'OTHER';

ALTER TABLE "expenses" ALTER COLUMN "category" SET DEFAULT 'UNRECOGNIZED';
ALTER TABLE "expense_receipt_lines" ALTER COLUMN "category" SET DEFAULT 'UNRECOGNIZED';
