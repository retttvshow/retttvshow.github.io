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
