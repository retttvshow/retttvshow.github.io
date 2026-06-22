/*
  Warnings:

  - You are about to drop the column `usuario` on the `Historico` table. All the data in the column will be lost.
  - Made the column `usuarioId` on table `Historico` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Historico" DROP CONSTRAINT "Historico_usuarioId_fkey";

-- AlterTable
ALTER TABLE "Historico" DROP COLUMN "usuario",
ALTER COLUMN "usuarioId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Historico" ADD CONSTRAINT "Historico_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
