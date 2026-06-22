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
