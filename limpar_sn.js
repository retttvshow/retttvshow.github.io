const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function limparSN() {
  console.log("🧹 Iniciando a limpeza dos patrimônios...");

  try {
    // Busca todos os itens que o patrimônio começa com "S/N -"
    const itensParaLimpar = await prisma.item.findMany({
      where: {
        patrimonio: {
          startsWith: 'S/N -'
        }
      }
    });

    console.log(`Encontrados ${itensParaLimpar.length} itens para limpar. Tentando alterar para 'S/N'...`);

    let sucesso = 0;
    let bloqueados = 0;

    // Tenta atualizar um por um
    for (const item of itensParaLimpar) {
      try {
        await prisma.item.update({
          where: { id: item.id },
          data: { patrimonio: 'S/N' }
        });
        sucesso++;
      } catch (erro) {
        // Se cair aqui, é porque o banco não aceita patrimônios repetidos (regra @unique)
        bloqueados++;
      }
    }

    console.log(`\n✅ RESULTADO:`);
    console.log(`➔ ${sucesso} itens alterados para 'S/N' com sucesso!`);
    
    if (bloqueados > 0) {
      console.log(`➔ ⚠️ ${bloqueados} itens foram bloqueados pelo banco.`);
      console.log(`   Motivo: O seu banco de dados exige que o patrimônio não se repita (regra @unique).`);
      console.log(`   Solução: Para esses itens, será necessário manter o número na frente ou cadastrar o patrimônio real.`);
    }

  } catch (erro) {
    console.error("❌ Ocorreu um erro inesperado:", erro.message);
  }
}

limparSN()
  .catch(console.error)
  .finally(() => prisma.$disconnect());