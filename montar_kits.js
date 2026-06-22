const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function montarKitsAutomaticamente() {
  console.log("🔍 Iniciando varredura inteligente de kits...\n");

  try {
    // 1. Pega todos os itens do banco de dados
    const todosItens = await prisma.item.findMany();

    // 2. Agrupa os itens pelo nome do responsável
    const itensPorResponsavel = {};
    for (const item of todosItens) {
      const dono = item.responsavel;
      // Ignora itens sem responsável definido
      if (!dono || dono === "NÃO INFORMADO") continue; 
      
      if (!itensPorResponsavel[dono]) {
        itensPorResponsavel[dono] = [];
      }
      itensPorResponsavel[dono].push(item);
    }

    let totalAtualizados = 0;

    // 3. Analisa o "inventário" de cada responsável individualmente
    for (const [responsavel, itens] of Object.entries(itensPorResponsavel)) {
      
      // Procura se ele tem um NTC PRO ou um Computador DATEN (ignorando letras maiúsculas/minúsculas)
      const ntcPro = itens.find(i => i.nome.toUpperCase().includes('NTC PRO'));
      // Procura DATEN, mas garante que não está pegando o "Monitor Daten" por engano
      const daten = itens.find(i => i.nome.toUpperCase().includes('DATEN') && !i.nome.toUpperCase().includes('MONITOR'));

      // === CENÁRIO 1: O usuário tem um NTC PRO ===
      if (ntcPro && ntcPro.patrimonio && !ntcPro.patrimonio.includes('S/N')) {
        // Pega todos os monitores LG dessa mesma pessoa
        const monitoresLg = itens.filter(i => i.nome.toUpperCase().includes('MONITOR LG'));
        
        if (monitoresLg.length > 0) {
          console.log(`👤 ${responsavel} possui um NTC PRO (Patrimônio: ${ntcPro.patrimonio}). Atualizando ${monitoresLg.length} Monitor(es) LG...`);
          
          let contador = 1;
          for (const monitor of monitoresLg) {
            const novoPatrimonio = `${ntcPro.patrimonio}-M${contador}`;
            await prisma.item.update({
              where: { id: monitor.id },
              data: { patrimonio: novoPatrimonio }
            });
            console.log(`   ➔ Monitor LG (Série: ${monitor.numeroSerie}) atualizado para: ${novoPatrimonio}`);
            contador++;
            totalAtualizados++;
          }
        }
      }

      // === CENÁRIO 2: O usuário tem um PC DATEN ===
      if (daten && daten.patrimonio && !daten.patrimonio.includes('S/N')) {
        // Pega todos os monitores DATEN dessa mesma pessoa
        const monitoresDaten = itens.filter(i => i.nome.toUpperCase().includes('MONITOR DATEN'));
        
        if (monitoresDaten.length > 0) {
          console.log(`👤 ${responsavel} possui um PC DATEN (Patrimônio: ${daten.patrimonio}). Atualizando ${monitoresDaten.length} Monitor(es) DATEN...`);
          
          let contador = 1;
          for (const monitor of monitoresDaten) {
            const novoPatrimonio = `${daten.patrimonio}-M${contador}`;
            await prisma.item.update({
              where: { id: monitor.id },
              data: { patrimonio: novoPatrimonio }
            });
            console.log(`   ➔ Monitor DATEN (Série: ${monitor.numeroSerie}) atualizado para: ${novoPatrimonio}`);
            contador++;
            totalAtualizados++;
          }
        }
      }
    }

    console.log(`\n🎉 Varredura concluída! ${totalAtualizados} monitores foram organizados em kits com sucesso.`);

  } catch (erro) {
    console.error("❌ Ocorreu um erro inesperado:", erro.message);
  }
}

montarKitsAutomaticamente()
  .catch(console.error)
  .finally(() => prisma.$disconnect());