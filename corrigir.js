const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function corrigirInversao() {
  console.log("Iniciando a correção das colunas invertidas...");
  
  try {
    // Pega todos os itens do banco de dados
    const itens = await prisma.item.findMany();
    
    let contador = 0;

    for (const item of itens) {
      // Pega o valor que está na coluna errada
      let valorQueDeveriaSerRfid = item.numeroSerie;
      let valorQueDeveriaSerSerie = item.rfid;

      // Limpa a "blindagem" se ela tiver ido parar no lugar errado
      if (valorQueDeveriaSerRfid === "S/N" || valorQueDeveriaSerRfid === "NÃO INFORMADO") {
        valorQueDeveriaSerRfid = null;
      }
      if (!valorQueDeveriaSerSerie) {
        valorQueDeveriaSerSerie = "S/N";
      }

      // Atualiza o item invertendo os dois campos
      await prisma.item.update({
        where: { id: item.id },
        data: {
          rfid: valorQueDeveriaSerRfid,
          numeroSerie: valorQueDeveriaSerSerie
        }
      });
      
      contador++;
    }
    
    console.log(`✅ Sucesso! ${contador} itens foram corrigidos.`);
  } catch (erro) {
    console.error("❌ Ocorreu um erro:", erro.message);
  }
}

corrigirInversao()
  .catch(console.error)
  .finally(() => prisma.$disconnect());