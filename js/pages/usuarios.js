/* ==========================================================================
   SAGE-TI — Aba: Usuários
   --------------------------------------------------------------------------
   Lista os documentos de `usuarios/*`. Excluir é exclusivo de Administrador:
   o botão só existe no DOM para quem tem a permissão (UX), mas quem barra
   de verdade é a Cloud Function `excluirUsuario` (functions/index.js), que
   relê o perfil do chamador no Firestore antes de agir — forçar a chamada
   pelo console de um perfil Técnico recebe `permission-denied` do servidor.
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  var UI = SAGETI.ui;
  var U = SAGETI.util;

  var usuarios = [];
  var carregando = false;

  function esqueleto() {
    return '' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-head__title">Usuários</h1>' +
          '<p class="page-head__sub">Contas com acesso ao sistema e seus perfis</p>' +
        '</div>' +
        '<div class="page-head__spacer"></div>' +
        '<button class="btn btn--outline btn--sm" data-acao="recarregar">' +
          UI.icone('restaurar', 14) + '<span>Recarregar</span></button>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card__body card__body--flush">' +
          '<div class="table-wrap" id="usr-tabela"></div>' +
        '</div>' +
      '</div>';
  }

  function desenharTabela(container) {
    var alvo = container.querySelector('#usr-tabela');
    if (!alvo) return;

    if (carregando) {
      alvo.innerHTML = '<div style="padding:28px;text-align:center;color:var(--text-muted);font-size:13px">' +
        'Carregando…</div>';
      return;
    }

    if (!usuarios.length) {
      alvo.innerHTML = UI.estadoVazio('Nenhum usuário encontrado', '');
      return;
    }

    var meuUid = (SAGETI.auth.usuarioAtual() || {}).uid;

    var html = '<table class="table"><thead><tr>' +
      '<th>Usuário</th><th>Nome</th><th>Perfil</th><th class="col-actions">Ações</th>' +
      '</tr></thead><tbody>';

    usuarios.forEach(function (u) {
      var rotuloPerfil = (SAGETI.PERFIS[u.perfil] || {}).rotulo || u.perfil || '—';
      var podeExcluirEste = SAGETI.auth.permissao('podeExcluir') && u.id !== meuUid;

      html += '<tr data-id="' + U.esc(u.id) + '">' +
        '<td class="strong">' + U.esc(u.usuario || '—') + '</td>' +
        '<td>' + U.esc(u.nome || '—') + '</td>' +
        '<td><span class="tag">' + U.esc(rotuloPerfil) + '</span></td>' +
        '<td class="col-actions">' +
          (podeExcluirEste
            ? '<button class="icon-btn" data-excluir-usuario="' + U.esc(u.id) + '" ' +
              'title="Excluir usuário" aria-label="Excluir usuário">' + UI.icone('lixeira', 15) + '</button>'
            : (u.id === meuUid ? '<span class="muted" style="font-size:11.5px">Você</span>' : '')) +
        '</td>' +
      '</tr>';
    });

    alvo.innerHTML = html + '</tbody></table>';
  }

  function carregar(container) {
    carregando = true;
    desenharTabela(container);
    SAGETI.store.listarUsuarios().then(function (r) {
      usuarios = r;
      carregando = false;
      desenharTabela(container);
    }).catch(function (erro) {
      carregando = false;
      UI.toast('error', 'Falha ao carregar usuários', erro.message);
      desenharTabela(container);
    });
  }

  function montar(container) {
    if (!SAGETI.auth.permissao('podeExcluir')) {
      container.innerHTML = '<div class="card"><div class="card__body">' +
        UI.estadoVazio('Acesso restrito',
          'Somente administradores podem gerenciar usuários.') +
        '</div></div>';
      return { destruir: function () {} };
    }

    container.innerHTML = esqueleto();
    carregar(container);

    function aoClicar(e) {
      if (e.target.closest('[data-acao="recarregar"]')) return carregar(container);

      var alvo = e.target.closest('[data-excluir-usuario]');
      if (!alvo) return;
      var uid = alvo.getAttribute('data-excluir-usuario');
      var u = usuarios.find(function (x) { return x.id === uid; });

      UI.confirmar({
        titulo: 'Excluir usuário',
        mensagem: 'Remove o login de "' + (u ? u.usuario : uid) + '" e o perfil. Não pode ser desfeito.',
        confirmar: 'Excluir',
        perigo: true
      }).then(function (ok) {
        if (!ok) return;
        SAGETI.store.excluirUsuario(uid).then(function (r) {
          if (r.ok) {
            UI.toast('success', 'Usuário excluído', '');
            carregar(container);
          } else {
            UI.toast('error', 'Não foi possível excluir', r.erro);
          }
        });
      });
    }
    container.addEventListener('click', aoClicar);

    return { destruir: function () { container.removeEventListener('click', aoClicar); } };
  }

  SAGETI.pages = SAGETI.pages || {};
  SAGETI.pages.usuarios = {
    titulo: 'Usuários',
    subtitulo: 'Contas e perfis de acesso',
    montar: montar
  };

})(window.SAGETI);
