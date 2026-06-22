/*
  Warnings:

  - Made the column `unidade` on table `Usuario` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Historico" ADD COLUMN     "usuarioId" INTEGER;

-- AlterTable
ALTER TABLE "Usuario" ALTER COLUMN "unidade" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Historico" ADD CONSTRAINT "Historico_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
