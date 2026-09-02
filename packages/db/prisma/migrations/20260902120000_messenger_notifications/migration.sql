-- Уведомления родителям в мессенджерах: привязки аккаунтов и очередь отправки.
--
-- Бот один на всю установку, поэтому привязка уникальна тройкой
-- (provider, externalId, parentId), а не парой: один аккаунт мессенджера
-- отвечает нескольким родителям, если дети учатся в разных школах.

-- CreateEnum
CREATE TYPE "MessengerProvider" AS ENUM ('VK', 'MAX');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
-- Выключено по умолчанию: рассылка идёт от имени школы, и включать её — её решение.
ALTER TABLE "Organization" ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminderTime" TEXT NOT NULL DEFAULT '20:00',
ADD COLUMN     "reminderLeadDays" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ParentMessenger" (
    "id" SERIAL NOT NULL,
    "provider" "MessengerProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribedAt" TIMESTAMP(3),
    "organizationId" INTEGER NOT NULL,
    "parentId" INTEGER NOT NULL,

    CONSTRAINT "ParentMessenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" INTEGER NOT NULL,
    "parentMessengerId" INTEGER NOT NULL,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParentMessenger_provider_externalId_idx" ON "ParentMessenger"("provider", "externalId");

-- CreateIndex
CREATE INDEX "ParentMessenger_parentId_idx" ON "ParentMessenger"("parentId");

-- CreateIndex
CREATE INDEX "ParentMessenger_organizationId_idx" ON "ParentMessenger"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentMessenger_provider_externalId_parentId_key" ON "ParentMessenger"("provider", "externalId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationOutbox_dedupeKey_key" ON "NotificationOutbox"("dedupeKey");

-- CreateIndex
-- Отбор дренажа: PENDING, которым подошёл срок.
CREATE INDEX "NotificationOutbox_status_nextAttemptAt_idx" ON "NotificationOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "NotificationOutbox_organizationId_idx" ON "NotificationOutbox"("organizationId");

-- AddForeignKey
ALTER TABLE "ParentMessenger" ADD CONSTRAINT "ParentMessenger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentMessenger" ADD CONSTRAINT "ParentMessenger_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_parentMessengerId_fkey" FOREIGN KEY ("parentMessengerId") REFERENCES "ParentMessenger"("id") ON DELETE CASCADE ON UPDATE CASCADE;
