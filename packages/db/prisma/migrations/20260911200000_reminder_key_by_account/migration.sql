-- Один бот — одна школа. Проверка в платформе — только подсказка, а от двух школ,
-- сохраняющих одного бота одновременно, защищает этот индекс.
CREATE UNIQUE INDEX "OrganizationMaxBot_username_key" ON "OrganizationMaxBot"("username");

-- Ключ напоминания — родитель и аккаунт MAX, а не id привязки: у аккаунта бывают
-- привязки к боту ЕДУДА и к боту школы, и после смены бота ключ по привязке
-- запланировал бы то же напоминание второй раз.
--
-- Строки, спланированные до выката, переписываются на новый вид: иначе в день
-- выката проход счёл бы сегодняшние напоминания новыми и отправил их ещё раз.
-- Только привязки к боту ЕДУДА: у них пара «родитель + аккаунт» была уникальна
-- всегда, а привязок к ботам школ до этой миграции на проде нет.
UPDATE "NotificationOutbox" AS o
SET "dedupeKey" = regexp_replace(
    o."dedupeKey",
    '^lesson-reminder:[0-9]+:',
    'lesson-reminder:' || pm."parentId" || ':' || pm."externalId" || ':'
)
FROM "ParentMessenger" AS pm
WHERE pm."id" = o."parentMessengerId"
  AND pm."provider" = 'MAX'
  AND pm."ownBot" = false
  AND o."dedupeKey" ~ '^lesson-reminder:[0-9]+:';
