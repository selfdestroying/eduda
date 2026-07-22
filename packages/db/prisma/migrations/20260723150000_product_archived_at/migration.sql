-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Product_organizationId_archivedAt_idx" ON "Product"("organizationId", "archivedAt");
