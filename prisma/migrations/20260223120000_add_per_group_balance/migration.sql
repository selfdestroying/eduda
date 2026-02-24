-- AlterEnum
ALTER TYPE "StudentLessonsBalanceChangeReason" ADD VALUE 'BALANCE_REDISTRIBUTED';

-- AlterTable: Add financial fields to StudentGroup
ALTER TABLE "StudentGroup" ADD COLUMN "lessonsBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StudentGroup" ADD COLUMN "totalLessons" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StudentGroup" ADD COLUMN "totalPayments" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add groupId to Payment
ALTER TABLE "Payment" ADD COLUMN "groupId" INTEGER;

-- AlterTable: Add groupId to StudentLessonsBalanceHistory
ALTER TABLE "StudentLessonsBalanceHistory" ADD COLUMN "groupId" INTEGER;

-- CreateIndex
CREATE INDEX "Payment_groupId_idx" ON "Payment"("groupId");

-- CreateIndex
CREATE INDEX "StudentLessonsBalanceHistory_groupId_idx" ON "StudentLessonsBalanceHistory"("groupId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLessonsBalanceHistory" ADD CONSTRAINT "StudentLessonsBalanceHistory_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
