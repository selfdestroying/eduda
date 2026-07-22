/*
  Warnings:

  - A unique constraint covering the columns `[editToken]` on the table `Student` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Student_editToken_key" ON "Student"("editToken");
ALTER TABLE "Student" ALTER COLUMN "editToken" SET NOT NULL;
