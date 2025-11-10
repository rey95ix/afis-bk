/*
  Warnings:

  - A unique constraint covering the columns `[reset_password_token]` on the table `usuarios` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "reset_password_expires" TIMESTAMP(3),
ADD COLUMN     "reset_password_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_reset_password_token_key" ON "usuarios"("reset_password_token");
