-- CreateEnum
CREATE TYPE "WalletEntryKind" AS ENUM ('PURCHASE', 'CHARGE', 'REVERSAL', 'CANCELLATION', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "WalletEntry" (
    "id" SERIAL NOT NULL,
    "kind" "WalletEntryKind" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "effectiveAt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,
    "organizationId" INTEGER NOT NULL,
    "walletId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "paymentId" INTEGER,
    "actorUserId" INTEGER,
    "reversalOfId" INTEGER,
    "attendanceId" INTEGER,

    CONSTRAINT "WalletEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletEntry_reversalOfId_key" ON "WalletEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "WalletEntry_walletId_effectiveAt_idx" ON "WalletEntry"("walletId", "effectiveAt");

-- CreateIndex
CREATE INDEX "WalletEntry_organizationId_effectiveAt_idx" ON "WalletEntry"("organizationId", "effectiveAt");

-- CreateIndex
CREATE INDEX "WalletEntry_paymentId_idx" ON "WalletEntry"("paymentId");

-- CreateIndex
CREATE INDEX "WalletEntry_attendanceId_idx" ON "WalletEntry"("attendanceId");

-- CreateIndex
CREATE INDEX "WalletEntry_studentId_idx" ON "WalletEntry"("studentId");

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "WalletEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
