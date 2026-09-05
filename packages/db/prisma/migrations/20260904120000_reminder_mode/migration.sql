-- Режим напоминаний вместо «за сколько дней».
--
-- `reminderLeadDays` был числом дней (1 — накануне, 0 — в день занятия), но в
-- день занятия фиксированный час бессмыслен: уроку в 19:00 напоминание в 08:30
-- уходило за десять часов. Режим теперь назван, а «в день занятия» отсчитывает
-- от начала урока — отсюда вторая колонка.
--
-- Данные переносятся, а не теряются: 0 был «в день занятия», всё остальное —
-- «накануне» (колонка `Int`, и мусор в ней должен читаться как прежний дефолт).

CREATE TYPE "ReminderMode" AS ENUM ('DAY_BEFORE', 'SAME_DAY');

ALTER TABLE "Organization"
    ADD COLUMN "reminderMode" "ReminderMode" NOT NULL DEFAULT 'DAY_BEFORE',
    ADD COLUMN "reminderLeadMinutes" INTEGER NOT NULL DEFAULT 120;

UPDATE "Organization" SET "reminderMode" = 'SAME_DAY' WHERE "reminderLeadDays" = 0;

ALTER TABLE "Organization" DROP COLUMN "reminderLeadDays";
