-- AlterTable
ALTER TABLE "StudentAccount" ADD COLUMN     "passwordEnc" BYTEA,
ADD COLUMN     "studentUserId" INTEGER;

-- CreateTable
CREATE TABLE "StudentUser" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "username" TEXT,
    "displayUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSession" (
    "id" SERIAL NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "StudentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCredential" (
    "id" SERIAL NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "StudentCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentVerification" (
    "id" SERIAL NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentUser_email_key" ON "StudentUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StudentUser_username_key" ON "StudentUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSession_token_key" ON "StudentSession"("token");

-- CreateIndex
CREATE INDEX "StudentSession_userId_idx" ON "StudentSession"("userId");

-- CreateIndex
CREATE INDEX "StudentCredential_userId_idx" ON "StudentCredential"("userId");

-- CreateIndex
CREATE INDEX "StudentVerification_identifier_idx" ON "StudentVerification"("identifier");

-- Дедуп логинов перед глобальным уникальным индексом.
-- Логин становится уникальным на все школы, потому что вход в шоп идёт на едином
-- домене shop.{rootDomain} без поддомена школы. Старейшая запись (минимальный id)
-- сохраняет логин, каждая следующая получает первый свободный суффикс -2, -3, ...
-- Каждое переименование печатается NOTICE — это единственный отчёт школам,
-- автоматического уведомления нет.
--
-- Сравнение регистронезависимое: better-auth ищет username в нижнем регистре,
-- поэтому «Ivanov» и «ivanov» — это один и тот же вход, а не два разных.
DO $$
DECLARE
    r         RECORD;
    n         INT;
    candidate TEXT;
BEGIN
    FOR r IN
        SELECT a.id, a.login
        FROM "StudentAccount" a
        WHERE EXISTS (
            SELECT 1 FROM "StudentAccount" b
            WHERE lower(b.login) = lower(a.login) AND b.id < a.id
        )
        ORDER BY a.id
    LOOP
        n := 2;
        LOOP
            candidate := r.login || '-' || n;
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM "StudentAccount" WHERE lower(login) = lower(candidate)
            );
            n := n + 1;
        END LOOP;
        UPDATE "StudentAccount" SET login = candidate WHERE id = r.id;
        RAISE NOTICE 'StudentAccount %: логин "%" был занят, переименован в "%"', r.id, r.login, candidate;
    END LOOP;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "StudentAccount_login_key" ON "StudentAccount"("login");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAccount_studentUserId_key" ON "StudentAccount"("studentUserId");

-- AddForeignKey
ALTER TABLE "StudentSession" ADD CONSTRAINT "StudentSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "StudentUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCredential" ADD CONSTRAINT "StudentCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "StudentUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAccount" ADD CONSTRAINT "StudentAccount_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "StudentUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
