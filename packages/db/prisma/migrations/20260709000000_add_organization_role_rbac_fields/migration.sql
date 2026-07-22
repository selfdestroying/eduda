-- AlterTable
ALTER TABLE "OrganizationRole" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "label" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationRole_organizationId_role_key" ON "OrganizationRole"("organizationId", "role");
