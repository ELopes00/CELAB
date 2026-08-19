/* ==========================================================================
   SAGE-TI — Aba: Usuários
   --------------------------------------------------------------------------
   Lista, cria, define perfil e revoga acesso — tudo funcionando no plano
   gratuito (Spark), sem depender de Cloud Functions:
     · Criar usuário usa uma instância AUXILIAR do Firebase App, só pra a
       criação da conta não trocar a sessão de quem está logado.
     · "Revogar acesso" apaga o documento de perfil (a pessoa some das
       permissões na hora), mas não apaga a conta de login em si — isso
       exige Admin SDK de verdade (Cloud Function `excluirUsuario`, que só
       fica disponível quando SAGETI.APP.cloudFunctionsHabilitadas virar
       true, depois do upgrade pro plano Blaze).
   Todas as ações são exclusivas de Administrador: os botões só existem no
   DOM para quem tem a permissão (UX), mas quem barra de verdade são as
   Firestore Rules (create/update/delete de /usuarios exigem ehAdmin()).
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  var UI = SAGETI.ui;
  var U = SAGETI.util;

  var usuarios = [];
  var carregando = false;

  var PERFIS_ATRIBUIVEIS = ['admin', 'tecnico'];

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
        '<button class="btn btn--primary btn--sm" data-acao="adicionar">' +
          UI.icone('plus', 14) + '<span>Adicionar usuário</span></button>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card__body card__body--flush">' +
          '<div class="table-wrap" id="usr-tabela"></div>' +
        '</div>' +
      '</div>';
  }

  function selectPerfilHTML(u, meuUid) {
    var opcoes = PERFIS_ATRIBUIVEIS.slice();
    if (u.perfil && opcoes.indexOf(u.perfil) === -1) opcoes.push(u.perfil);
    var souEu = u.id === meuUid;

    return '<select class="select select--sm" data-mudar-perfil="' + U.esc(u.id) + '"' +
      (souEu ? ' disabled title="Você não pode alterar o próprio perfil"' : '') + '>' +
      opcoes.map(function (p) {
        var rotulo = (SAGETI.PERFIS[p] || {}).rotulo || p;
        return '<option value="' + U.esc(p) + '"' + (p === u.perfil ? ' selected' : '') + '>' +
          U.esc(rotulo) + '</option>';
      }).join('') + '</select>';
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
      var souEu = u.id === meuUid;

      var acoes = souEu
        ? '<span class="muted" style="font-size:11.5px">Você</span>'
        : '<button class="icon-btn" data-revogar-acesso="' + U.esc(u.id) + '" ' +
            'title="Revogar acesso" aria-label="Revogar acesso">' + UI.icone('cadeado', 15) + '</button> ' +
          (SAGETI.APP.cloudFunctionsHabilitadas
            ? '<button class="icon-btn" data-excluir-usuario="' + U.esc(u.id) + '" ' +
              'title="Excluir conta definitivamente" aria-label="Excluir conta definitivamente">' +
              UI.icone('lixeira', 15) + '</button>'
            : '');

      html += '<tr data-id="' + U.esc(u.id) + '">' +
        '<td class="strong">' + U.esc(u.usuario || '—') + '</td>' +
        '<td>' + U.esc(u.nome || '—') + '</td>' +
        '<td>' + selectPerfilHTML(u, meuUid) + '</td>' +
        '<td class="col-actions">' + acoes + '</td>' +
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

  /* ---------- Modal: adicionar usuário --------------------------------------- */

  function abrirAdicionar(container) {
    var corpo = '<form id="form-add-usuario" novalidate><div class="form-grid">' +
      '<div class="field">' +
        '<label for="add-usuario">Usuário <span class="req">*</span></label>' +
        '<input class="input" type="text" id="add-usuario" name="usuario" autocomplete="off" data-obrigatorio>' +
        '<span class="field__error">Informe o nome de usuário.</span>' +
      '</div>' +
      '<div class="field">' +
        '<label for="add-nome">Nome completo</label>' +
        '<input class="input" type="text" id="add-nome" name="nome" autocomplete="off">' +
      '</div>' +
      '<div class="field">' +
        '<label for="add-perfil">Perfil <span class="req">*</span></label>' +
        '<select class="select" id="add-perfil" name="perfil" data-obrigatorio>' +
          PERFIS_ATRIBUIVEIS.map(function (p) {
            return '<option value="' + p + '">' + U.esc((SAGETI.PERFIS[p] || {}).rotulo || p) + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      '<div class="field">' +
        '<label for="add-senha">Senha <span class="req">*</span></label>' +
        '<input class="input" type="password" id="add-senha" name="senha" autocomplete="new-password" ' +
          'minlength="6" data-obrigatorio>' +
        '<span class="field__help">Mínimo de 6 caracteres.</span>' +
        '<span class="field__error">Informe uma senha de ao menos 6 caracteres.</span>' +
      '</div>' +
      '<div class="field">' +
        '<label for="add-senha2">Confirmar senha <span class="req">*</span></label>' +
        '<input class="input" type="password" id="add-senha2" autocomplete="new-password" data-obrigatorio>' +
        '<span class="field__error">As senhas não coincidem.</span>' +
      '</div>' +
    '</div></form>';

    UI.modal({
      titulo: 'Adicionar usuário',
      subtitulo: 'Cria o login e o perfil de acesso',
      corpo: corpo,
      botoes: [
        { texto: 'Cancelar', classe: 'btn--ghost' },
        {
          texto: 'Criar', classe: 'btn--primary', icone: 'check',
          acao: function (caixa) {
            var form = caixa.querySelector('#form-add-usuario');
            if (!UI.validarForm(form)) {
              UI.toast('warn', 'Campos obrigatórios', 'Preencha os campos destacados.');
              return false;
            }
            var senha = caixa.querySelector('#add-senha').value;
            var senha2 = caixa.querySelector('#add-senha2').value;
            if (senha !== senha2) {
              UI.marcarErro(caixa.querySelector('#add-senha2'), 'As senhas não coincidem.');
              return false;
            }

            var dados = UI.dadosForm(form);
            SAGETI.store.criarUsuario(dados).then(function (r) {
              if (!r.ok) return UI.toast('error', 'Não foi possível criar', r.erro);
              UI.fecharModal();
              UI.toast('success', 'Usuário criado', '"' + dados.usuario + '" já pode entrar no sistema.');
              carregar(container);
            });
            return false;
          }
        }
      ]
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
      if (e.target.closest('[data-acao="adicionar"]')) return abrirAdicionar(container);

      var alvoRevogar = e.target.closest('[data-revogar-acesso]');
      if (alvoRevogar) {
        var uidR = alvoRevogar.getAttribute('data-revogar-acesso');
        var uR = usuarios.find(function (x) { return x.id === uidR; });
        return UI.confirmar({
          titulo: 'Revogar acesso',
          mensagem: 'Remove o perfil de "' + (uR ? uR.usuario : uidR) + '" — a pessoa perde toda ' +
            'permissão dentro do sistema imediatamente. A conta de login em si não é apagada (isso ' +
            'exige o plano Blaze); se precisar, o acesso pode ser recriado depois.',
          confirmar: 'Revogar acesso',
          perigo: true
        }).then(function (ok) {
          if (!ok) return;
          SAGETI.store.revogarAcessoUsuario(uidR).then(function (r) {
            if (r.ok) {
              UI.toast('success', 'Acesso revogado', '');
              carregar(container);
            } else {
              UI.toast('error', 'Não foi possível revogar', r.erro);
            }
          });
        });
      }

      var alvoExcluir = e.target.closest('[data-excluir-usuario]');
      if (alvoExcluir) {
        var uidX = alvoExcluir.getAttribute('data-excluir-usuario');
        var uX = usuarios.find(function (x) { return x.id === uidX; });
        return UI.confirmar({
          titulo: 'Excluir usuário',
          mensagem: 'Remove o login de "' + (uX ? uX.usuario : uidX) + '" e o perfil, de vez. Não pode ser desfeito.',
          confirmar: 'Excluir',
          perigo: true
        }).then(function (ok) {
          if (!ok) return;
          SAGETI.store.excluirUsuario(uidX).then(function (r) {
            if (r.ok) {
              UI.toast('success', 'Usuário excluído', '');
              carregar(container);
            } else {
              UI.toast('error', 'Não foi possível excluir', r.erro);
            }
          });
        });
      }
    }
    container.addEventListener('click', aoClicar);

    function aoMudarPerfil(e) {
      var sel = e.target.closest('[data-mudar-perfil]');
      if (!sel) return;
      var uid = sel.getAttribute('data-mudar-perfil');
      var novoPerfil = sel.value;
      SAGETI.store.atualizarPerfilUsuario(uid, novoPerfil).then(function (r) {
        if (r.ok) {
          UI.toast('success', 'Perfil atualizado', '');
          carregar(container);
        } else {
          UI.toast('error', 'Não foi possível alterar', r.erro);
          carregar(container); // desfaz a seleção visual, já que a troca não colou
        }
      });
    }
    container.addEventListener('change', aoMudarPerfil);

    return {
      destruir: function () {
        container.removeEventListener('click', aoClicar);
        container.removeEventListener('change', aoMudarPerfil);
      }
    };
  }

  SAGETI.pages = SAGETI.pages || {};
  SAGETI.pages.usuarios = {
    titulo: 'Usuários',
    subtitulo: 'Contas e perfis de acesso',
    montar: montar
  };

})(window.SAGETI);
