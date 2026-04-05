-- Имя для входа без «служебного» суффикса из id (см. 20260402120000_sprint1_login_places_tasks).
-- Как uniqueLoginNameFromEmailLocalPart: база из локальной части email, при коллизиях — -1, -2, …

WITH bases AS (
  SELECT
    id,
    COALESCE(
      NULLIF(
        left(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._-]', '', 'g'), 32),
        ''
      ),
      'user'
    ) AS base,
    "createdAt"
  FROM users
),
numbered AS (
  SELECT
    id,
    base,
    row_number() OVER (PARTITION BY base ORDER BY "createdAt", id) AS rn
  FROM bases
)
UPDATE users u
SET "loginName" = lower(
  CASE
    WHEN n.rn = 1 THEN n.base
    ELSE n.base || '-' || (n.rn - 1)::text
  END
)
FROM numbered n
WHERE u.id = n.id;
