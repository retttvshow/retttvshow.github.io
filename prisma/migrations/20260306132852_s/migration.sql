-- DropForeignKey
ALTER TABLE "Historico" DROP CONSTRAINT "Historico_usuarioId_fkey";

-- AlterTable
ALTER TABLE "Historico" ADD COLUMN     "usuarioNome" TEXT,
ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Historico" ADD CONSTRAINT "Historico_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
