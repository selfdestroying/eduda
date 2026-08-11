-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "amount" INTEGER,
ADD COLUMN     "paymentId" INTEGER,
ADD COLUMN     "price" INTEGER;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "remaining" INTEGER;

-- CreateIndex
CREATE INDEX "Attendance_paymentId_idx" ON "Attendance"("paymentId");

-- CreateIndex
CREATE INDEX "Payment_walletId_date_idx" ON "Payment"("walletId", "date");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
