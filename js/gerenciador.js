/* ==========================================================================
   SAGE-TI — Gerenciador de listas
   --------------------------------------------------------------------------
   Interface para criar, renomear, excluir e restaurar as opções de qualquer
   dropdown do sistema. Aparece de duas formas:
     · modal, pelo botão de engrenagem ao lado de um campo (sem sair do
       formulário que está sendo preenchido);
     · painel completo, na aba Configurações.
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  var UI = SAGETI.ui;
  var U = SAGETI.util;
  var L = SAGETI.listas;

  function catalogo(chave) {
    return SAGETI.CATALOGO_LISTAS.find(function (c) { return c.chave === chave; }) ||
      { chave: chave, rotulo: chave, tipo: 'texto', icone: 'listas', ajuda: '' };
  }

  /* ---------- Painel de uma lista -------------------------------------------
     Devolve o HTML do editor de uma lista. `montar` liga os eventos.
     ---------------------------------------------------------------------- */

  function painelHTML(chave, filtro) {
    var meta = catalogo(chave);
    var itens = L.get(chave);
    var termo = U.slug(filtro || '');

    if (termo) {
      itens = itens.filter(function (i) {
        return U.slug(typeof i === 'string' ? i : i.valor).indexOf(termo) > -1;
      });
    }

    var html =
      '<div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px">' +
        '<div style="min-width:0;flex:1">' +
          '<div style="font-size:14.5px;font-weight:620">' + U.esc(meta.rotulo) + '</div>' +
          '<div style="font-size:12px;color:var(--text-muted);margin-top:2px">' +
            U.esc(meta.ajuda) + '</div>' +
        '</div>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-restaurar="' + chave + '">' +
          UI.icone('restaurar', 14) + '<span>Restaurar padrão</span></button>' +
      '</div>';

    /* --- formulário de inclusão --- */
    html += '<div style="background:var(--surface-2);border:1px solid var(--border);' +
      'border-radius:var(--radius);padding:12px;margin-bottom:12px">' +
      '<div class="form-grid" style="gap:10px">' +
        '<div class="field" style="grid-column:1/-1">' +
          '<label for="nova-opcao">Nova opção</label>' +
          '<div class="field__linha">' +
            '<input class="input" type="text" id="nova-opcao" ' +
              'placeholder="Digite e pressione Enter" autocomplete="off">' +
            '<button type="button" class="btn btn--primary btn--sm" data-add="' + chave + '">' +
              UI.icone('plus', 14) + '<span>Adicionar</span></button>' +
          '</div>' +
        '</div>';

    if (meta.tipo === 'status') {
      html +=
        '<div class="field">' +
          '<label for="nova-tom">Cor</label>' +
          '<select class="select" id="nova-tom">' +
            UI.opcoes(SAGETI.TONS.map(function (t) { return { valor: t.valor, rotulo: t.rotulo }; }), 'neutral', false) +
          '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label>Aparece em</label>' +
          '<div style="display:flex;gap:12px;flex-wrap:wrap;padding-top:6px">' +
            ctxCheck('nova-ctx', 'entrada', 'Entrada', true) +
            ctxCheck('nova-ctx', 'saida', 'Saída', false) +
            ctxCheck('nova-ctx', 'estoque', 'Estoque', false) +
          '</div>' +
        '</div>' +
        '<div class="field" style="grid-column:1/-1">' +
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
            '<input type="checkbox" id="nova-nolab" checked ' +
              'style="width:15px;height:15px;accent-color:var(--brand)">' +
            'O equipamento permanece no laboratório com este status' +
          '</label>' +
          '<span class="field__help">Desmarque para status de saída — o item deixa de contar no estoque.</span>' +
        '</div>';
    } else if (meta.tipo === 'modelo') {
      html +=
        '<div class="field" style="grid-column:1/-1">' +
          '<label for="nova-cat">Categoria do modelo</label>' +
          '<select class="select" id="nova-cat">' +
            UI.opcoes(L.get('equipamentos'), '', 'Sem categoria') + '</select>' +
          '<span class="field__help">Define em qual equipamento o modelo aparece primeiro.</span>' +
        '</div>';
    }

    html += '</div></div>';

    /* --- busca --- */
    html += '<div class="field" style="margin-bottom:10px">' +
      '<input class="input" type="search" id="filtro-opcoes" ' +
        'placeholder="Filtrar opções…" value="' + U.esc(filtro || '') + '">' +
      '</div>';

    /* --- lista --- */
    html += '<div class="opcoes-lista" id="opcoes-lista">';

    if (!itens.length) {
      html += '<div style="padding:28px;text-align:center;color:var(--text-muted);font-size:13px">' +
        (filtro ? 'Nenhuma opção corresponde ao filtro.' : 'A lista está vazia.') + '</div>';
    } else {
      itens.forEach(function (item) {
        var valor = typeof item === 'string' ? item : item.valor;
        var uso = L.contarUso(chave, valor);
        var extra = '';

        if (meta.tipo === 'status') {
          var ctx = (item.contextos || []).map(function (c) {
            return c === 'entrada' ? 'Entrada' : c === 'saida' ? 'Saída' : 'Estoque';
          }).join(' · ');
          extra = '<div class="opcao-item__meta">' + U.esc(ctx || 'nenhum formulário') +
            ' · ' + (item.noLab ? 'fica no laboratório' : 'sai do laboratório') + '</div>';
        } else if (meta.tipo === 'modelo') {
          var cat = L.equipamentoDoModelo(valor);
          extra = '<div class="opcao-item__meta">' +
            (cat ? U.esc(cat) : 'sem categoria') + '</div>';
        }

        html += '<div class="opcao-item" data-valor="' + U.esc(valor) + '">' +
          (meta.tipo === 'status'
            ? '<span class="chip__dot" style="background:var(--status-' +
              (item.tom === 'info' ? 'neutral' : (item.tom || 'neutral')) +
              ');width:9px;height:9px;border-radius:50%;flex:0 0 9px' +
              (item.tom === 'info' ? ';background:var(--brand)' : '') + '"></span>'
            : '') +
          '<div class="opcao-item__nome">' + U.esc(valor) + extra + '</div>' +
          (uso.total
            ? '<span class="opcao-item__uso" title="' + uso.equipamentos + ' equipamento(s), ' +
              uso.movimentacoes + ' movimentação(ões)">' + uso.total + ' uso(s)</span>'
            : '<span class="opcao-item__uso" style="opacity:.5">sem uso</span>') +
          '<button type="button" class="icon-btn" data-editar-opcao="' + U.esc(valor) +
            '" title="Editar" aria-label="Editar">' + UI.icone('editar', 14) + '</button>' +
          '<button type="button" class="icon-btn" data-excluir-opcao="' + U.esc(valor) +
            '" title="Excluir" aria-label="Excluir">' + UI.icone('lixeira', 14) + '</button>' +
        '</div>';
      });
    }

    html += '</div>' +
      '<div style="font-size:11.5px;color:var(--text-muted);margin-top:10px">' +
        itens.length + ' opção(ões) exibida(s) · renomear atualiza automaticamente os ' +
        'registros que usam o valor antigo.' +
      '</div>';

    return html;
  }

  function ctxCheck(nome, valor, rotulo, marcado) {
    return '<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;' +
      'font-weight:400;color:var(--text-secondary);cursor:pointer">' +
      '<input type="checkbox" name="' + nome + '" value="' + valor + '"' +
      (marcado ? ' checked' : '') +
      ' style="width:15px;height:15px;accent-color:var(--brand)">' + rotulo + '</label>';
  }

  /* ---------- Ligação de eventos do painel ---------------------------------- */

  /**
   * @param {HTMLElement} raiz     container do painel
   * @param {string} chave         lista sendo editada
   * @param {Function} redesenhar  chamada após cada mudança
   */
  function ligar(raiz, chave, redesenhar) {
    var meta = catalogo(chave);

    function lerExtras() {
      if (meta.tipo === 'status') {
        var ctx = [];
        raiz.querySelectorAll('input[name="nova-ctx"]:checked').forEach(function (c) {
          ctx.push(c.value);
        });
        return {
          tom: (raiz.querySelector('#nova-tom') || {}).value || 'neutral',
          noLab: !!(raiz.querySelector('#nova-nolab') || {}).checked,
          contextos: ctx
        };
      }
      if (meta.tipo === 'modelo') {
        return { equipamento: (raiz.querySelector('#nova-cat') || {}).value || '' };
      }
      return {};
    }

    function adicionar() {
      var campo = raiz.querySelector('#nova-opcao');
      var valor = campo.value;
      if (!valor.trim()) { campo.focus(); return; }

      var r = L.adicionar(chave, valor, lerExtras());
      if (!r.ok) return UI.toast('error', 'Não foi possível adicionar', r.erro);

      UI.toast('success', 'Opção adicionada', '"' + r.valor + '" entrou em ' + meta.rotulo + '.');
      campo.value = '';
      redesenhar();
      var novo = raiz.querySelector('#nova-opcao');
      if (novo) novo.focus();
    }

    raiz.addEventListener('click', function (e) {
      var alvo;

      if ((alvo = e.target.closest('[data-add]'))) return adicionar();

      if ((alvo = e.target.closest('[data-editar-opcao]'))) {
        return abrirEdicao(chave, alvo.getAttribute('data-editar-opcao'), redesenhar);
      }

      if ((alvo = e.target.closest('[data-excluir-opcao]'))) {
        return excluir(chave, alvo.getAttribute('data-excluir-opcao'), redesenhar);
      }

      if ((alvo = e.target.closest('[data-restaurar]'))) {
        return UI.confirmar({
          titulo: 'Restaurar ' + meta.rotulo,
          mensagem: 'As opções desta lista voltam ao padrão de fábrica. Opções criadas ' +
            'por você que não fazem parte do padrão serão perdidas. Os registros já ' +
            'gravados não são alterados. Continuar?',
          confirmar: 'Restaurar',
          perigo: true
        }).then(function (ok) {
          if (!ok) return;
          L.restaurarPadrao(chave);
          UI.toast('success', 'Lista restaurada', meta.rotulo + ' voltou ao padrão.');
          redesenhar();
        });
      }
    });

    raiz.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.id === 'nova-opcao') {
        e.preventDefault();
        adicionar();
      }
    });

    var filtro = raiz.querySelector('#filtro-opcoes');
    if (filtro) {
      filtro.addEventListener('input', U.debounce(function () {
        redesenhar(this.value);
      }, 220).bind(filtro));
    }
  }

  /* ---------- Edição de uma opção ------------------------------------------- */

  function abrirEdicao(chave, valor, redesenhar) {
    var meta = catalogo(chave);
    var uso = L.contarUso(chave, valor);
    var item = meta.tipo === 'status' ? L.statusMeta(valor) : null;

    var corpo = '<form id="form-opcao" novalidate><div class="form-grid">' +
      '<div class="field field--full">' +
        '<label for="op-valor">Nome</label>' +
        '<input class="input" type="text" id="op-valor" value="' + U.esc(valor) + '">' +
        (uso.total
          ? '<span class="field__help">Ao renomear, ' + uso.total + ' registro(s) serão ' +
            'atualizados para o novo nome.</span>'
          : '<span class="field__help">Nenhum registro usa esta opção.</span>') +
      '</div>';

    if (meta.tipo === 'status') {
      corpo +=
        '<div class="field">' +
          '<label for="op-tom">Cor</label>' +
          '<select class="select" id="op-tom">' +
            UI.opcoes(SAGETI.TONS.map(function (t) { return { valor: t.valor, rotulo: t.rotulo }; }),
              item.tom, false) + '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label>Aparece em</label>' +
          '<div style="display:flex;gap:12px;flex-wrap:wrap;padding-top:6px">' +
            ctxCheck('op-ctx', 'entrada', 'Entrada', (item.contextos || []).indexOf('entrada') > -1) +
            ctxCheck('op-ctx', 'saida', 'Saída', (item.contextos || []).indexOf('saida') > -1) +
            ctxCheck('op-ctx', 'estoque', 'Estoque', (item.contextos || []).indexOf('estoque') > -1) +
          '</div>' +
        '</div>' +
        '<div class="field field--full">' +
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
            '<input type="checkbox" id="op-nolab"' + (item.noLab ? ' checked' : '') +
              ' style="width:15px;height:15px;accent-color:var(--brand)">' +
            'O equipamento permanece no laboratório com este status' +
          '</label>' +
          '<span class="field__help">Vale ao escolher o status na aba Estoque. Entradas e ' +
            'saídas definem a presença física pela própria operação.</span>' +
        '</div>' +
        '<div class="field field--full">' +
          '<label for="op-desc">Descrição (dica exibida no chip)</label>' +
          '<input class="input" type="text" id="op-desc" value="' + U.esc(item.desc || '') + '">' +
        '</div>';
    } else if (meta.tipo === 'modelo') {
      corpo +=
        '<div class="field field--full">' +
          '<label for="op-cat">Categoria do modelo</label>' +
          '<select class="select" id="op-cat">' +
            UI.opcoes(L.get('equipamentos'), L.equipamentoDoModelo(valor), 'Sem categoria') +
          '</select>' +
        '</div>';
    }

    corpo += '</div></form>';

    UI.modal({
      titulo: 'Editar opção',
      subtitulo: meta.rotulo,
      corpo: corpo,
      botoes: [
        { texto: 'Cancelar', classe: 'btn--ghost' },
        {
          texto: 'Salvar', classe: 'btn--primary', icone: 'check',
          acao: function (caixa) {
            var novo = caixa.querySelector('#op-valor').value;

            if (meta.tipo === 'status') {
              var ctx = [];
              caixa.querySelectorAll('input[name="op-ctx"]:checked').forEach(function (c) {
                ctx.push(c.value);
              });
              var r = L.atualizarStatus(valor, {
                valor: novo,
                tom: caixa.querySelector('#op-tom').value,
                noLab: caixa.querySelector('#op-nolab').checked,
                desc: caixa.querySelector('#op-desc').value,
                contextos: ctx
              });
              if (!r.ok) { UI.toast('error', 'Não foi possível salvar', r.erro); return false; }
              UI.toast('success', 'Status atualizado',
                r.afetados ? r.afetados + ' registro(s) atualizados.' : 'Alterações salvas.');
            } else {
              var rr = L.renomear(chave, valor, novo);
              if (!rr.ok) { UI.toast('error', 'Não foi possível salvar', rr.erro); return false; }
              if (meta.tipo === 'modelo') {
                L.vincularModelo(rr.valor, caixa.querySelector('#op-cat').value);
              }
              UI.toast('success', 'Opção atualizada',
                rr.afetados ? rr.afetados + ' registro(s) atualizados.' : 'Alterações salvas.');
            }
            redesenhar();
          }
        }
      ]
    });
  }

  /* ---------- Exclusão ------------------------------------------------------ */

  function excluir(chave, valor, redesenhar) {
    var meta = catalogo(chave);
    var r = L.excluir(chave, valor);

    if (r.ok) {
      UI.toast('success', 'Opção excluída', '"' + r.valor + '" saiu de ' + meta.rotulo + '.');
      return redesenhar();
    }

    if (!r.emUso) return UI.toast('error', 'Não foi possível excluir', r.erro);

    // Em uso: oferece a saída segura (renomear) antes da forçada.
    UI.modal({
      titulo: 'Opção em uso',
      largura: 'sm',
      corpo:
        '<p style="font-size:13.5px;color:var(--text-secondary);margin:0 0 12px">' +
          '<strong>' + U.esc(valor) + '</strong> está sendo usada por ' +
          r.uso.equipamentos + ' equipamento(s) e ' + r.uso.movimentacoes +
          ' movimentação(ões).</p>' +
        '<div class="alert alert--warning" style="margin:0">' + UI.icone('alerta', 17) +
          '<span>Excluir de qualquer forma mantém o texto nos registros antigos, mas a ' +
          'opção deixa de aparecer nos formulários e nos filtros. Se o objetivo é corrigir ' +
          'o nome, prefira <strong>renomear</strong> — os registros são atualizados juntos.' +
          '</span></div>',
      botoes: [
        { texto: 'Cancelar', classe: 'btn--ghost' },
        { texto: 'Renomear', classe: 'btn--outline', icone: 'editar',
          acao: function () { setTimeout(function () { abrirEdicao(chave, valor, redesenhar); }, 60); } },
        { texto: 'Excluir mesmo assim', classe: 'btn--danger', icone: 'lixeira',
          acao: function () {
            var f = L.excluir(chave, valor, { forcar: true });
            if (!f.ok) return UI.toast('error', 'Não foi possível excluir', f.erro);
            UI.toast('warn', 'Opção excluída',
              'Os ' + r.uso.total + ' registro(s) mantiveram o texto "' + valor + '".');
            redesenhar();
          } }
      ]
    });
  }

  /* ---------- Abertura em modal (botão ao lado do campo) -------------------- */

  /**
   * @param {string} chave      lista a editar
   * @param {string} campoId    id do <select> que deve absorver a novidade
   */
  function abrirModal(chave, campoId) {
    if (!SAGETI.auth.permissao('podeGerenciarListas')) {
      return UI.toast('warn', 'Sem permissão', 'Seu perfil não pode gerenciar listas.');
    }

    var meta = catalogo(chave);
    var caixa = document.createElement('div');
    var filtroAtual = '';

    function redesenhar(filtro) {
      if (filtro !== undefined) filtroAtual = filtro;
      caixa.innerHTML = painelHTML(chave, filtroAtual);
      ligar(caixa, chave, redesenhar);
      var f = caixa.querySelector('#filtro-opcoes');
      if (f && filtroAtual) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    }
    redesenhar();

    UI.modal({
      titulo: 'Gerenciar: ' + meta.rotulo,
      subtitulo: 'As alterações valem para todo o sistema, na hora',
      corpo: caixa,
      botoes: [{
        texto: 'Concluir', classe: 'btn--primary',
        acao: function () {
          // Devolve o foco ao campo de origem já repintado.
          if (!campoId) return;
          var campo = document.getElementById(campoId);
          if (campo) setTimeout(function () { campo.focus(); }, 60);
        }
      }]
    });
  }

  /* ---------- Delegação global do botão de engrenagem ---------------------- */

  var ligado = false;

  function ligarGlobal() {
    if (ligado) return;
    ligado = true;
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-gerenciar-lista]');
      if (!b) return;
      e.preventDefault();
      abrirModal(b.getAttribute('data-gerenciar-lista'), b.getAttribute('data-alvo-campo'));
    });
  }

  SAGETI.gerenciador = {
    painelHTML: painelHTML,
    ligar: ligar,
    abrirModal: abrirModal,
    abrirEdicao: abrirEdicao,
    ligarGlobal: ligarGlobal,
    catalogo: catalogo
  };

})(window.SAGETI);
