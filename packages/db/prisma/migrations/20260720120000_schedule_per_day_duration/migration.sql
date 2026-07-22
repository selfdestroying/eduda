-- AlterTable: move per-lesson duration from Group to GroupSchedule
ALTER TABLE "Group" DROP COLUMN "duration";

-- AlterTable
ALTER TABLE "GroupSchedule" ADD COLUMN "duration" INTEGER NOT NULL DEFAULT 60;
