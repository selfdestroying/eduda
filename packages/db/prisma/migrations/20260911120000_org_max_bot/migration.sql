-- DropIndex
DROP INDEX "ParentMessenger_provider_externalId_parentId_key";

-- AlterTable
ALTER TABLE "ParentMessenger" ADD COLUMN     "ownBot" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OrganizationMaxBot" (
    "organizationId" INTEGER NOT NULL,
    "tokenEnc" BYTEA NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMaxBot_pkey" PRIMARY KEY ("organizationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentMessenger_provider_externalId_parentId_ownBot_key" ON "ParentMessenger"("provider", "externalId", "parentId", "ownBot");

-- AddForeignKey
ALTER TABLE "OrganizationMaxBot" ADD CONSTRAINT "OrganizationMaxBot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
