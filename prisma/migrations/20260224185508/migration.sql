-- CreateIndex
CREATE INDEX "Rate_organizationId_idx" ON "Rate"("organizationId");

-- AddForeignKey
ALTER TABLE "Rate" ADD CONSTRAINT "Rate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
