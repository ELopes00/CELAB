/* ==========================================================================
   SAGE-TI — Aba: Auditoria
   --------------------------------------------------------------------------
   Trilha de "quem mudou o quê" (coleção `auditoria`, append-only — as Rules
   do Firestore bloqueiam update/delete para todo mundo, inclusive admin).
   Só administradores veem esta tela; a leitura em si é liberada a qualquer
   autenticado nas Rules, mas o menu e o conteúdo aqui exigem `podeExcluir`
   (único sinalizador de "é admin" no modelo de perfis do app).
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  var UI = SAGETI.ui;
  var U = SAGETI.util;

  var logs = [];
  var carregando = false;

  function esqueleto() {
    return '' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-head__title">Auditoria</h1>' +
          '<p class="page-head__sub">Registro imutável de alterações — ninguém apaga, nem admin</p>' +
        '</div>' +
        '<div class="page-head__spacer"></div>' +
        '<button class="btn btn--outline btn--sm" data-acao="recarregar">' +
          UI.icone('restaurar', 14) + '<span>Recarregar</span></button>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card__body card__body--flush">' +
          '<div class="table-wrap" id="aud-tabela"></div>' +
        '</div>' +
      '</div>';
  }

  function desenharTabela(container) {
    var alvo = container.querySelector('#aud-tabela');
    if (!alvo) return;

    if (carregando) {
      alvo.innerHTML = '<div style="padding:28px;text-align:center;color:var(--text-muted);font-size:13px">' +
        'Carregando…</div>';
      return;
    }

    if (!logs.length) {
      alvo.innerHTML = UI.estadoVazio('Nenhum registro de auditoria ainda',
        'Alterações de status, exclusões e outras ações sensíveis aparecem aqui assim que acontecerem.');
      return;
    }

    // Toda célula passa por U.esc() — a descrição é texto do usuário/sistema
    // e nunca deve ser interpretada como HTML na hora de montar a tabela.
    var html = '<table class="table"><thead><tr>' +
      '<th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Descrição</th>' +
      '</tr></thead><tbody>';

    logs.forEach(function (l) {
      html += '<tr>' +
        '<td class="num">' + U.esc(U.dataHoraBR(l.registradoEm)) + '</td>' +
        '<td>' + U.esc(l.usuario || '—') + '</td>' +
        '<td><span class="tag">' + U.esc(l.acao || '—') + '</span></td>' +
        '<td>' + U.esc(l.entidade || '—') + '</td>' +
        '<td>' + U.esc(l.descricao || '') + '</td>' +
      '</tr>';
    });

    alvo.innerHTML = html + '</tbody></table>';
  }

  function carregar(container) {
    carregando = true;
    desenharTabela(container);
    SAGETI.store.listarAuditoria(200).then(function (r) {
      logs = r;
      carregando = false;
      desenharTabela(container);
    }).catch(function (erro) {
      carregando = false;
      UI.toast('error', 'Falha ao carregar auditoria', erro.message);
      desenharTabela(container);
    });
  }

  function montar(container) {
    if (!SAGETI.auth.permissao('podeExcluir')) {
      container.innerHTML = '<div class="card"><div class="card__body">' +
        UI.estadoVazio('Acesso restrito',
          'Somente administradores podem visualizar a trilha de auditoria.') +
        '</div></div>';
      return { destruir: function () {} };
    }

    container.innerHTML = esqueleto();
    carregar(container);

    function aoClicar(e) {
      if (e.target.closest('[data-acao="recarregar"]')) carregar(container);
    }
    container.addEventListener('click', aoClicar);

    return { destruir: function () { container.removeEventListener('click', aoClicar); } };
  }

  SAGETI.pages = SAGETI.pages || {};
  SAGETI.pages.auditoria = {
    titulo: 'Auditoria',
    subtitulo: 'Trilha de alterações do sistema',
    montar: montar
  };

})(window.SAGETI);
