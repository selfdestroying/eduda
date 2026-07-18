-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "walletId" INTEGER;

-- CreateIndex
CREATE INDEX "Attendance_walletId_idx" ON "Attendance"("walletId");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
