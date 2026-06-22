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
