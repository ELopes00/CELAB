/* ==========================================================================
   SAGE-TI — Aba: Configurações
   --------------------------------------------------------------------------
   Painel completo das listas do sistema, importação de planilha e backup.
   O mesmo editor aparece em modal pelo botão ⚙ ao lado de cada campo — aqui
   ele ganha a visão geral, com a contagem de opções de cada lista.
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  var UI = SAGETI.ui;
  var U = SAGETI.util;
  var L = SAGETI.listas;

  var listaAtiva = 'status';
  var filtroAtivo = '';

  function esqueleto() {
    return '' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-head__title">Configurações</h1>' +
          '<p class="page-head__sub">Listas de seleção, importação de dados e backup</p>' +
        '</div>' +
      '</div>' +

      '<div class="quick-actions">' +
        '<button class="quick-card" data-acao="importar">' +
          '<span class="quick-card__icon">' + UI.icone('planilha', 19) + '</span>' +
          '<span class="quick-card__text">' +
            '<span class="quick-card__title">Importar planilha</span>' +
            '<span class="quick-card__sub">Carga inicial via Excel ou CSV</span></span>' +
        '</button>' +
        '<button class="quick-card" data-acao="modelo">' +
          '<span class="quick-card__icon quick-card__icon--doc">' + UI.icone('download', 19) + '</span>' +
          '<span class="quick-card__text">' +
            '<span class="quick-card__title">Baixar modelo</span>' +
            '<span class="quick-card__sub">Planilha com as colunas esperadas</span></span>' +
        '</button>' +
        '<button class="quick-card" data-acao="backup">' +
          '<span class="quick-card__icon quick-card__icon--out">' + UI.icone('salvar', 19) + '</span>' +
          '<span class="quick-card__text">' +
            '<span class="quick-card__title">Backup completo</span>' +
            '<span class="quick-card__sub">Registros e listas em JSON</span></span>' +
        '</button>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card__head">' +
          '<div>' +
            '<div class="card__title">Listas de seleção</div>' +
            '<div class="card__sub">Nenhuma opção é fixa: tudo o que aparece em um campo de ' +
              'seleção pode ser criado, renomeado ou removido aqui</div>' +
          '</div>' +
          '<div class="card__spacer"></div>' +
          '<button class="btn btn--ghost btn--sm" data-acao="exportar-listas">' +
            UI.icone('download', 14) + '<span>Exportar listas</span></button>' +
          '<button class="btn btn--ghost btn--sm" data-acao="importar-listas">' +
            UI.icone('upload', 14) + '<span>Importar listas</span></button>' +
          '<input type="file" id="arq-listas" accept="application/json,.json" class="hidden">' +
        '</div>' +
        '<div class="card__body">' +
          '<div class="listas-layout">' +
            '<nav class="listas-nav" id="listas-nav" aria-label="Listas do sistema"></nav>' +
            '<div id="listas-painel"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="card" style="margin-top:18px">' +
        '<div class="card__head">' +
          '<div>' +
            '<div class="card__title">Zona de risco</div>' +
            '<div class="card__sub">Ações que não podem ser desfeitas</div>' +
          '</div>' +
        '</div>' +
        '<div class="card__body">' +
          '<div class="alert alert--warning">' + UI.icone('alerta', 17) +
            '<span>Faça um backup antes. Restaurar todas as listas devolve o padrão de ' +
            'fábrica; apagar os dados remove equipamentos e histórico deste navegador.</span>' +
          '</div>' +
          '<div class="btn-group">' +
            '<button class="btn btn--outline btn--sm" data-acao="restaurar-tudo">' +
              UI.icone('restaurar', 14) + '<span>Restaurar todas as listas</span></button>' +
            '<button class="btn btn--danger btn--sm" data-acao="apagar">' +
              UI.icone('lixeira', 14) + '<span>Apagar todos os dados</span></button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function desenharNav(container) {
    var nav = container.querySelector('#listas-nav');
    if (!nav) return;
    nav.innerHTML = L.resumo().map(function (r) {
      var meta = SAGETI.gerenciador.catalogo(r.chave);
      return '<button type="button" data-lista="' + r.chave + '"' +
        (r.chave === listaAtiva ? ' class="is-active" aria-current="true"' : '') + '>' +
        UI.icone(meta.icone || 'listas', 16) +
        '<span>' + U.esc(r.rotulo) + '</span>' +
        '<span class="cnt">' + U.numero(r.total) + '</span></button>';
    }).join('');
  }

  function desenharPainel(container) {
    var painel = container.querySelector('#listas-painel');
    if (!painel) return;
    painel.innerHTML = SAGETI.gerenciador.painelHTML(listaAtiva, filtroAtivo);
    SAGETI.gerenciador.ligar(painel, listaAtiva, function (filtro) {
      if (filtro !== undefined) filtroAtivo = filtro;
      desenharNav(container);
      desenharPainel(container);
      var f = container.querySelector('#filtro-opcoes');
      if (f && filtroAtivo) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    });
  }

  function montar(container, navegar) {
    if (!SAGETI.auth.permissao('podeGerenciarListas')) {
      container.innerHTML = '<div class="card"><div class="card__body">' +
        UI.estadoVazio('Acesso restrito',
          'Seu perfil é somente de consulta e não pode alterar as configurações do sistema.') +
        '</div></div>';
      return { destruir: function () {} };
    }

    container.innerHTML = esqueleto();
    desenharNav(container);
    desenharPainel(container);

    var arqListas = container.querySelector('#arq-listas');

    container.addEventListener('click', function (e) {
      var alvo;

      if ((alvo = e.target.closest('[data-lista]'))) {
        listaAtiva = alvo.getAttribute('data-lista');
        filtroAtivo = '';
        desenharNav(container);
        desenharPainel(container);
        return;
      }

      alvo = e.target.closest('[data-acao]');
      if (!alvo) return;

      switch (alvo.getAttribute('data-acao')) {
        case 'importar':
          return SAGETI.importar.abrir();

        case 'modelo':
          return SAGETI.importar.baixarModelo();

        case 'backup':
          U.baixarArquivo(SAGETI.store.exportarJSON(),
            SAGETI.APP.nome + '_backup_' + U.carimbo() + '.json', 'application/json');
          return UI.toast('success', 'Backup gerado',
            'Inclui equipamentos, histórico e todas as listas.');

        case 'exportar-listas':
          U.baixarArquivo(L.exportarJSON(),
            SAGETI.APP.nome + '_listas_' + U.carimbo() + '.json', 'application/json');
          return UI.toast('success', 'Listas exportadas',
            'Use este arquivo para replicar as listas em outra máquina.');

        case 'importar-listas':
          return arqListas.click();

        case 'restaurar-tudo':
          return UI.confirmar({
            titulo: 'Restaurar todas as listas',
            mensagem: 'Todas as listas voltam ao padrão de fábrica. Opções criadas por você ' +
              'serão perdidas; os registros já gravados não mudam. Continuar?',
            confirmar: 'Restaurar tudo', perigo: true
          }).then(function (ok) {
            if (!ok) return;
            L.restaurarPadrao();
            UI.toast('success', 'Listas restauradas', 'Todas voltaram ao padrão.');
            desenharNav(container);
            desenharPainel(container);
          });

        case 'apagar':
          return UI.confirmar({
            titulo: 'Apagar todos os dados',
            mensagem: 'Equipamentos e movimentações serão removidos permanentemente do ' +
              'Firestore, para todo mundo que usa o sistema. As listas são preservadas. Confirma?',
            confirmar: 'Apagar tudo', perigo: true
          }).then(function (ok) {
            if (!ok) return;
            SAGETI.store.limparTudo().then(function () {
              UI.toast('success', 'Dados apagados', 'O sistema voltou ao estado inicial.');
              desenharPainel(container);
            }).catch(function (e) {
              UI.toast('error', 'Falha ao apagar', e.message);
            });
          });
      }
    });

    arqListas.addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var leitor = new FileReader();
      leitor.onload = function () {
        var r = L.importarJSON(String(leitor.result));
        if (!r.ok) return UI.toast('error', 'Falha ao importar', r.erro);
        UI.toast('success', 'Listas importadas', 'As opções foram substituídas.');
        desenharNav(container);
        desenharPainel(container);
      };
      leitor.readAsText(f);
      this.value = '';
    });

    // A contagem de uso muda quando registros mudam: mantém o painel fiel.
    var cancelar = SAGETI.store.assinar(function () {
      desenharNav(container);
      desenharPainel(container);
    });

    return { destruir: cancelar };
  }

  SAGETI.pages = SAGETI.pages || {};
  SAGETI.pages.configuracoes = {
    titulo: 'Configurações',
    subtitulo: 'Listas, importação e backup',
    montar: montar
  };

})(window.SAGETI);
