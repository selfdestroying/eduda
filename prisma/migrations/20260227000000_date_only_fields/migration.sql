-- Convert date-only DateTime fields from timestamp to date type.
-- Existing values are stored as Moscow midnight in UTC (e.g., 2026-01-14 21:00:00 UTC = 2026-01-15 00:00:00 MSK).
-- The USING clause converts UTC → Moscow time → extracts the date, preserving correct calendar dates.

-- Lesson.date
ALTER TABLE "Lesson"
  ALTER COLUMN "date" TYPE date
  USING (("date" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Moscow')::date;

-- Dismissed.date
ALTER TABLE "Dismissed"
  ALTER COLUMN "date" TYPE date
  USING (("date" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Moscow')::date;

-- PayCheck.date
ALTER TABLE "PayCheck"
  ALTER COLUMN "date" TYPE date
  USING (("date" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Moscow')::date;

-- Group.startDate
ALTER TABLE "Group"
  ALTER COLUMN "startDate" TYPE date
  USING (("startDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Moscow')::date;

-- Student.birthDate
ALTER TABLE "Student"
  ALTER COLUMN "birthDate" TYPE date
  USING (("birthDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Moscow')::date;
