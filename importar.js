const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function importarCsv() {
  console.log("Iniciando a importação...");
  
  try {
    const usuarioAdmin = await prisma.usuario.findFirst();

    if (!usuarioAdmin) {
      console.log("❌ ERRO: Você precisa ter pelo menos um usuário cadastrado.");
      return;
    }

    console.log(`Usando o usuário '${usuarioAdmin.nome}' (ID: ${usuarioAdmin.id}) como criador.`);

    const dados = fs.readFileSync('inventario.csv', 'utf8');
    const linhas = dados.split('\n');
    const separador = linhas[0].includes(';') ? ';' : ',';
    
    for (let i = 1; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      if (!linha) continue; 
      
      const colunas = linha.split(separador);
      
      const nome = colunas[0] ? colunas[0].trim() : null;
      const patrimonio = colunas[1] ? colunas[1].trim() : null;
      const rfid = colunas[2] ? colunas[2].trim() : null;
      const numeroSerie = colunas[4] ? colunas[4].trim() : null;
      const setor = colunas[5] ? colunas[5].trim() : null;
      const responsavel = colunas[6] ? colunas[6].trim() : null;

      if (nome && nome !== "EQUIPAMENTO") {
        
        // BLINDAGEM CONTRA CAMPOS VAZIOS:
        const patrimonioFinal = patrimonio ? patrimonio : `S/N - ${i}`;
        const setorFinal = setor ? setor : "NÃO INFORMADO";
        const responsavelFinal = responsavel ? responsavel : "NÃO INFORMADO";
        const numeroSerieFinal = numeroSerie ? numeroSerie : "S/N";

        try {
          await prisma.item.create({
            data: {
              nome: nome,
              patrimonio: patrimonioFinal,
              rfid: rfid || null, 
              status: "ATIVO",
              numeroSerie: numeroSerieFinal,
              setor: setorFinal,
              responsavel: responsavelFinal,
              unidade: "SEDE",
              // CORREÇÃO AQUI: Passando apenas o número inteiro (ID) direto!
              usuarioCriador: usuarioAdmin.id
            }
          });
          console.log(`✅ Inserido: ${nome} (Patrimônio: ${patrimonioFinal})`);
        } catch (err) {
          console.error(`❌ Erro ao inserir ${nome}:`, err.message);
        }
      }
    }
    
    console.log("🎉 Importação concluída com sucesso!");
  } catch (erro) {
    console.error("❌ Erro ao ler o arquivo CSV.", erro.message);
  }
}

importarCsv()
  .catch(console.error)
  .finally(() => prisma.$disconnect());