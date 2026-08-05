-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "duration" INTEGER NOT NULL DEFAULT 60;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "duration" INTEGER NOT NULL DEFAULT 60;
