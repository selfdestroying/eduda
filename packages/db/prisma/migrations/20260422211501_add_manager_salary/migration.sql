-- CreateEnum
CREATE TYPE "PayCheckType" AS ENUM ('SALARY', 'BONUS', 'ADVANCE');

-- AlterTable
ALTER TABLE "PayCheck" ADD COLUMN     "type" "PayCheckType" NOT NULL DEFAULT 'SALARY';

-- CreateTable
CREATE TABLE "ManagerSalary" (
    "id" SERIAL NOT NULL,
    "monthlyAmount" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "ManagerSalary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagerSalary_userId_idx" ON "ManagerSalary"("userId");

-- CreateIndex
CREATE INDEX "ManagerSalary_organizationId_idx" ON "ManagerSalary"("organizationId");

-- AddForeignKey
ALTER TABLE "ManagerSalary" ADD CONSTRAINT "ManagerSalary_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerSalary" ADD CONSTRAINT "ManagerSalary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
