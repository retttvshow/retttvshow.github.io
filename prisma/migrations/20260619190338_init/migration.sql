-- DropForeignKey
ALTER TABLE "Historico" DROP CONSTRAINT "Historico_itemId_fkey";

-- AlterTable
ALTER TABLE "Historico" ALTER COLUMN "itemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "observacao" VARCHAR(150),
ADD COLUMN     "rfid" TEXT;

-- AddForeignKey
ALTER TABLE "Historico" ADD CONSTRAINT "Historico_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
