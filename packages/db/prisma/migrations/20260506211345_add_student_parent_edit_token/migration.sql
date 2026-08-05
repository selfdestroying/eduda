-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "dataActual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dataActualizedAt" TIMESTAMP(3),
ADD COLUMN     "editToken" UUID;
