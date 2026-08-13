/* ==========================================================================
   SAGE-TI — Tela de Login
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  var UI = SAGETI.ui;

  function montar(raiz, aoEntrar) {
    raiz.className = 'login-screen';
    raiz.innerHTML =
      '<main class="login-card" style="position:relative">' +

        '<button type="button" id="btn-tema-login" class="icon-btn" ' +
          'title="Alternar tema claro/escuro" aria-label="Alternar tema" ' +
          'style="position:absolute;top:14px;right:14px"></button>' +

        // --- Espaço reservado para a logo do sistema -----------------------
        // --- Nova class para identificar ---
        '<div class="logo-slot">' +
          '<img id="logo-login" src="assets/logo.png" alt="Logo TJRR"></img>' +
          '<div class="logo-slot__caption"></div>' +
        '</div>' +

        '<div class="login-header">' +
          '<h1 class="login-title">' + SAGETI.util.esc(SAGETI.APP.nome) + '</h1>' +
          '<p class="login-desc">' + SAGETI.util.esc(SAGETI.APP.descricao) + '</p>' +
        '</div>' +
        '<p class="login-sub">Informe suas credenciais para acessar o sistema</p>' +

        '<form id="form-login" novalidate autocomplete="on">' +
          '<div style="display:grid;gap:16px">' +

            '<div class="field">' +
              '<label for="login-usuario">Usuário</label>' +
              '<input class="input" type="text" id="login-usuario" name="usuario" ' +
                'autocomplete="username" placeholder="seu.usuario" data-obrigatorio required>' +
              '<span class="field__error">Informe o usuário.</span>' +
            '</div>' +

            '<div class="field">' +
              '<label for="login-senha">Senha</label>' +
              '<div style="position:relative">' +
                '<input class="input" type="password" id="login-senha" name="senha" ' +
                  'autocomplete="current-password" placeholder="••••••••" ' +
                  'style="padding-right:40px" data-obrigatorio required>' +
                '<button type="button" id="ver-senha" aria-label="Mostrar senha" ' +
                  'style="position:absolute;right:6px;top:50%;transform:translateY(-50%);' +
                  'border:0;background:transparent;color:var(--text-muted);padding:5px;' +
                  'display:grid;place-items:center;border-radius:6px">' +
                  UI.icone('olho', 17) +
                '</button>' +
              '</div>' +
              '<span class="field__error">Informe a senha.</span>' +
            '</div>' +

            '<label style="display:flex;align-items:center;gap:8px;font-size:12.5px;' +
              'color:var(--text-secondary);cursor:pointer">' +
              '<input type="checkbox" id="lembrar" name="lembrar" style="width:15px;height:15px;accent-color:var(--brand)">' +
              'Manter conectado neste computador' +
            '</label>' +

            '<div id="login-erro" class="alert hidden" style="margin:0" role="alert">' +
              UI.icone('alerta', 17) + '<span></span>' +
            '</div>' +

            '<button type="submit" class="btn btn--primary btn--lg" id="btn-entrar">' +
              UI.icone('cadeado', 16) + '<span>Entrar</span>' +
            '</button>' +

          '</div>' +
        '</form>' +

      '</main>';

    var form = raiz.querySelector('#form-login');
    var erro = raiz.querySelector('#login-erro');
    var campoSenha = raiz.querySelector('#login-senha');

    var btnTema = raiz.querySelector('#btn-tema-login');
    var logoLogin = raiz.querySelector('#logo-login'); 

    function pintarBotaoTema() {
      btnTema.innerHTML = UI.icone(UI.temaAtual() === 'dark' ? 'sol' : 'lua', 17);
    }

    // Função da troca de logo
    function pintarLogo() {
      logoLogin.src = UI.temaAtual() === 'dark'
        ? 'assets/logoBranca.png'
        : 'assets/logo.png';
    }

    pintarBotaoTema();
    pintarLogo(); 

    btnTema.addEventListener('click', function () {
      UI.alternarTema();
      pintarBotaoTema();
      pintarLogo(); 
    });

    raiz.querySelector('#ver-senha').addEventListener('click', function () {
      var mostrando = campoSenha.type === 'text';
      campoSenha.type = mostrando ? 'password' : 'text';
      this.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
      campoSenha.focus();
    });

    var btnEntrar = raiz.querySelector('#btn-entrar');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      erro.classList.add('hidden');

      if (!UI.validarForm(form)) return;

      var dados = UI.dadosForm(form);
      btnEntrar.disabled = true;
      btnEntrar.querySelector('span').textContent = 'Entrando…';

      SAGETI.auth.entrar(dados.usuario, dados.senha, !!dados.lembrar).then(function (r) {
        if (!r.ok) {
          erro.querySelector('span').textContent = r.erro;
          erro.classList.remove('hidden');
          campoSenha.value = '';
          campoSenha.focus();
          return;
        }
        aoEntrar(r.usuario);
      }).finally(function () {
        btnEntrar.disabled = false;
        btnEntrar.querySelector('span').textContent = 'Entrar';
      });
    });

    setTimeout(function () { raiz.querySelector('#login-usuario').focus(); }, 60);
  }

  SAGETI.pages = SAGETI.pages || {};
  SAGETI.pages.login = { montar: montar };

})(window.SAGETI);