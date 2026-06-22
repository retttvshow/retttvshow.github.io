/*
  Warnings:

  - Added the required column `responsavel` to the `Item` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `usuarioCriador` on the `Item` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `atualizadoEm` on table `Item` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "responsavel" TEXT NOT NULL,
DROP COLUMN "usuarioCriador",
ADD COLUMN     "usuarioCriador" INTEGER NOT NULL,
ALTER COLUMN "atualizadoEm" SET NOT NULL;
