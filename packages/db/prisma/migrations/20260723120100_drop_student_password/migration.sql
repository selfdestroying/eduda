-- Удаление plaintext-пароля ученика. Вход теперь идёт по хешу
-- (`StudentCredential.password`), показ пароля школе — из `passwordEnc`.
--
-- Между `student_auth` и этой миграцией обязан отработать
-- `apps/platform/scripts/backfill-student-auth.ts`. `migrate deploy` применяет
-- обе миграции подряд, поэтому здесь стоит защита: если backfill пропущен,
-- деплой падает вместо того, чтобы молча стереть пароли.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM "StudentAccount" WHERE "passwordEnc" IS NULL OR "studentUserId" IS NULL)
        THEN RAISE EXCEPTION 'backfill-student-auth не отработал: есть StudentAccount без passwordEnc/studentUserId';
    END IF;
END $$;

-- AlterTable
ALTER TABLE "StudentAccount" DROP COLUMN "password";
