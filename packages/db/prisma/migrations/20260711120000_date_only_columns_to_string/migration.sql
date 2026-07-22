-- Перевод date-only колонок с типа DATE на TEXT в формате "YYYY-MM-DD".
-- Календарный день сохраняется без изменения смысла: to_char(col, 'YYYY-MM-DD').

-- У Payment.date и StudentGroup.statusChangedAt есть DEFAULT — его нужно снять перед сменой типа.
ALTER TABLE "Payment" ALTER COLUMN "date" DROP DEFAULT;
ALTER TABLE "StudentGroup" ALTER COLUMN "statusChangedAt" DROP DEFAULT;

ALTER TABLE "Lesson"        ALTER COLUMN "date"            TYPE TEXT USING to_char("date", 'YYYY-MM-DD');
ALTER TABLE "Group"         ALTER COLUMN "startDate"       TYPE TEXT USING to_char("startDate", 'YYYY-MM-DD');
ALTER TABLE "Group"         ALTER COLUMN "statusChangedAt" TYPE TEXT USING to_char("statusChangedAt", 'YYYY-MM-DD');
ALTER TABLE "Rent"          ALTER COLUMN "startDate"       TYPE TEXT USING to_char("startDate", 'YYYY-MM-DD');
ALTER TABLE "Rent"          ALTER COLUMN "endDate"         TYPE TEXT USING to_char("endDate", 'YYYY-MM-DD');
ALTER TABLE "PayCheck"      ALTER COLUMN "date"            TYPE TEXT USING to_char("date", 'YYYY-MM-DD');
ALTER TABLE "ManagerSalary" ALTER COLUMN "startDate"       TYPE TEXT USING to_char("startDate", 'YYYY-MM-DD');
ALTER TABLE "ManagerSalary" ALTER COLUMN "endDate"         TYPE TEXT USING to_char("endDate", 'YYYY-MM-DD');
ALTER TABLE "Payment"       ALTER COLUMN "date"            TYPE TEXT USING to_char("date", 'YYYY-MM-DD');
ALTER TABLE "Expense"       ALTER COLUMN "date"            TYPE TEXT USING to_char("date", 'YYYY-MM-DD');
ALTER TABLE "Student"       ALTER COLUMN "birthDate"       TYPE TEXT USING to_char("birthDate", 'YYYY-MM-DD');
-- StudentGroup.statusChangedAt был timestamp; берём его календарный день.
ALTER TABLE "StudentGroup"  ALTER COLUMN "statusChangedAt" TYPE TEXT USING to_char("statusChangedAt", 'YYYY-MM-DD');
