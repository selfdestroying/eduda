-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "managerId" INTEGER;

-- CreateIndex
CREATE INDEX "Payment_managerId_idx" ON "Payment"("managerId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
