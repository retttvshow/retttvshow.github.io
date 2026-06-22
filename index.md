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
// create_admin.js
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  const email = 'admin@local';
  const senha = 'Admin@1234';
  const hash = await bcrypt.hash(senha, 10);

  const user = await prisma.usuario.upsert({
    where: { email },
    update: { senha: hash, role: 'ADMIN' },
    create: {
      email,
      senha: hash,
      role: 'ADMIN',
      nome: 'Administrador',
      unidade: 'Administracao'
    },
  });

  console.log('Admin criado/atualizado:', user.email);
  console.log('Senha temporária:', senha);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Erro:', e);
  process.exit(1);
});
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
corrigirInversao()
const express = require("express");
const cors = require("cors");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// use sempre a mesma chave
const SECRET = process.env.JWT_SECRET || "123456"; 

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, role: usuario.role },
    SECRET,
    { expiresIn: "1h" }
  );
}

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Token não fornecido" });

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token inválido" });
    req.user = user; // { id, role }
    next();
  });
}

/* =========================
   CADASTRAR USUARIO
========================= */
app.post("/usuarios", autenticarToken, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Permissão negada" });
    }

    const { nome, email, role, unidade } = req.body;
    if (!nome || !email || !unidade) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }

    const novoUsuario = await prisma.usuario.create({
      data: { nome, email, role: role || "COMUM", unidade }
    });

    const linkAtivacao = `http://localhost:3000/ativar/${novoUsuario.id}`;
    res.json({ usuario: novoUsuario, linkAtivacao });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/usuarios/:id/definir-senha", async (req, res) => {
  const { id } = req.params;
  const { senha } = req.body;

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    await prisma.usuario.update({
      where: { id: Number(id) },
      data: { senha: senhaHash }
    });
    res.json({ message: "Senha definida com sucesso" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   LISTAR USUARIOS
========================= */
app.get("/usuarios", autenticarToken, async (req, res) => {
  try {
    if(req.user.role !== "ADMIN"){
      return res.status(403).json({ error: "Permissão negada. Apenas administradores podem visualizar usuários." });
    }

    const usuarios = await prisma.usuario.findMany({
      select: { id: true, nome: true, email: true, unidade: true, role: true }
    });
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   EDITAR USUARIO
========================= */
app.put("/usuarios/:id", autenticarToken, async (req, res) => {
  if(req.user.role !== "ADMIN"){
    return res.status(403).json({ error: "Permissão negada" });
  }

  const id = parseInt(req.params.id);
  const { nome, email, unidade, role } = req.body;

  try {
    const usuarioAtualizado = await prisma.usuario.update({
      where: { id },
      data: { nome, email, unidade, role }
    });
    res.json(usuarioAtualizado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar usuário" });
  }
});
/* =========================
   RESETAR SENHA
========================= */
app.put("/usuarios/:id/resetar-senha", autenticarToken, async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Permissão negada" });
  }

  try {
    const { id } = req.params;
    const { senha } = req.body;
    if (!senha) return res.status(400).json({ error: "Senha obrigatória" });

    const senhaHash = await bcrypt.hash(senha, 10);
    await prisma.usuario.update({
      where: { id: parseInt(id) },
      data: { senha: senhaHash }
    });

    res.json({ message: "Senha resetada com sucesso" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   LOGIN
========================= */
app.post("/auth/login", async (req, res) => {
  const { email, senha } = req.body;

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });

    if (!usuario) return res.status(400).json({ error: "Usuário não encontrado" });
    if (!usuario.senha) return res.status(400).json({ error: "Usuário ainda não ativou a conta" });

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) return res.status(400).json({ error: "Senha incorreta" });

    const token = gerarToken(usuario);
    res.json({ token, role: usuario.role, nome: usuario.nome });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro no login" });
  }
});

/* =========================
   EXCLUIR USUARIO
========================= */
app.delete("/itens/:id", autenticarToken, async (req, res) => {
  try {
    const itemId = Number(req.params.id);

    // 1. Buscar os dados do item ANTES de o apagar (para sabermos o que estamos a apagar)
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    
    if (!item) {
      return res.status(404).json({ error: "Item não encontrado" });
    }

    // 2. Apagar o item (O "Cascade" do Prisma vai apagar o histórico antigo todo automaticamente)
    await prisma.item.delete({ where: { id: itemId } });

    // 3. Criar a "Única Informação" de exclusão (Fica gravado no histórico geral)
    await prisma.historico.create({
      data: {
        acao: "EXCLUSAO DE ITEM",
        itemId: null, // Como o item foi apagado, isto fica nulo para não dar erro
        usuarioId: req.user.id, // ID de quem apagou (vem do token)
        campoAlterado: `Item apagado: ${item.nome} (Patrimônio: ${item.patrimonio || 'Sem registro'})`,
        dataHora: new Date()
      }
    });

    res.json({ message: "Item e histórico excluídos. Registro de exclusão salvo!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao excluir o item" });
  }
});

/* =========================
   LISTAR ITENS
========================= */
app.get("/itens", autenticarToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const itens = await prisma.item.findMany({
      skip: (page - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { id: "desc" }
    });
    res.json(itens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   CADASTRAR ITEM
========================= */
app.post("/itens", autenticarToken, async (req, res) => {
  try {
    const { nome, patrimonio, numeroSerie, rfid, unidade, setor, responsavel, status } = req.body;

    // Verifica se já existe patrimônio igual
    const patrimonioExistente = await prisma.item.findFirst({ where: { patrimonio } });
    if (patrimonioExistente) {
      return res.status(400).json({ error: "Número de patrimônio já cadastrado" });
    }

    // Verifica se já existe número de série igual
    const serieExistente = await prisma.item.findFirst({ where: { numeroSerie } });
    if (serieExistente) {
      return res.status(400).json({ error: "Número de série já cadastrado" });
    }


const novoItem = await prisma.item.create({
  data: {
    nome,
    patrimonio,
    numeroSerie,
    rfid,
    unidade,
    setor,
    responsavel,
    status,
    usuarioCriador: req.user.id
  }
});

// registra histórico logo após criar
await prisma.historico.create({
  data: {
    acao: "CADASTRO",
    campoAlterado: null,
    valorAntigo: null,
    valorNovo: `Item ${novoItem.nome} criado`,
    itemId: novoItem.id,
    usuarioId: req.user.id,
    usuarioNome: req.user.nome // snapshot
  }
});

res.json(novoItem);
} catch (err) {
  console.error(err);
  res.status(500).json({ error: "Erro ao cadastrar item" });
}
});

/* =========================
   ATUALIZAR ITEM
========================= */
app.put("/itens/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const dadosNovos = req.body;

    const itemAntigo = await prisma.item.findUnique({ where: { id: parseInt(id) } });

    // Ajuste para o campo inicioManutencao
    if (dadosNovos.status && dadosNovos.status !== itemAntigo.status) {
      if (dadosNovos.status === "MANUTENCAO") {
        dadosNovos.inicioManutencao = new Date(); // marca início da manutenção
      } else {
        dadosNovos.inicioManutencao = null; // limpa se saiu da manutenção
      }
    }

    const itemAtualizado = await prisma.item.update({
      where: { id: parseInt(id) },
      data: dadosNovos
    });

    // registra histórico para cada campo alterado
    for (const campo in dadosNovos) {
      if (itemAntigo[campo] !== dadosNovos[campo]) {
        await prisma.historico.create({
          data: {
            acao: "ALTERAÇÃO",
            campoAlterado: campo,
            valorAntigo: itemAntigo[campo]?.toString() || null,
            valorNovo: dadosNovos[campo]?.toString() || null,
            itemId: itemAtualizado.id,
            usuarioId: req.user.id,
            usuarioNome: req.user.nome
          }
        });
      }
    }

    res.json(itemAtualizado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar item" });
  }
});

/* =========================
   EXCLUIR ITEM
========================= */
app.delete("/itens/:id", autenticarToken, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Permissão negada. Apenas administradores podem excluir itens." });
    }

    const { id } = req.params;
    await prisma.item.delete({ where: { id: parseInt(id) } });
    res.json({ message: "Item excluído com sucesso" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao excluir item" });
  }
});

/* =========================
   LISTAR HISTÓRICOS
========================= */
app.get("/historicos", autenticarToken, async (req, res) => {
  try {
    const { patrimonio, numeroSerie } = req.query;

    // Lógica inteligente de filtro
    let filtro = {};

    if (patrimonio || numeroSerie) {
      // Como o seu front-end envia o mesmo valor para os dois, pegamos um deles
      const valorBusca = patrimonio || numeroSerie; 
      
      filtro = {
        OR: [
          { item: { patrimonio: valorBusca } },
          { item: { numeroSerie: valorBusca } },
          // A MÁGICA ESTÁ AQUI: Procurar o número também dentro do texto do histórico!
          { campoAlterado: { contains: valorBusca } } 
        ]
      };
    }

    const historicos = await prisma.historico.findMany({
      where: filtro,
      orderBy: { dataHora: "desc" },
      include: { item: true, usuarioRel: true }
    });

    // serializa dataHora para ISO
    const historicosFormatados = historicos.map(h => ({
      ...h,
      dataHora: h.dataHora ? h.dataHora.toISOString() : null
    }));

    res.json(historicosFormatados);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar históricos" });
  }
});

/* =========================
   LISTAR PATRIMONIOS (DASHBOARD)
========================= */
app.get("/patrimonios", autenticarToken, async (req, res) => {
  try {
    const { limit } = req.query;

    const itens = await prisma.item.findMany({
      take: limit ? Number(limit) : undefined,
      select: {
        id: true,
        nome: true,
        patrimonio: true,
        numeroSerie: true,
        unidade: true,
        setor: true,
        status: true,
        responsavel: true,
        criadoEm: true,
        atualizadoEm: true,
        inicioManutencao: true
      }
    });

    // formato esperado pelo dashboard.html
    res.json({ data: itens });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar patrimonios" });
  }
});
// Rota para servir a página HTML de ativação
app.get("/ativar/:id", (req, res) => {
  res.sendFile(path.join(__dirname,"public", "ativar.html"));
});
/* =========================
   SERVIDOR
========================= */
app.use(express.static(path.join(__dirname, "public")));
app.listen(3000, "0.0.0.0", () => {
  console.log("Servidor rodando em http://0.0.0.0:3000");
});

  .catch(console.error)
  .finally(() => prisma.$disconnect());
  <!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ativação de Conta</title>
  <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
  <link rel="stylesheet" href="style.css">
</head>
<body>

<div class="content">
  <h1>Ativação de Conta</h1>
  <div class="card">
    <h2>Defina sua senha</h2>
    <form id="formAtivacao">
      <input type="password" id="senha" placeholder="Digite sua nova senha" required>
      <button type="submit">Definir senha</button>
    </form>
  </div>
</div>

<script>
    
document.getElementById("formAtivacao").addEventListener("submit", async (e) => {
  e.preventDefault();
  const senha = document.getElementById("senha").value;

  // pega o id da URL (ex: /ativar/5)
  const userId = window.location.pathname.split("/").pop();

  try {
    await axios.post(`/usuarios/${userId}/definir-senha`, { senha });
    alert("Senha definida com sucesso! Agora você pode fazer login.");
    window.location.href = "/login.html";
  } catch(err){
    alert(err.response?.data?.error || "Erro ao definir senha");
  }
});
</script>

</body>
</html>
// auth.js
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("usuarioRole");
  const usuario = localStorage.getItem("usuarioNome");

  // Se não tiver token, redireciona para login
  if (!token) {
    alert("Você precisa estar logado para acessar esta página");
    window.location.href = "login.html";
    return;
  }

  // Configura axios para enviar token em todas as requisições
  axios.defaults.headers.common["Authorization"] = "Bearer " + token;

  // Mostra usuário logado no canto da tela
  const usuarioLogado = document.getElementById("usuarioLogado");
  if (usuarioLogado) {
    usuarioLogado.textContent = "Usuário: " + (usuario || "Não identificado");
  }

  // Esconde links de admin se não for ADMIN
  if (role !== "ADMIN") {
    const linkCadastro = document.querySelector('a[href="cadastro.html"]');
    const linkUsuarios = document.querySelector('a[href="usuarios.html"]');
    if (linkCadastro) linkCadastro.style.display = "none";
    if (linkUsuarios) linkUsuarios.style.display = "none";

    // Bloqueia acesso direto às páginas de admin
    const pagina = window.location.pathname;
    if (pagina.includes("cadastro.html") || pagina.includes("usuarios.html")) {
      alert("Acesso negado. Apenas administradores podem acessar esta página.");
      window.location.href = "index.html";
    }
  }

  // Botão logout
  const btnSair = document.querySelector(".user-info button");
  if (btnSair) {
    btnSair.addEventListener("click", () => {
      localStorage.clear();
      window.location.href = "login.html";
    });
  }
});
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Cadastro de Usuários</title>
<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
<link rel="stylesheet" href="style.css">
</head>
<body>

<div class="sidebar">
  <div class="menu">
    <h2>Inventário</h2>
    <a href="index.html">Dashboard</a>
    <a href="inventario.html">Inventário</a>
    <a href="historico.html">Histórico</a>
    <hr>
    <a href="cadastro.html">Cadastro de Usuário</a>
    <a href="usuarios.html">Usuários cadastrados</a>
  </div>
  <div class="user-info">
    <p id="usuarioLogado">Usuário: </p>
    <button>Sair</button>
  </div>
</div>

<div class="content">
  <h1>Cadastro de Usuários</h1>
  <div class="card">
    <h2>Criar Conta</h2>
    <input placeholder="Nome" id="nome">
    <input placeholder="Email" id="email">
    <!-- Campo de senha removido -->
    <select id="role">
      <option value="COMUM">Comum</option>
      <option value="ADMIN">Admin</option>
    </select>
    <input placeholder="Unidade" id="unidade">
    <button onclick="cadastrar()">Criar Conta</button>
    <button onclick="abrirUsuarios()">Usuários cadastrados</button>
  </div>
</div>

<script>
  axios.defaults.headers.common["Authorization"] = "Bearer " + localStorage.getItem("token");

async function cadastrar(){
  const nome = document.getElementById("nome").value;
  const email = document.getElementById("email").value;
  const role = document.getElementById("role").value;
  const unidade = document.getElementById("unidade").value;

  if(!nome || !email || !unidade){
    alert("Preencha todos os campos");
    return;
  }

  try {
    const res = await axios.post("/usuarios", { nome, email, role, unidade }, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    });

    // agora mostra o link de ativação junto com a mensagem
    alert("Conta criada com sucesso!\nLink de ativação: " + res.data.linkAtivacao);

    // limpa os campos
    document.getElementById("nome").value = "";
    document.getElementById("email").value = "";
    document.getElementById("role").value = "COMUM";
    document.getElementById("unidade").value = "";
  } catch(err){
    alert(err.response?.data?.error || "Erro ao criar conta");
  }
}

function abrirUsuarios(){ window.location.href = "usuarios.html"; }
</script>
<script src="auth.js"></script>
</body>
</html>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Sistema Inventário - Histórico</title>
<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
</head>
<body>

<div class="sidebar">
  <div class="menu">
    <h2>Inventário</h2>
    <a href="index.html">Dashboard</a>
    <a href="inventario.html">Inventário</a>
    <a href="historico.html">Histórico</a>
    <hr>
    <a href="cadastro.html">Cadastro de Usuário</a>
    <a href="usuarios.html">Usuários cadastrados</a>
  </div>
  <div class="user-info">
    <p id="usuarioLogado">Usuário: </p>
    <button>Sair</button>
  </div>
</div>

<div class="content">
  <h1>Histórico</h1>
  <div class="top-actions" style="flex-direction:row; justify-content:flex-start;">
    <input id="buscaPatrimonio" placeholder="Digite Patrimônio ou Nº Série" style="width:250px;">
    <button class="btn-primary" onclick="buscarHistorico()"><i class="fas fa-search"></i> Buscar Histórico</button>
  </div>
  <table class="tabela">
    <thead><tr><th>Ação</th><th>Usuário</th><th>Campo</th><th>Valor Antigo</th><th>Valor Novo</th><th>Data/Hora</th></tr></thead>
    <tbody id="tabelaHistorico"></tbody>
  </table>
</div>

<script>
  
axios.defaults.headers.common["Authorization"] = "Bearer " + localStorage.getItem("token");
async function buscarHistorico(){
  const valor = document.getElementById("buscaPatrimonio").value.trim();
  if(!valor){ 
    alert("Digite um patrimônio ou número de série."); 
    return; 
  }
  try {
    const res = await axios.get("/historicos", { 
      params: { patrimonio: valor, numeroSerie: valor },
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    });
    const dados = res.data || [];
    const tabela = document.getElementById("tabelaHistorico");
    tabela.innerHTML = dados.length === 0 
      ? `<tr><td colspan="6">Nenhum histórico encontrado.</td></tr>` 
      : "";
    dados.forEach(h => {
  tabela.innerHTML += `<tr>
    <td>${h.acao}</td>
    <td>${h.usuarioRel?.nome || h.usuarioNome || "-"}</td>
    <td>${h.campoAlterado || "-"}</td>
    <td>${h.valorAntigo || "-"}</td>
    <td>${h.valorNovo || "-"}</td>
    <td>${h.dataHora ? new Date(h.dataHora).toLocaleString("pt-BR") : "-"}</td>
  </tr>`;
});

  } catch(err){ 
    console.error(err.response?.data);
    alert(err.response?.data?.error || "Erro ao buscar histórico."); 
  }
}
// dispara busca ao pressionar Enter
document.getElementById("buscaPatrimonio").addEventListener("keypress", function(e) {
  if (e.key === "Enter") {
    buscarHistorico();
  }
});

</script>
<script src="auth.js"></script>
</body>
</html>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Sistema Inventário - Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Orbitron:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
</head>
<body>

<div class="sidebar">
  <div class="menu">
    <h2>Inventário</h2>
    <a href="index.html">Dashboard</a>
    <a href="inventario.html">Inventário</a>
    <a href="historico.html">Histórico</a>
    <hr>
    <a href="cadastro.html">Cadastro de Usuário</a>
    <a href="usuarios.html">Usuários cadastrados</a>
  </div>
  <div class="user-info">
    <p id="usuarioLogado">Usuário: </p>
    <button>Sair</button>
  </div>
</div>

<div class="content">
  <h1>Dashboard</h1>
  <!-- Cards resumo -->
  <div class="dashboard">
    <div class="card"><h3>Total Ativos</h3><div id="totalAtivos">0</div></div>
    <div class="card"><h3>Total Estoque</h3><div id="totalEstoque">0</div></div>
    <div class="card"><h3>Total Manutenção</h3><div id="totalManutencao">0</div></div>
  </div>
  <!-- Gráficos -->
  <div class="dashboard-charts">
    <div class="chart"><canvas id="graficoStatus"></canvas></div>
    <div class="chart"><canvas id="graficoUnidade"></canvas></div>
    <div class="chart"><canvas id="graficoSetor"></canvas></div>
    <div class="chart"><canvas id="graficoTempoManutencao"></canvas></div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>

<!-- Carregue primeiro o auth.js -->
<script src="auth.js"></script>

<script>
function formatarNumero(valor){
  if(valor >= 1000000) return (valor/1000000).toFixed(1)+"M";
  if(valor >= 1000) return (valor/1000).toFixed(1)+"k";
  return valor;
}

async function carregarDashboard(){
  try {
    // 👇 ADICIONE ESTAS DUAS LINHAS AQUI 👇
    const token = localStorage.getItem("token");
    axios.defaults.headers.common["Authorization"] = "Bearer " + token;

    // Agora sim o pedido vai com o token garantido!
    const res = await axios.get("/patrimonios?limit=10000");
    const itens = res.data.data || [];

    let ativos = 0, estoque = 0, manutencao = 0;
    let unidadeCount = {}, setorCount = {};

    itens.forEach(item=>{
      if(item.status === "ATIVO") ativos++;
      if(item.status === "ESTOQUE") estoque++;
      if(item.status === "MANUTENCAO") manutencao++;
      unidadeCount[item.unidade] = (unidadeCount[item.unidade] || 0) + 1;
      setorCount[item.setor] = (setorCount[item.setor] || 0) + 1;
    });

    document.getElementById("totalAtivos").innerText = ativos;
    document.getElementById("totalEstoque").innerText = estoque;
    document.getElementById("totalManutencao").innerText = manutencao;

    // Gráficos principais
    new Chart(document.getElementById("graficoStatus"), {
      type:"pie",
      data:{ 
        labels:["Ativos","Estoque","Manutenção"], 
        datasets:[{ data:[ativos,estoque,manutencao], backgroundColor:["#22c55e","#f59e0b","#ef4444"] }] 
      }, 
      options:{ responsive:true, maintainAspectRatio:false }
    });

    new Chart(document.getElementById("graficoUnidade"), {
      type:"bar",
      data:{ 
        labels:Object.keys(unidadeCount), 
        datasets:[{ label:"Por Unidade", data:Object.values(unidadeCount), backgroundColor:"#3b82f6" }] 
      }, 
      options:{ responsive:true, maintainAspectRatio:false }
    });

    new Chart(document.getElementById("graficoSetor"), {
      type:"bar",
      data:{ 
        labels:Object.keys(setorCount), 
        datasets:[{ label:"Por Setor", data:Object.values(setorCount), backgroundColor:"#a855f7" }] 
      }, 
      options:{ responsive:true, maintainAspectRatio:false }
    });

    // Gráfico de tempo em manutenção
    let manutencaoDuracoes = [];
    let manutencaoLabels = [];

    itens.forEach((item, i) => {
      if(item.status === "MANUTENCAO" && item.inicioManutencao){
        const dias = Math.floor((Date.now() - new Date(item.inicioManutencao)) / (1000*60*60*24));
        manutencaoDuracoes.push(dias);
        manutencaoLabels.push(item.nome || ("Item " + (i+1)));
      }
    });

    if(manutencaoDuracoes.length > 0){
      new Chart(document.getElementById("graficoTempoManutencao"), {
        type: "bar",
        data: {
          labels: manutencaoLabels,
          datasets: [{
            label: "Dias em manutenção",
            data: manutencaoDuracoes,
            backgroundColor: "#ef4444"
          }]
        },
        options: { responsive:true, maintainAspectRatio:false }
      });
    }
  } catch (err) {
    alert(err.response?.data?.error || "Erro ao carregar dashboard");
  }
}
carregarDashboard();
</script>
</body>
</html>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Sistema Inventário - Inventário</title>
<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
</head>
<body>

<div class="sidebar">
  <div class="menu">
    <h2>Inventário</h2>
    <a href="index.html">Dashboard</a>
    <a href="inventario.html">Inventário</a>
    <a href="historico.html">Histórico</a>
    <hr>
    <a href="cadastro.html">Cadastro de Usuário</a>
    <a href="usuarios.html">Usuários cadastrados</a>
  </div>
  <div class="user-info">
    <p id="usuarioLogado">Usuário: </p>
    <button onclick="logout()">Sair</button>
  </div>
</div>

<div class="content">
  <h1>Inventário</h1>

  <!-- Botões superiores -->
  <div class="top-actions" style="display:flex; gap:10px; justify-content:flex-end;">
    <button class="btn-primary" onclick="abrirModalCadastro()"><i class="fas fa-plus-circle"></i> Novo Item</button>
    <button class="btn-secondary" onclick="abrirModalFiltro()"><i class="fas fa-filter"></i> Filtrar Itens</button>
    <button class="btn-secondary" onclick="limparFiltro()"><i class="fas fa-eraser"></i> Limpar Filtro</button>
  </div>

  <!-- Tabela -->
  <table class="tabela">
    <thead>
      <tr>
        <th>Nome</th>
        <th>Patrimônio</th>
        <th>Série</th>
        <th>RFID</th>
        <th>Unidade</th>
        <th>Responsável</th>
        <th>Status</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody id="tabela"></tbody>
  </table>

  <!-- Paginação -->
  <div class="pagination">
    <button onclick="paginaAnterior()" class="btn-secondary"><i class="fas fa-arrow-left"></i> Anterior</button>
    <span id="paginaInfo"></span>
    <button onclick="proximaPagina()" class="btn-secondary">Próxima <i class="fas fa-arrow-right"></i></button>
    <select id="limitSelect" onchange="alterarLimite()">
      <option value="20">20 por página</option>
      <option value="50">50 por página</option>
      <option value="100">100 por página</option>
    </select>
  </div>
</div>

<!-- Modal Cadastro -->
<div id="modalCadastro" class="modal">
  <div class="modal-content">
    <h3><i class="fas fa-plus-circle"></i> Novo Item</h3>
    <input placeholder="Nome" id="nome">
    <input placeholder="Patrimônio" id="patrimonio">
    <input placeholder="Número Série" id="numeroSerie">
    <input id="rfid" placeholder="RFID">
    <input placeholder="Unidade" id="unidade">
    <input placeholder="Responsável" id="responsavel">
    <select id="status">
      <option value="ATIVO">Ativo</option>
      <option value="ESTOQUE">Estoque</option>
      <option value="MANUTENCAO">Manutenção</option>
    </select>
    <div class="modal-actions">
      <button class="btn-primary" onclick="cadastrar()"><i class="fas fa-save"></i> Salvar</button>
      <button class="btn-secondary" onclick="fecharModalCadastro()"><i class="fas fa-times"></i> Cancelar</button>
    </div>
  </div>
</div>

<!-- Modal Filtro -->
<div id="modalFiltro" class="modal">
  <div class="modal-content">
    <h3><i class="fas fa-filter"></i> Filtrar Itens</h3>
    <input placeholder="Patrimônio" id="filtroPatrimonio">
    <input placeholder="Número Série" id="filtroNumeroSerie">
    <input placeholder="Unidade" id="filtroUnidade">
    <input placeholder="Responsável" id="filtroResponsavel">
    <div class="modal-actions">
      <button class="btn-primary" onclick="carregar()"><i class="fas fa-search"></i> Aplicar</button>
      <button class="btn-secondary" onclick="fecharModalFiltro()"><i class="fas fa-times"></i> Fechar</button>
    </div>
  </div>
</div>
<!-- Modal Editar -->
<div id="modalEditar" class="modal">
  <div class="modal-content">
    <h3><i class="fas fa-edit"></i> Editar Item</h3>
    <input id="editNome" placeholder="Nome">
    <input id="editPatrimonio" placeholder="Patrimônio">
    <input id="editNumeroSerie" placeholder="Número Série">
    <input id="editRfid" placeholder="RFID">
    <input id="editUnidade" placeholder="Unidade">
    <select id="editStatus">
      <option value="ATIVO">Ativo</option>
      <option value="ESTOQUE">Estoque</option>
      <option value="MANUTENCAO">Manutenção</option>
    </select>
    
    <input id="infoOldObservacao" readonly style="display: none; background-color: #eee; color: #555; border: 1px dashed #999;" title="Motivo pelo qual entrou em manutenção">
    
    <input id="editObservacao" placeholder="Observação de Manutenção (Máx 150 caracteres)" maxlength="150" style="display: none;">
    <div class="modal-actions">
      <button class="btn-primary" onclick="salvarEdicao()"><i class="fas fa-save"></i> Salvar</button>
      <button class="btn-secondary" onclick="fecharModalEditar()"><i class="fas fa-times"></i> Cancelar</button>
    </div>
  </div>
</div>

<script>
  axios.defaults.headers.common["Authorization"] = "Bearer " + localStorage.getItem("token");

let paginaAtual = 1, limite = 20, totalRegistros = 0;
let itemEditando = null, itensCache = [];

axios.defaults.headers.common["Authorization"] = "Bearer " + localStorage.getItem("token");

async function carregar(){
  const patrimonio = document.getElementById("filtroPatrimonio")?.value || "";
  const numeroSerie = document.getElementById("filtroNumeroSerie")?.value || "";
  const unidade = document.getElementById("filtroUnidade")?.value || "";
  const responsavel = document.getElementById("filtroResponsavel")?.value || "";

  const res = await axios.get(`/itens`,{ params:{ page: paginaAtual, limit: limite, patrimonio, numeroSerie, unidade, responsavel } });
  itensCache = res.data; // backend retorna lista simples
  totalRegistros = itensCache.length; // ajuste simples
  const tabela = document.getElementById("tabela"); 
  tabela.innerHTML="";
  
  if(itensCache.length > 0){
    itensCache.forEach(p=>{
      tabela.innerHTML+=`<tr>
        <td>${p.nome}</td>
        <td>${p.patrimonio || "-"}</td>
        <td>${p.rfid || "-"}</td> <td>${p.numeroSerie || "-"}</td>
        <td>${p.unidade || "-"}</td>
        <td>${p.responsavel || "-"}</td>
        <td>${formatarStatus(p.status)}</td>
        <td>
          <button class="btn-edit" onclick="abrirModalEditar(${p.id})"><i class="fas fa-edit"></i></button>
          <button class="btn-delete" onclick="excluir(${p.id})"><i class="fas fa-trash"></i></button>
        </td></tr>`;
    });
    fecharModalFiltro();
  } else { 
    alert("Nenhum item encontrado."); 
  }
  document.getElementById("paginaInfo").innerText = `Página ${paginaAtual}`;
}
function formatarStatus(status){ return status==="ATIVO"?"Ativo":status==="ESTOQUE"?"Estoque":status==="MANUTENCAO"?"Manutenção":status; }
function proximaPagina(){ paginaAtual++; carregar(); }
function paginaAnterior(){ if(paginaAtual > 1){ paginaAtual--; carregar(); } }
function alterarLimite(){ limite = parseInt(document.getElementById("limitSelect").value); paginaAtual = 1; carregar(); }

async function cadastrar(){
  const nome = document.getElementById("nome").value;
  const patrimonio = document.getElementById("patrimonio").value;
  const numeroSerie = document.getElementById("numeroSerie").value;
  const rfid = document.getElementById("rfid").value;
  const unidade = document.getElementById("unidade").value;
  const responsavel = document.getElementById("responsavel").value;
  const status = document.getElementById("status").value;

  try {
    await axios.post("/itens",
      { nome, patrimonio, numeroSerie, rfid, unidade, responsavel, status },
      { headers: { Authorization: "Bearer " + localStorage.getItem("token") } }
    );
    fecharModalCadastro();
    carregar();
    alert("Item cadastrado com sucesso!");
  } catch(err){
    console.error(err.response?.data);
    alert(err.response?.data?.error || "Erro ao cadastrar");
  }
}

async function excluir(id){ 
  if(localStorage.getItem("usuarioRole") !== "ADMIN"){
    alert("Apenas administradores podem excluir itens");
    return;
  }
  if(confirm("Deseja realmente excluir este item?")){
    try {
      await axios.delete(`/itens/${id}`, { headers: { Authorization: "Bearer " + localStorage.getItem("token") } });
      carregar();
    } catch(err){ alert(err.response?.data?.error || "Erro ao excluir item"); }
  }
}

function abrirModalEditar(id){
  itemEditando = id;
  const p = itensCache.find(x => x.id === id);
  if(!p){ alert("Item não encontrado"); return; }
  
  document.getElementById("editNome").value = p.nome;
  document.getElementById("editPatrimonio").value = p.patrimonio || "";
  document.getElementById("editNumeroSerie").value = p.numeroSerie || "";
  document.getElementById("editRfid").value = p.rfid || "";
  document.getElementById("editUnidade").value = p.unidade || "";
  document.getElementById("editStatus").value = p.status;
  
  const obsInput = document.getElementById("editObservacao");
  const oldObsInput = document.getElementById("infoOldObservacao"); // O campo cinza
  
  // Reseta os campos para não herdar de cliques anteriores
  oldObsInput.style.display = "none";
  oldObsInput.value = "";
  
  if (p.status === "MANUTENCAO") {
    obsInput.style.display = "block";
    obsInput.value = p.observacao || ""; 
    obsInput.placeholder = "Observação atual";
  } else {
    obsInput.style.display = "none";
    obsInput.value = "";
  }
  
  document.getElementById("modalEditar").style.display="flex";
}
function fecharModalEditar(){ document.getElementById("modalEditar").style.display="none"; itemEditando=null; }

async function salvarEdicao(){
  if(!itemEditando) return;
  
  const nome = document.getElementById("editNome").value;
  const patrimonio = document.getElementById("editPatrimonio").value;
  const numeroSerie = document.getElementById("editNumeroSerie").value;
  const unidade = document.getElementById("editUnidade").value;
  const status = document.getElementById("editStatus").value; // NOVO status selecionado
  const rfid = document.getElementById("editRfid").value;
  const observacao = document.getElementById("editObservacao").value;
  
  // --- NOVA TRAVA DE SEGURANÇA (OBRIGATÓRIO) ---
  const itemOriginal = itensCache.find(x => x.id === itemEditando);
  const statusOriginal = itemOriginal ? itemOriginal.status : "";

  // 1. Se está ENTRANDO em manutenção
  if (status === "MANUTENCAO" && statusOriginal !== "MANUTENCAO" && observacao.trim() === "") {
    alert("Atenção: É obrigatório informar o DEFEITO/MOTIVO para enviar o item à manutenção.");
    return; // Interrompe e não salva
  }

  // 2. Se está SAINDO da manutenção
  if (statusOriginal === "MANUTENCAO" && status !== "MANUTENCAO" && observacao.trim() === "") {
    alert("Atenção: É obrigatório informar o LAUDO (o que foi consertado) antes de retirar da manutenção.");
    return; // Interrompe e não salva
  }
  // --------------------------------------------

  try {
    await axios.put(`/itens/${itemEditando}`, { 
      nome, patrimonio, numeroSerie, rfid, unidade, status, observacao 
    }, { 
      headers: { Authorization: "Bearer " + localStorage.getItem("token") } 
    });
    
    fecharModalEditar(); 
    carregar(); 
    alert("Item atualizado com sucesso!");
  } catch(err){ 
    alert(err.response?.data?.error || "Erro ao salvar edição"); 
  }
}

/* Controle dos modais */
function abrirModalCadastro(){ document.getElementById("modalCadastro").style.display="flex"; }
function fecharModalCadastro(){ document.getElementById("modalCadastro").style.display="none"; }
function abrirModalFiltro(){ document.getElementById("modalFiltro").style.display="flex"; }
function fecharModalFiltro(){ document.getElementById("modalFiltro").style.display="none"; }
function limparFiltro(){ document.getElementById("filtroPatrimonio").value=""; document.getElementById("filtroNumeroSerie").value=""; document.getElementById("filtroUnidade").value=""; document.getElementById("filtroResponsavel").value=""; carregar(); }

carregar();

/* Ajustes de Enter */
document.querySelectorAll("#modalCadastro input, #modalCadastro select").forEach((input, index, arr) => {
  input.addEventListener("keypress", e => { if(e.key==="Enter"){ e.preventDefault(); const next=arr[index+1]; next?next.focus():cadastrar(); } });
});
document.querySelectorAll("#modalFiltro input").forEach(input => {
  input.addEventListener("keypress", e => { if(e.key==="Enter"){ e.preventDefault(); carregar(); } });
});
document.querySelectorAll("#modalEditar input, #modalEditar select").forEach((input, index, arr) => {
  input.addEventListener("keypress", e => { if(e.key==="Enter"){ e.preventDefault(); const next=arr[index+1]; next?next.focus():salvarEdicao(); } });
});
// Lógica para mostrar/esconder campos e exibir a observação antiga
document.getElementById("editStatus").addEventListener("change", function(e) {
  if(!itemEditando) return;
  const itemOriginal = itensCache.find(x => x.id === itemEditando);
  const statusOriginal = itemOriginal ? itemOriginal.status : "";
  const novoStatus = e.target.value;

  const obsInput = document.getElementById("editObservacao");
  const oldObsInput = document.getElementById("infoOldObservacao");

  if (statusOriginal === "MANUTENCAO" && novoStatus !== "MANUTENCAO") {
    // CENÁRIO 1: Tirando da Manutenção
    oldObsInput.style.display = "block";
    oldObsInput.value = "Defeito relatado: " + (itemOriginal.observacao || "Não informado");
    
    obsInput.style.display = "block";
    obsInput.placeholder = "Obrigatório: O que foi feito? (Laudo)";
    obsInput.value = ""; // Limpa para forçar o usuário a digitar a nova!
  } 
  else if (statusOriginal !== "MANUTENCAO" && novoStatus === "MANUTENCAO") {
    // CENÁRIO 2: Colocando na Manutenção
    oldObsInput.style.display = "none";
    
    obsInput.style.display = "block";
    obsInput.placeholder = "Obrigatório: Qual o defeito? (Motivo)";
    obsInput.value = "";
  } 
  else if (statusOriginal === "MANUTENCAO" && novoStatus === "MANUTENCAO") {
    // CENÁRIO 3: Já estava em manutenção, apenas abriu pra olhar
    oldObsInput.style.display = "none";
    
    obsInput.style.display = "block";
    obsInput.placeholder = "Observação de Manutenção";
    obsInput.value = itemOriginal.observacao || "";
  } 
  else {
    // CENÁRIO 4: Movendo de Ativo para Estoque, etc.
    oldObsInput.style.display = "none";
    obsInput.style.display = "none";
    obsInput.value = "";
  }
});
</script>
<script src="auth.js"></script>
</body>
</html>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Login</title>
<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="card">
  <h2>Login</h2>
 <input id="email" type="text" placeholder="Email">
<input id="senha" type="password" placeholder="Senha">
<button onclick="login()">Entrar</button>

<script>
  axios.defaults.headers.common["Authorization"] = "Bearer " + localStorage.getItem("token");

async function login(){
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  if(!email || !senha){ alert("Preencha todos os campos"); return; }
  try {
    const res = await axios.post("/auth/login", { email, senha });
    localStorage.setItem("token", res.data.token);
    localStorage.setItem("usuarioRole", res.data.role);
    localStorage.setItem("usuarioNome", res.data.nome || email);
    window.location.href = "index.html";
  } catch(err){ 
    alert(err.response?.data?.error || "Erro ao fazer login"); 
  }
}

// 🔑 Captura Enter no campo de senha
document.getElementById("senha").addEventListener("keypress", function(e) {
  if (e.key === "Enter") {
    login(); // chama a função correta
  }
});
</script>

</body>
</html>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Usuários cadastrados</title>
<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
<link rel="stylesheet" href="style.css">
</head>
<body>

<div class="sidebar">
  <div class="menu">
    <h2>Inventário</h2>
    <a href="index.html">Dashboard</a>
    <a href="inventario.html">Inventário</a>
    <a href="historico.html">Histórico</a>
    <hr>
    <a href="cadastro.html">Cadastro de Usuário</a>
    <a href="usuarios.html">Usuários cadastrados</a>
  </div>
  <div class="user-info">
    <p id="usuarioLogado">Usuário: </p>
    <button>Sair</button>
  </div>
</div>

<div class="content">
  <h1>Usuários cadastrados</h1>
  <table id="tabelaUsuarios">
    <thead>
      <tr>
        <th>Nome</th>
        <th>Email</th>
        <th>Unidade</th>
        <th>Tipo de Conta</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody></tbody>
  </table>
</div>

<!-- Modal Resetar Senha -->
<div id="modalResetar" class="modal">
  <div class="modal-content">
    <h2>Resetar Senha</h2>
    <input type="password" id="novaSenha" placeholder="Nova senha">
    <input type="password" id="confirmarSenha" placeholder="Confirmar senha">
    <button onclick="confirmarReset()">Confirmar</button>
    <button onclick="fecharModal()">Cancelar</button>
  </div>
</div>

<!-- Modal Editar Usuário -->
<div id="modalEditar" class="modal">
  <div class="modal-content">
    <h2>Editar Usuário</h2>
    <input type="text" id="editNome" placeholder="Nome">
    <input type="text" id="editEmail" placeholder="Email">
    <input type="text" id="editUnidade" placeholder="Unidade">
    <select id="editRole">
      <option value="COMUM">Comum</option>
      <option value="ADMIN">Administrador</option>
    </select>
    <button onclick="confirmarEdicao()">Salvar</button>
    <button onclick="fecharModalEditar()">Cancelar</button>
  </div>
</div>
<script>
  axios.defaults.headers.common["Authorization"] = "Bearer " + localStorage.getItem("token");

let usuarios = [], usuarioSelecionado = null, usuarioEditando = null;

async function carregarUsuarios(){
  try {
    const res = await axios.get("/usuarios", { headers: { Authorization: "Bearer " + localStorage.getItem("token") } });
    usuarios = res.data;
    const tbody = document.querySelector("#tabelaUsuarios tbody");
    tbody.innerHTML = "";
    usuarios.forEach(u => {
      tbody.innerHTML += `<tr>
        <td>${u.nome}</td>
        <td>${u.email}</td>
        <td>${u.unidade}</td>
        <td>${u.role === 'ADMIN' ? 'Administrador' : 'Comum'}</td>
        <td>
          <button onclick="resetarSenha(${u.id})" class="btn-secondary">Resetar Senha</button>
          <button onclick="excluirUsuario(${u.id})" class="btn-delete">Excluir</button>
          <button onclick="editarUsuario(${u.id})" class="btn-edit">Editar</button>
        </td>
      </tr>`;
    });
  } catch(err){ alert("Erro ao carregar usuários"); }
}

function resetarSenha(id){ usuarioSelecionado = id; document.getElementById("modalResetar").style.display="flex"; }
function fecharModal(){ document.getElementById("modalResetar").style.display="none"; usuarioSelecionado=null; }

async function confirmarReset(){
  const novaSenha = document.getElementById("novaSenha").value;
  const confirmar = document.getElementById("confirmarSenha").value;
  if(!novaSenha || !confirmar){ alert("Preencha os campos"); return; }
  if(novaSenha !== confirmar){ alert("As senhas não conferem"); return; }
  try {
    await axios.put(`/usuarios/${usuarioSelecionado}/resetar-senha`, { senha: novaSenha }, { headers: { Authorization: "Bearer " + localStorage.getItem("token") } });
    alert("Senha resetada com sucesso!"); fecharModal();
  } catch(err){ alert("Erro ao resetar senha"); }
}

function editarUsuario(id){
  usuarioEditando = id;
  const usuario = usuarios.find(u => u.id === id);
  if(usuario){
    document.getElementById("editNome").value = usuario.nome;
    document.getElementById("editEmail").value = usuario.email;
    document.getElementById("editUnidade").value = usuario.unidade;
    document.getElementById("editRole").value = usuario.role;
  }
  document.getElementById("modalEditar").style.display="flex";
}
function fecharModalEditar(){ document.getElementById("modalEditar").style.display="none"; usuarioEditando=null; }

async function confirmarEdicao(){
  const nome = document.getElementById("editNome").value;
  const email = document.getElementById("editEmail").value;
  const unidade = document.getElementById("editUnidade").value;
  const role = document.getElementById("editRole").value;
  try {
    await axios.put(`/usuarios/${usuarioEditando}`, { nome, email, unidade, role }, { headers: { Authorization: "Bearer " + localStorage.getItem("token") } });
    alert("Usuário atualizado com sucesso!"); fecharModalEditar(); carregarUsuarios();
  } catch(err){ alert("Erro ao atualizar usuário"); }
}

async function excluirUsuario(id){
  if(!confirm("Tem certeza que deseja excluir este usuário?")) return;
  try {
    await axios.delete(`/usuarios/${id}`, { headers: { Authorization: "Bearer " + localStorage.getItem("token") } });
    alert("Usuário excluído com sucesso!"); carregarUsuarios();
  } catch(err){ alert("Erro ao excluir usuário"); }
}

carregarUsuarios();
</script>
<script src="auth.js"></script>
</body>
</html>
/* Importando fontes modernas */
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Orbitron:wght@500;700&display=swap');

/* Tema azul noturno */
body {
  margin: 0;
  font-family: 'Poppins', sans-serif;
  background: #0f172a;
  color: #f1f5f9;
}

/* Sidebar */
.sidebar {
  width: 220px;
  background: #1e293b;
  color: #f1f5f9;
  position: fixed;
  top: 0; left: 0; bottom: 0;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.sidebar h2 {
  margin-bottom: 20px;
  font-family: 'Orbitron', sans-serif;
  font-size: 1.4rem;
  font-weight: 700;
  color: #38bdf8;
}
.sidebar a {
  display: block;
  color: #cbd5e1;
  text-decoration: none;
  margin: 10px 0;
  font-weight: 600;
}
.sidebar a:hover { color: #ffffff; }

/* User info */
.user-info {
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid #334155;
}
.user-info p {
  margin: 0 0 10px;
  color: #f1f5f9;
  font-size: 14px;
}
.user-info button {
  background: #ef4444;
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}
.user-info button:hover { background: #dc2626; }

/* Conteúdo */
.content {
  margin-left: 240px;
  padding: 20px 40px 20px 20px;
}
.content h1 {
  font-family: 'Orbitron', sans-serif;
  font-size: 2rem;
  font-weight: 700;
  color: #38bdf8;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 20px;
}

/* Botões */
.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
}
.btn-primary:hover { background: #1e40af; }
.btn-secondary {
  background: #64748b;
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
}
.btn-secondary:hover { background: #475569; }
.btn-edit {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.btn-edit:hover { background: #1e40af; }
.btn-delete {
  background: #dc2626;
  color: white;
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.btn-delete:hover { background: #991b1b; }
/* Tabela */
.tabela {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}
.tabela th, .tabela td {
  border: 1px solid #334155;
  padding: 8px;
  text-align: left;
}
.tabela th {
  background: #3b82f6;
  color: #f1f5f9;
  font-weight: 700;
}
.tabela tr:nth-child(even) { background: #1e293b; }
.tabela tr:hover { background: #334155; }

/* Paginação */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
}
.pagination button {
  background: #3b82f6;
  color: #fff;
  border: none;
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
}
.pagination button:hover { background: #2563eb; }
.pagination span { font-weight: 600; color: #f1f5f9; }
.pagination select {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #3b82f6;
  background: #1e293b;
  color: #f1f5f9;
  cursor: pointer;
}
.pagination select:hover { border-color: #2563eb; }

/* Modais */
.modal {
  display: none;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background: #1e293b;
  color: #f1f5f9;
  padding: 20px;
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
  animation: fadeIn 0.3s ease;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 15px;
}

/* Inputs */
input, select {
  width: 100%;
  padding: 10px;
  margin: 8px 0;
  border: 1px solid #334155;
  border-radius: 6px;
  background: #0f172a;
  color: #f1f5f9;
}
input:focus, select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59,130,246,0.3);
}
/* Cartões (login, cadastro, etc.) */
.card {
  background: #1e293b;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.5);
  width: 100%;
  max-width: 500px;
  text-align: center;
  margin: 40px auto;
}
.card h2 {
  font-weight: 600;
  margin-bottom: 25px;
  color: #38bdf8;
}
.card input, .card select, .card button {
  width: 100%;
  padding: 14px;
  margin: 12px 0;
  border-radius: 8px;
  border: 1px solid #94a3b8;
  background: #0f172a;
  color: #f8fafc;
  font-size: 15px;
}
.card input:focus, .card select:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 2px #38bdf8;
}
.card button {
  background: #38bdf8;
  color: #0f172a;
  font-weight: bold;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.3s;
  border: none;
}
.card button:hover { background: #0ea5e9; }

/* Dashboard */
.dashboard {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 30px;
}
.dashboard .card {
  background: #1e293b;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  min-width: 150px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
}
.dashboard .card h3 {
  margin-bottom: 10px;
  font-weight: 700;
  font-size: 1.3rem;
  color: #f8fafc;
}
.dashboard .card div {
  font-size: 2.2rem;
  font-weight: 800;
  font-family: 'Orbitron', sans-serif;
  color: #3b82f6;
  text-shadow: 0 0 8px rgba(59,130,246,0.7);
}

/* Gráficos */
.dashboard-charts {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-top: 20px;
  padding: 20px;
}
.dashboard-charts .chart {
  background: #1e293b;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  height: 400px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.dashboard-charts .chart canvas {
  flex-grow: 1;
}
.chart-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: #f8fafc;
  text-align: center;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Animação modal */
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
/* Campos uniformes */
input, select, .card input, .card select {
  width: 100%;
  padding: 12px;
  margin: 10px 0;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #0f172a;
  color: #f1f5f9;
  font-size: 15px;
  box-sizing: border-box;
}

input:focus, select:focus, .card input:focus, .card select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59,130,246,0.3);
}



