-- CreateTable
CREATE TABLE "Item" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "patrimonio" TEXT NOT NULL,
    "numeroSerie" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "usuarioCriador" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "setor" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3),

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimentacao" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "usuario" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movimentacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_patrimonio_key" ON "Item"("patrimonio");

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
