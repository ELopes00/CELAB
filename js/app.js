/* ==========================================================================
   SAGE-TI — Shell da aplicação: roteador, sidebar e barra superior
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  var UI = SAGETI.ui;
  var U = SAGETI.util;

  var ROTAS = [
    { id: 'dashboard',     rotulo: 'Dashboard',              icone: 'dashboard', secao: 'Principal' },
    { id: 'estoque',       rotulo: 'Estoque Laboratório',    icone: 'caixa',     secao: 'Principal', contador: 'lab' },
    { id: 'entrada',       rotulo: 'Entrada de Equipamentos',icone: 'entrada',   secao: 'Movimentação' },
    { id: 'saida',         rotulo: 'Saída de Equipamentos',  icone: 'saida',     secao: 'Movimentação' },
    { id: 'relatorios',    rotulo: 'Relatórios e Filtros',   icone: 'relatorio', secao: 'Análise' },
    { id: 'configuracoes', rotulo: 'Configurações',          icone: 'engrenagem', secao: 'Sistema' }
  ];

  var raiz = null;
  var rotaAtual = null;
  var paginaViva = null;      // { destruir }
  var cancelarBadge = null;

  /* ---------- Shell ----------------------------------------------------------- */

  function shellHTML(usuario) {
    var nav = '';
    var secaoAtual = '';
    ROTAS.forEach(function (r) {
      if (r.secao !== secaoAtual) {
        secaoAtual = r.secao;
        nav += '<div class="nav-section">' + U.esc(r.secao) + '</div>';
      }
      nav += '<button class="nav-item" type="button" data-rota="' + r.id + '">' +
        UI.icone(r.icone, 18) + '<span>' + U.esc(r.rotulo) + '</span>' +
        (r.contador ? '<span class="nav-item__badge" data-badge="' + r.contador + '">0</span>' : '') +
        '</button>';
    });

    var iniciais = (usuario.nome || usuario.usuario || '?')
      .split(' ').filter(Boolean).slice(0, 2)
      .map(function (p) { return p[0]; }).join('').toUpperCase();

    return '' +
      '<div class="app-shell">' +

        '<aside class="sidebar" id="sidebar">' +
          '<div class="sidebar__brand">' +
            // Substitua o texto por <img src="assets/logo.png" alt=""> quando tiver a logo.
            '<div class="sidebar__logo"><img src="assets/logoBranca.png" alt=""></div>'  +
            '<div style="min-width:0">' +
              '<div class="sidebar__name">' + U.esc(SAGETI.APP.nome) + '</div>' +
              '<div class="sidebar__tag">Ativos &amp; Estoque de TI</div>' +
            '</div>' +
          '</div>' +

          '<nav class="sidebar__nav" aria-label="Navegação principal">' + nav +
            '<div class="nav-section">Ferramentas</div>' +
            '<button class="nav-item" type="button" data-acao="importar">' +
              UI.icone('planilha', 18) + '<span>Importar planilha</span></button>' +
            '<button class="nav-item" type="button" data-acao="exportar-geral">' +
              UI.icone('download', 18) + '<span>Exportar Geral</span></button>' +
            '<button class="nav-item" type="button" data-acao="config">' +
              UI.icone('salvar', 18) + '<span>Dados e backup</span></button>' +
          '</nav>' +

          '<div class="sidebar__foot">' +
            '<div class="user-chip">' +
              '<div class="user-chip__av">' + U.esc(iniciais) + '</div>' +
              '<div style="min-width:0;flex:1">' +
                '<div class="user-chip__name">' + U.esc(usuario.nome || usuario.usuario) + '</div>' +
                '<div class="user-chip__role">' +
                  U.esc((SAGETI.PERFIS[usuario.perfil] || {}).rotulo || usuario.perfil) + '</div>' +
              '</div>' +
              '<button class="icon-btn" data-acao="sair" title="Sair" aria-label="Sair" ' +
                'style="background:transparent;border-color:rgba(255,255,255,.12);color:#c9cdd4;width:30px;height:30px">' +
                UI.icone('sair', 15) + '</button>' +
            '</div>' +
          '</div>' +
        '</aside>' +

        '<div class="main">' +
          '<header class="topbar">' +
            '<button class="icon-btn menu-toggle" data-acao="menu" aria-label="Abrir menu">' +
              UI.icone('menu', 17) + '</button>' +
            '<div style="min-width:0">' +
              '<div class="topbar__title" id="topbar-titulo">Dashboard</div>' +
              '<div class="topbar__sub" id="topbar-sub">Visão geral do estoque</div>' +
            '</div>' +
            '<div class="topbar__spacer"></div>' +
            '<span class="live-dot" title="Os dados são atualizados automaticamente">Tempo real</span>' +
            '<div class="dropdown">' +
              '<button class="btn btn--outline btn--sm" data-acao="menu-exportar">' +
                UI.icone('download', 14) + '<span>Exportar Geral</span></button>' +
              '<div class="dropdown__menu hidden" id="menu-exportar">' +
                '<button class="dropdown__item" data-acao="exp-xlsx">' +
                  UI.icone('excel', 16) + 'Inventário completo (XLSX)</button>' +
                '<button class="dropdown__item" data-acao="exp-pdf">' +
                  UI.icone('pdf', 16) + 'Inventário completo (PDF)</button>' +
                '<div class="dropdown__sep"></div>' +
                '<button class="dropdown__item" data-acao="exp-json">' +
                  UI.icone('download', 16) + 'Backup dos dados (JSON)</button>' +
              '</div>' +
            '</div>' +
            '<button class="icon-btn" data-acao="tema" title="Alternar tema claro/escuro" ' +
              'aria-label="Alternar tema" id="btn-tema"></button>' +
          '</header>' +

          '<main class="page" id="pagina" tabindex="-1"></main>' +
        '</div>' +

      '</div>';
  }

  /* ---------- Navegação -------------------------------------------------------- */

  function navegar(rotaId, semHash) {
    var rota = ROTAS.find(function (r) { return r.id === rotaId; }) || ROTAS[0];
    if (rotaAtual === rota.id) return;

    if (paginaViva && paginaViva.destruir) {
      try { paginaViva.destruir(); } catch (e) { console.error(e); }
    }
    SAGETI.charts.destruirTodos();
    paginaViva = null;
    rotaAtual = rota.id;

    var pagina = document.getElementById('pagina');
    pagina.innerHTML = '';

    var modulo = SAGETI.pages[rota.id];
    if (!modulo) {
      pagina.innerHTML = '<div class="card"><div class="card__body">Página não encontrada.</div></div>';
      return;
    }

    document.getElementById('topbar-titulo').textContent = modulo.titulo || rota.rotulo;
    document.getElementById('topbar-sub').textContent = modulo.subtitulo || '';
    document.title = SAGETI.APP.nome + ' · ' + (modulo.titulo || rota.rotulo);

    paginaViva = modulo.montar(pagina, navegar) || null;

    document.querySelectorAll('[data-rota]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-rota') === rota.id);
      if (b.getAttribute('data-rota') === rota.id) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });

    if (!semHash) window.location.hash = '#/' + rota.id;
    fecharSidebarMobile();
    pagina.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* ---------- Sidebar mobile ---------------------------------------------------- */

  function abrirSidebarMobile() {
    var sb = document.getElementById('sidebar');
    if (!sb) return;
    sb.classList.add('is-open');
    if (!document.querySelector('.scrim')) {
      var scrim = document.createElement('div');
      scrim.className = 'scrim';
      scrim.addEventListener('click', fecharSidebarMobile);
      document.body.appendChild(scrim);
    }
  }

  function fecharSidebarMobile() {
    var sb = document.getElementById('sidebar');
    if (sb) sb.classList.remove('is-open');
    var scrim = document.querySelector('.scrim');
    if (scrim) scrim.remove();
  }

  /* ---------- Contador na sidebar ------------------------------------------------ */

  function atualizarBadges() {
    var n = SAGETI.store.estoqueLaboratorio().length;
    document.querySelectorAll('[data-badge="lab"]').forEach(function (el) {
      el.textContent = U.numero(n);
    });
  }

  /* ---------- Ferramentas de dados ------------------------------------------------ */

  function abrirConfig() {
    var r = SAGETI.store.resumo();
    var corpo =
      '<div class="result-preview" style="margin-bottom:18px">' +
        '<div class="result-preview__row"><span class="result-preview__k">Equipamentos cadastrados</span>' +
          '<span class="result-preview__v">' + U.numero(r.totalCadastrado) + '</span></div>' +
        '<div class="result-preview__row"><span class="result-preview__k">No laboratório</span>' +
          '<span class="result-preview__v">' + U.numero(r.totalNoLab) + '</span></div>' +
        '<div class="result-preview__row"><span class="result-preview__k">Movimentações no histórico</span>' +
          '<span class="result-preview__v">' + U.numero(SAGETI.store.listarMovimentacoes().length) + '</span></div>' +
      '</div>' +

      '<div class="section-title" style="margin-top:0">Backup e restauração</div>' +
      '<p style="font-size:12.5px;color:var(--text-secondary);margin-bottom:12px">' +
        'Os dados ficam salvos no navegador deste computador. Exporte um backup em JSON com ' +
        'regularidade — e ao migrar para um servidor, este mesmo arquivo alimenta a carga inicial.</p>' +

      '<div class="btn-group" style="margin-bottom:20px">' +
        '<button class="btn btn--outline btn--sm" data-cfg="backup">' +
          UI.icone('download', 14) + '<span>Baixar backup (JSON)</span></button>' +
        '<button class="btn btn--outline btn--sm" data-cfg="restaurar">' +
          UI.icone('caixa', 14) + '<span>Restaurar de arquivo</span></button>' +
        '<input type="file" id="cfg-arquivo" accept="application/json,.json" class="hidden">' +
      '</div>' +

      '<div class="section-title">Zona de risco</div>' +
      '<div class="alert alert--warning" style="margin-bottom:12px">' + UI.icone('alerta', 17) +
        '<span>Apagar os dados remove todos os equipamentos e todo o histórico deste navegador. ' +
        'A ação não pode ser desfeita — faça um backup antes.</span></div>' +
      '<button class="btn btn--danger btn--sm" data-cfg="limpar">' +
        UI.icone('lixeira', 14) + '<span>Apagar todos os dados</span></button>';

    var ref = UI.modal({
      titulo: 'Dados e backup',
      subtitulo: SAGETI.APP.nome + ' ' + SAGETI.APP.versao + ' · armazenamento local do navegador',
      corpo: corpo,
      botoes: [{ texto: 'Fechar', classe: 'btn--ghost' }]
    });

    var arquivo = ref.el.querySelector('#cfg-arquivo');

    ref.el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cfg]');
      if (!b) return;
      var acao = b.getAttribute('data-cfg');

      if (acao === 'backup') {
        U.baixarArquivo(SAGETI.store.exportarJSON(),
          SAGETI.APP.nome + '_backup_' + U.carimbo() + '.json', 'application/json');
        return UI.toast('success', 'Backup gerado', 'Guarde o arquivo em local seguro.');
      }

      if (acao === 'restaurar') return arquivo.click();

      if (acao === 'limpar') {
        UI.fecharModal();
        UI.confirmar({
          titulo: 'Apagar todos os dados',
          mensagem: 'Todos os equipamentos e movimentações serão removidos permanentemente deste navegador. Confirma?',
          confirmar: 'Apagar tudo',
          perigo: true
        }).then(function (ok) {
          if (!ok) return;
          SAGETI.store.limparTudo();
          UI.toast('success', 'Dados apagados', 'O sistema voltou ao estado inicial.');
        });
      }
    });

    arquivo.addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var leitor = new FileReader();
      leitor.onload = function () {
        var res = SAGETI.store.importarJSON(String(leitor.result));
        if (res.ok) {
          UI.fecharModal();
          UI.toast('success', 'Dados restaurados', res.total + ' equipamento(s) carregado(s).');
        } else {
          UI.toast('error', 'Falha ao restaurar', res.erro);
        }
      };
      leitor.readAsText(f);
    });
  }

  /* ---------- Eventos globais do shell -------------------------------------------- */

  function pintarBotaoTema() {
    var btn = document.getElementById('btn-tema');
    if (btn) btn.innerHTML = UI.icone(UI.temaAtual() === 'dark' ? 'sol' : 'lua', 17);
  }

  /** Abre o menu global de exportação (usado pela sidebar, sempre visível). */
  function abrirExportarGeral() {
    UI.modal({
      titulo: 'Exportar Geral',
      subtitulo: 'Inventário atualizado com todos os equipamentos e o histórico completo',
      largura: 'sm',
      corpo:
        '<div style="display:grid;gap:10px">' +
          '<button class="btn btn--outline btn--lg" data-exp="xlsx">' +
            UI.icone('excel', 16) + '<span>Excel (XLSX) — 3 abas</span></button>' +
          '<button class="btn btn--outline btn--lg" data-exp="pdf">' +
            UI.icone('pdf', 16) + '<span>PDF — inventário paginado</span></button>' +
          '<button class="btn btn--ghost btn--lg" data-exp="json">' +
            UI.icone('download', 16) + '<span>Backup dos dados (JSON)</span></button>' +
        '</div>' +
        '<p style="font-size:11.5px;color:var(--text-muted);margin-top:14px">' +
          'O XLSX traz as abas Inventário, Movimentações e Resumo por tipo.</p>',
      botoes: [{ texto: 'Fechar', classe: 'btn--ghost' }]
    }).el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-exp]');
      if (!b) return;
      var tipo = b.getAttribute('data-exp');
      UI.fecharModal();
      if (tipo === 'xlsx') return SAGETI.exportar.exportarGeralExcel();
      if (tipo === 'pdf') return SAGETI.exportar.exportarGeralPDF();
      U.baixarArquivo(SAGETI.store.exportarJSON(),
        SAGETI.APP.nome + '_backup_' + U.carimbo() + '.json', 'application/json');
      UI.toast('success', 'Backup gerado', 'Arquivo JSON com todos os registros.');
    });
  }

  var eventosLigados = false;

  function ligarShell() {
    pintarBotaoTema();

    // O contador da sidebar é reassinado a cada montagem do shell.
    if (cancelarBadge) cancelarBadge();
    cancelarBadge = SAGETI.store.assinar(atualizarBadges);
    atualizarBadges();

    // Delegação no document: liga uma única vez por carga da página, senão
    // um logout seguido de login duplicaria toda ação do shell.
    if (eventosLigados) return;
    eventosLigados = true;

    document.addEventListener('click', function (e) {
      var alvo;

      if ((alvo = e.target.closest('[data-rota]'))) {
        return navegar(alvo.getAttribute('data-rota'));
      }

      if ((alvo = e.target.closest('[data-acao]'))) {
        var acao = alvo.getAttribute('data-acao');

        if (acao === 'menu') return abrirSidebarMobile();
        if (acao === 'tema') { UI.alternarTema(); return pintarBotaoTema(); }
        if (acao === 'config') return abrirConfig();
        if (acao === 'importar') { fecharSidebarMobile(); return SAGETI.importar.abrir(); }

        // Na barra superior o dropdown basta; na sidebar (que fecha no
        // mobile) o modal é o caminho confiável.
        if (acao === 'menu-exportar') {
          var menu = document.getElementById('menu-exportar');
          if (menu) menu.classList.toggle('hidden');
          return;
        }
        if (acao === 'exportar-geral') return abrirExportarGeral();
        if (acao === 'exp-xlsx') {
          document.getElementById('menu-exportar').classList.add('hidden');
          return SAGETI.exportar.exportarGeralExcel();
        }
        if (acao === 'exp-pdf') {
          document.getElementById('menu-exportar').classList.add('hidden');
          return SAGETI.exportar.exportarGeralPDF();
        }
        if (acao === 'exp-json') {
          document.getElementById('menu-exportar').classList.add('hidden');
          U.baixarArquivo(SAGETI.store.exportarJSON(),
            SAGETI.APP.nome + '_backup_' + U.carimbo() + '.json', 'application/json');
          return UI.toast('success', 'Backup gerado', 'Arquivo JSON com todos os registros.');
        }

        if (acao === 'sair') {
          return UI.confirmar({
            titulo: 'Sair do sistema',
            mensagem: 'Deseja encerrar a sessão?',
            confirmar: 'Sair'
          }).then(function (ok) { if (ok) sair(); });
        }
      }

      // Fecha o menu de exportação ao clicar fora
      var menuExp = document.getElementById('menu-exportar');
      if (menuExp && !menuExp.classList.contains('hidden') && !e.target.closest('.dropdown')) {
        menuExp.classList.add('hidden');
      }
    });

    window.addEventListener('hashchange', function () {
      var id = (window.location.hash || '').replace('#/', '');
      if (id && id !== rotaAtual) navegar(id, true);
    });

    // Atalhos: Alt+1..5 troca de aba
    document.addEventListener('keydown', function (e) {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      var n = Number(e.key);
      if (n >= 1 && n <= ROTAS.length) {
        e.preventDefault();
        navegar(ROTAS[n - 1].id);
      }
    });
  }

  /* ---------- Entrada / saída da aplicação ------------------------------------------ */

  function abrirLogin() {
    if (paginaViva && paginaViva.destruir) { try { paginaViva.destruir(); } catch (e) {} }
    if (cancelarBadge) { cancelarBadge(); cancelarBadge = null; }
    SAGETI.charts.destruirTodos();
    paginaViva = null;
    rotaAtual = null;
    raiz.innerHTML = '';
    document.title = SAGETI.APP.nome + ' · Entrar';
    SAGETI.pages.login.montar(raiz, function () { abrirApp(); });
  }

  function abrirApp() {
    var usuario = SAGETI.auth.usuarioAtual();
    if (!usuario) return abrirLogin();

    raiz.className = '';
    raiz.innerHTML = shellHTML(usuario);
    ligarShell();

    var inicial = (window.location.hash || '').replace('#/', '');
    rotaAtual = null;
    navegar(ROTAS.some(function (r) { return r.id === inicial; }) ? inicial : 'dashboard', true);
  }

  function sair() {
    SAGETI.auth.sair();
    window.location.hash = '';
    abrirLogin();
  }

  /* ---------- Boot ------------------------------------------------------------------- */

  function iniciar() {
    raiz = document.getElementById('app');
    UI.aplicarTema(UI.temaAtual());
    SAGETI.store.inicializar();
    // Botão ⚙ ao lado dos campos: um único ouvinte para todo o app.
    SAGETI.gerenciador.ligarGlobal();

    if (SAGETI.auth.autenticado()) abrirApp();
    else abrirLogin();

    // Sem localStorage (algumas configurações de file://) os dados não persistem.
    try {
      localStorage.setItem('__celab_probe__', '1');
      localStorage.removeItem('__celab_probe__');
    } catch (e) {
      setTimeout(function () {
        UI.toast('warn', 'Armazenamento indisponível',
          'O navegador bloqueou o armazenamento local: os dados existirão só nesta sessão. ' +
          'Sirva a pasta por HTTP para persistir.', 12000);
      }, 900);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  SAGETI.app = { navegar: navegar, sair: sair, rotas: ROTAS };

})(window.SAGETI);
