/*
  Warnings:

  - You are about to drop the `Movimentacao` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Movimentacao" DROP CONSTRAINT "Movimentacao_itemId_fkey";

-- DropIndex
DROP INDEX "Item_patrimonio_key";

-- DropTable
DROP TABLE "Movimentacao";

-- CreateTable
CREATE TABLE "Historico" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "acao" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "campoAlterado" TEXT,
    "valorAntigo" TEXT,
    "valorNovo" TEXT,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Historico_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Historico" ADD CONSTRAINT "Historico_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
