/* ==========================================================================
   SAGE-TI — Aba: Notebooks
   --------------------------------------------------------------------------
   Coleção própria (SAGETI.store.listarNotebooks/criarNotebook/...), separada
   de `equipamentos` — status aqui é um conjunto FECHADO de 3 valores, não
   passa pelo sistema de listas editáveis (SAGETI.listas). Local/Setor de
   destino segue o mesmo padrão de Prédio/Setor do Estoque.
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  var UI = SAGETI.ui;
  var U = SAGETI.util;

  /* ---------- Modelos de notebook: mini-lista própria -------------------------
     Um único documento em /listas/modelosNotebook ({itens:[...]}), com
     onSnapshot próprio. Não usa SAGETI.listas/gerenciador.js: a contagem de
     uso e a renomeação em cascata desses módulos são hardcoded para
     equipamentos/movimentações — bolar isso pra uma lista de um único
     consumidor (esta página) seria complexidade desnecessária.
     -------------------------------------------------------------------- */

  var modelos = ['Positivo N6440'];
  var pararModelos = null;
  var redesenharGerenciarModal = null; // setado enquanto o modal "Gerenciar modelos" está aberto

  function docModelos() { return SAGETI.fb.db.collection('listas').doc('modelosNotebook'); }

  function ligarModelos(aoMudar) {
    pararModelos = docModelos().onSnapshot(function (doc) {
      var itens = doc.exists && Array.isArray(doc.data().itens) ? doc.data().itens : null;
      modelos = itens && itens.length ? itens : ['Positivo N6440'];
      if (redesenharGerenciarModal) redesenharGerenciarModal();
      aoMudar();
    }, function (erro) {
      console.error('[SAGE-TI] Falha ao sincronizar modelos de notebook:', erro);
    });
  }

  function desligarModelos() {
    if (pararModelos) { pararModelos(); pararModelos = null; }
  }

  function usoDoModelo(nome) {
    return SAGETI.store.listarNotebooks().filter(function (n) {
      return U.slug(n.modelo) === U.slug(nome);
    }).length;
  }

  function adicionarModelo(nome) {
    var limpo = String(nome || '').trim();
    if (!limpo) return { ok: false, erro: 'Informe o nome do modelo.' };
    var existe = modelos.some(function (m) { return U.slug(m) === U.slug(limpo); });
    if (existe) return { ok: false, erro: 'Esse modelo já existe na lista.' };
    docModelos().set({ itens: modelos.concat([limpo]) }).catch(function (erro) {
      UI.toast('error', 'Falha ao salvar modelo', erro.message);
    });
    return { ok: true };
  }

  function removerModelo(nome) {
    if (usoDoModelo(nome) > 0) {
      return { ok: false, erro: 'Esse modelo está em uso e não pode ser removido.' };
    }
    docModelos().set({ itens: modelos.filter(function (m) { return m !== nome; }) }).catch(function (erro) {
      UI.toast('error', 'Falha ao remover modelo', erro.message);
    });
    return { ok: true };
  }

  /* ---------- Status (3 valores fechados) -------------------------------- */

  var STATUS_NOTEBOOK = [
    { valor: 'Em estoque',      classe: 'estoque',         tom: 'good' },
    { valor: 'Disponibilizado', classe: 'disponibilizado', tom: 'brand' },
    { valor: 'Garantia',        classe: 'garantia',        tom: 'warning' }
  ];

  function classeStatusBadge(valor) {
    var s = STATUS_NOTEBOOK.filter(function (s) { return s.valor === valor; })[0];
    return s ? s.classe : 'estoque';
  }

  /* ---------- Estado da view (filtro de status + edição inline) ---------- */

  var filtro = { status: '' };
  var editandoLocalId = null;

  function notebooksFiltrados() {
    var lista = SAGETI.store.listarNotebooks();
    if (filtro.status) lista = lista.filter(function (n) { return n.status === filtro.status; });
    return U.ordenarPor(lista, 'tombo', 'asc');
  }

  /* ---------- Esqueleto ---------------------------------------------------- */

  function esqueleto() {
    return '' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-head__title">Notebooks</h1>' +
          '<p class="page-head__sub">Inventário de notebooks — status e localização</p>' +
        '</div>' +
        '<div class="page-head__spacer"></div>' +
        (SAGETI.auth.permissao('podeEditar')
          ? '<button class="btn btn--primary" data-acao="novo">' +
              UI.icone('plus', 16) + '<span>Adicionar notebook</span></button>'
          : '') +
      '</div>' +
      '<div class="nb-dash" id="nb-dash"></div>' +
      '<div id="nb-filtro-bar"></div>' +
      '<div class="card" id="nb-tabela-card">' +
        '<div class="card__body card__body--flush"><div class="table-wrap" id="nb-tabela"></div></div>' +
      '</div>';
  }

  /* ---------- Dashboard (nunca filtra a si mesmo — só a tabela filtra) ---- */

  function resumoNotebooks() {
    var todos = SAGETI.store.listarNotebooks();
    var porStatus = { 'Em estoque': 0, 'Disponibilizado': 0, 'Garantia': 0 };
    var porLocal = {};
    todos.forEach(function (n) {
      if (porStatus[n.status] === undefined) porStatus[n.status] = 0;
      porStatus[n.status]++;
      var k = n.predio || 'Não informado';
      porLocal[k] = (porLocal[k] || 0) + 1;
    });
    var locais = Object.keys(porLocal).map(function (k) { return { local: k, n: porLocal[k] }; })
      .sort(function (a, b) { return b.n - a.n; });
    return { total: todos.length, porStatus: porStatus, locais: locais };
  }

  function cardStatusHTML(item, r) {
    var selecionado = filtro.status === item.valor;
    var esmaecido = !!filtro.status && !selecionado;
    return '<div class="stat stat--' + item.tom + ' stat--clicavel' +
      (selecionado ? ' is-selecionado' : '') + (esmaecido ? ' is-dimmed' : '') + '" ' +
      'data-status-filtro="' + U.esc(item.valor) + '" role="button" tabindex="0" ' +
      'aria-pressed="' + selecionado + '">' +
      '<div class="stat__label"><span class="dot"></span>' + U.esc(item.valor) + '</div>' +
      '<div class="stat__value">' + U.numero(r.porStatus[item.valor] || 0) + '</div>' +
      '<div class="stat__foot">clique para filtrar a tabela</div>' +
    '</div>';
  }

  function desenharDashboard(container) {
    var r = resumoNotebooks();
    var maxLocal = r.locais.length ? r.locais[0].n : 1;

    var html =
      '<div class="stat stat--brand">' +
        '<div class="stat__label"><span class="dot"></span>Total de notebooks</div>' +
        '<div class="stat__value">' + U.numero(r.total) + '</div>' +
        '<div class="stat__foot">Cadastrados na aba</div>' +
      '</div>' +
      STATUS_NOTEBOOK.map(function (item) { return cardStatusHTML(item, r); }).join('') +
      '<div class="card"><div class="card__body nb-locais">' +
        '<div class="section-title" style="margin-top:0">Notebooks por local</div>' +
        (r.locais.length
          ? r.locais.map(function (l) {
              return '<div class="nb-locais__linha">' +
                '<span class="nb-locais__rotulo" title="' + U.esc(l.local) + '">' + U.esc(l.local) + '</span>' +
                '<span class="nb-locais__trilha"><span class="nb-locais__barra" style="width:' +
                  Math.round(l.n / maxLocal * 100) + '%"></span></span>' +
                '<span class="nb-locais__valor">' + l.n + '</span>' +
              '</div>';
            }).join('')
          : '<p style="font-size:12.5px;color:var(--text-muted);margin:0">Nenhum notebook cadastrado ainda.</p>') +
      '</div></div>';

    container.querySelector('#nb-dash').innerHTML = html;
  }

  /* ---------- Chip do filtro ativo ----------------------------------------- */

  function renderFiltroBar(container) {
    var alvo = container.querySelector('#nb-filtro-bar');
    if (!filtro.status) { alvo.innerHTML = ''; return; }
    alvo.innerHTML =
      '<div style="margin-bottom:12px">' +
        '<button type="button" class="chip chip--tom-info" data-remover="status" ' +
          'title="Remover este filtro" style="cursor:pointer;border-style:solid">' +
          '<span class="chip__dot"></span>Status: <strong>' + U.esc(filtro.status) + '</strong>' +
          ' <span aria-hidden="true" style="opacity:.65;margin-left:2px">&times;</span>' +
          '<span class="sr-only">Remover filtro</span>' +
        '</button>' +
      '</div>';
  }

  /* ---------- Tabela --------------------------------------------------------- */

  function celulaLocal(n) {
    if (editandoLocalId === n.id) {
      var predios = SAGETI.listas.get('predios');
      var setores = SAGETI.listas.get('setores');

      var opcoesPredio = predios.map(function (p) {
        return '<option value="' + U.esc(p) + '"' + (p === n.predio ? ' selected' : '') + '>' + U.esc(p) + '</option>';
      }).join('');
      if (n.predio && predios.indexOf(n.predio) === -1) {
        opcoesPredio += '<option value="' + U.esc(n.predio) + '" selected>' + U.esc(n.predio) + '</option>';
      }

      var opcoesSetor = '<option value="">— nenhum setor —</option>' + setores.map(function (s) {
        return '<option value="' + U.esc(s) + '"' + (s === n.setor ? ' selected' : '') + '>' + U.esc(s) + '</option>';
      }).join('');
      if (n.setor && setores.indexOf(n.setor) === -1) {
        opcoesSetor += '<option value="' + U.esc(n.setor) + '" selected>' + U.esc(n.setor) + '</option>';
      }

      return '<div class="field__linha" data-local-edit="' + U.esc(n.id) + '">' +
        '<select class="select" data-local-select title="Prédio">' + opcoesPredio + '</select>' +
        '<select class="select" data-setor-select title="Setor / Unidade">' + opcoesSetor + '</select>' +
        '<button type="button" class="icon-btn" data-local-salvar="' + U.esc(n.id) + '" ' +
          'title="Salvar" aria-label="Salvar local">' + UI.icone('check', 15) + '</button>' +
        '<button type="button" class="icon-btn" data-local-cancelar ' +
          'title="Cancelar" aria-label="Cancelar edição">' + UI.icone('x', 15) + '</button>' +
      '</div>';
    }

    var texto = [n.predio, n.setor].filter(Boolean).map(U.esc).join(' · ');
    return '<div style="display:flex;align-items:center;gap:6px">' +
      '<span>' + (texto || '<span class="muted">—</span>') + '</span>' +
      '<button type="button" class="icon-btn" data-local-abrir="' + U.esc(n.id) + '" ' +
        'title="Alterar local" aria-label="Alterar local">' + UI.icone('editar', 13) + '</button>' +
    '</div>';
  }

  function desenharTabela(container) {
    var alvo = container.querySelector('#nb-tabela');
    var lista = notebooksFiltrados();

    if (!lista.length) {
      alvo.innerHTML = UI.estadoVazio(
        filtro.status ? 'Nenhum notebook com esse status' : 'Nenhum notebook cadastrado',
        filtro.status
          ? 'Remova o filtro para ver todos os notebooks.'
          : 'Comece adicionando um notebook.',
        ''
      );
      return;
    }

    var html = '<table class="table"><thead><tr>' +
      '<th>Ordem</th><th>Tombo</th><th>Local / Unidade</th><th>Chamado</th><th>Modelo</th><th>Status</th>' +
      '<th class="col-actions">Observações</th>' +
      '</tr></thead><tbody>';

    lista.forEach(function (n, i) {
      var o = n.observacoes || {};
      var temNotas = !!(o.notas || o.sistemaOperacional);
      html += '<tr data-row="' + U.esc(n.id) + '">' +
        '<td class="num muted">' + (i + 1) + '</td>' +
        '<td class="num strong">' + U.esc(n.tombo) + '</td>' +
        '<td>' + celulaLocal(n) + '</td>' +
        '<td class="num">' + (n.chamado ? U.esc(n.chamado) : '<span class="muted">—</span>') + '</td>' +
        '<td>' + U.esc(n.modelo) + '</td>' +
        '<td><span class="nb-badge nb-badge--' + classeStatusBadge(n.status) + '">' +
          '<span class="nb-badge__dot"></span>' + U.esc(n.status) + '</span></td>' +
        '<td class="col-actions">' +
          '<button type="button" class="icon-btn' + (temNotas ? ' has-notas' : '') + '" ' +
            'data-obs-abrir="' + U.esc(n.id) + '" title="Observações e sistema operacional" ' +
            'aria-label="Observações">' + UI.icone('relatorio', 15) + '</button>' +
        '</td>' +
      '</tr>';
    });

    html += '</tbody></table>';
    alvo.innerHTML = html;
  }

  /* ---------- Filtro de status (drill-down) -------------------------------- */

  function aplicarFiltroStatus(container, valor) {
    filtro.status = (filtro.status === valor) ? '' : valor;
    desenharDashboard(container);
    renderFiltroBar(container);
    desenharTabela(container);
    if (!filtro.status) return;

    var cartao = container.querySelector('#nb-tabela-card');
    if (!cartao) return;
    cartao.scrollIntoView({ behavior: 'smooth', block: 'start' });
    cartao.classList.remove('card--flash');
    void cartao.offsetWidth; // reinicia a animação se o mesmo card já tinha piscado
    cartao.classList.add('card--flash');
  }

  /* ---------- Modal: Observações -------------------------------------------- */

  var OPCOES_SO = ['', 'Windows 10 Home', 'Windows 10 Pro', 'Windows 11 Home', 'Windows 11 Pro', 'Linux', 'Outro'];
  var OPCOES_LICENCA = ['', 'OEM', 'Volume (KMS)', 'Não licenciado', 'Outro'];

  function abrirObservacoes(nb) {
    var o = nb.observacoes || {};
    var corpo = '<div class="form-grid">' +
      '<div class="field"><label for="obs-so">Sistema operacional</label>' +
        '<select class="select" id="obs-so">' +
          OPCOES_SO.map(function (v) {
            return '<option value="' + U.esc(v) + '"' + (v === o.sistemaOperacional ? ' selected' : '') + '>' +
              (v || 'Não informado') + '</option>';
          }).join('') +
        '</select></div>' +
      '<div class="field"><label for="obs-versao">Versão / build</label>' +
        '<input class="input" type="text" id="obs-versao" placeholder="Ex.: 23H2" value="' +
          U.esc(o.versaoBuild || '') + '"></div>' +
      '<div class="field"><label for="obs-licenca">Licença</label>' +
        '<select class="select" id="obs-licenca">' +
          OPCOES_LICENCA.map(function (v) {
            return '<option value="' + U.esc(v) + '"' + (v === o.licenca ? ' selected' : '') + '>' +
              (v || 'Não informado') + '</option>';
          }).join('') +
        '</select></div>' +
      '<div class="field field--full"><label for="obs-notas">Notas gerais</label>' +
        '<textarea class="textarea" id="obs-notas" placeholder="Chamado com o fabricante, chave pendente, avarias…">' +
          U.esc(o.notas || '') + '</textarea></div>' +
    '</div>';

    UI.modal({
      titulo: 'Observações — Tombo ' + nb.tombo,
      subtitulo: nb.modelo + (nb.predio ? ' · ' + nb.predio : ''),
      corpo: corpo,
      botoes: [
        { texto: 'Cancelar', classe: 'btn--ghost' },
        {
          texto: 'Salvar', classe: 'btn--primary', icone: 'check',
          acao: function (caixa) {
            var novaObs = {
              sistemaOperacional: caixa.querySelector('#obs-so').value,
              versaoBuild: caixa.querySelector('#obs-versao').value.trim(),
              licenca: caixa.querySelector('#obs-licenca').value,
              notas: caixa.querySelector('#obs-notas').value.trim()
            };
            SAGETI.store.atualizarNotebook(nb.id, { observacoes: novaObs }).then(function (r) {
              if (!r.ok) return UI.toast('error', 'Não foi possível salvar', r.erro);
              UI.fecharModal();
              UI.toast('success', 'Observações salvas', 'Tombo ' + nb.tombo + ' atualizado.');
            });
            return false;
          }
        }
      ]
    });
  }

  /* ---------- Modal: Gerenciar modelos -------------------------------------- */

  function painelModelosHTML() {
    if (!modelos.length) {
      return '<p style="font-size:12.5px;color:var(--text-muted);text-align:center;padding:16px 0">' +
        'Nenhum modelo cadastrado ainda.</p>';
    }
    return '<div style="display:flex;flex-direction:column;gap:7px">' +
      modelos.map(function (m) {
        var uso = usoDoModelo(m);
        return '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;' +
          'border:1px solid var(--border);border-radius:8px;background:var(--surface-2);font-size:13px">' +
          '<span style="flex:1">' + U.esc(m) +
            (uso ? ' <span class="muted" style="font-weight:400">· em uso por ' + uso + ' notebook(s)</span>' : '') +
          '</span>' +
          '<button type="button" class="icon-btn" data-modelo-remover="' + U.esc(m) + '" ' +
            (uso ? 'disabled title="Em uso — não pode ser removido"' : 'title="Remover"') +
            ' aria-label="Remover ' + U.esc(m) + '">' + UI.icone('x', 13) + '</button>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function abrirGerenciarModelos() {
    if (!SAGETI.auth.permissao('podeGerenciarListas')) {
      return UI.toast('warn', 'Sem permissão', 'Seu perfil não pode gerenciar listas.');
    }

    var caixa = document.createElement('div');

    function redesenhar() {
      caixa.innerHTML =
        '<div id="ger-modelos-lista">' + painelModelosHTML() + '</div>' +
        '<div class="field__linha" style="margin-top:12px">' +
          '<input class="input" id="ger-modelo-novo" type="text" placeholder="Nome do novo modelo">' +
          '<button type="button" class="btn btn--outline btn--sm" id="ger-modelo-add">Adicionar</button>' +
        '</div>';
      caixa.querySelector('#ger-modelo-add').addEventListener('click', adicionar);
      caixa.querySelector('#ger-modelo-novo').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); adicionar(); }
      });
    }

    function adicionar() {
      var input = caixa.querySelector('#ger-modelo-novo');
      var r = adicionarModelo(input.value);
      if (!r.ok) return UI.toast('warn', 'Não foi possível adicionar', r.erro);
      input.value = '';
      redesenhar();
    }

    redesenharGerenciarModal = redesenhar;
    redesenhar();

    UI.modal({
      titulo: 'Gerenciar modelos',
      subtitulo: 'Modelos de notebook disponíveis no cadastro',
      corpo: caixa,
      botoes: [{
        texto: 'Concluído', classe: 'btn--primary',
        acao: function () { redesenharGerenciarModal = null; }
      }]
    }).el.addEventListener('click', function (e) {
      var del = e.target.closest('[data-modelo-remover]');
      if (!del || del.disabled) return;
      var r = removerModelo(del.getAttribute('data-modelo-remover'));
      if (!r.ok) return UI.toast('warn', 'Não foi possível remover', r.erro);
      redesenhar();
    });
  }

  /* ---------- Modal: Adicionar notebook ------------------------------------- */

  function formAdicionarHTML() {
    var statusInicial = filtro.status || 'Em estoque';
    return '' +
      '<form id="form-nb" novalidate><div class="form-grid">' +

        '<div class="field">' +
          '<label for="nb-tombo">Tombo (Patrimônio) <span class="req">*</span></label>' +
          '<input class="input" type="text" id="nb-tombo" name="tombo" inputmode="numeric" ' +
            'placeholder="Ex.: 045218" data-obrigatorio>' +
          '<span class="field__error">Informe o tombo.</span>' +
        '</div>' +

        '<div class="field">' +
          '<label for="nb-modelo">Modelo <span class="req">*</span></label>' +
          '<div class="field__linha">' +
            '<select class="select" id="nb-modelo" name="modelo" data-obrigatorio>' +
              UI.opcoes(modelos, '', 'Selecione…') +
            '</select>' +
            (SAGETI.auth.permissao('podeGerenciarListas')
              ? '<button type="button" class="field__gerenciar" data-gerenciar-modelos ' +
                  'title="Gerenciar modelos" aria-label="Gerenciar modelos">' +
                  UI.icone('engrenagem', 15) + '</button>'
              : '') +
          '</div>' +
          '<span class="field__error">Selecione um modelo.</span>' +
        '</div>' +

        '<div class="field">' +
          '<label for="nb-predio">Local / Unidade (prédio)</label>' +
          '<select class="select" id="nb-predio" name="predio">' +
            UI.opcoes(SAGETI.listas.get('predios'), '', 'Selecione…') +
          '</select>' +
        '</div>' +

        '<div class="field">' +
          '<label for="nb-status">Status</label>' +
          '<select class="select" id="nb-status" name="status">' +
            STATUS_NOTEBOOK.map(function (s) {
              return '<option value="' + U.esc(s.valor) + '"' +
                (s.valor === statusInicial ? ' selected' : '') + '>' + U.esc(s.valor) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +

        '<div class="field' + (statusInicial === 'Disponibilizado' ? '' : ' hidden') + '" id="campo-nb-setor">' +
          '<label for="nb-setor">Setor / Unidade de destino</label>' +
          '<select class="select" id="nb-setor" name="setor">' +
            '<option value="">— nenhum —</option>' + UI.opcoes(SAGETI.listas.get('setores'), '', false) +
          '</select>' +
          '<span class="field__help">Aparece porque o status é "Disponibilizado" — é pra onde o notebook está indo.</span>' +
        '</div>' +

        '<div class="field field--full">' +
          '<label for="nb-chamado">Chamado referente</label>' +
          '<input class="input" type="text" id="nb-chamado" name="chamado" placeholder="Ex.: CH-11200 (opcional)">' +
        '</div>' +

      '</div></form>';
  }

  function salvarNovoNotebook(caixa) {
    var form = caixa.querySelector('#form-nb');
    if (!UI.validarForm(form)) {
      UI.toast('warn', 'Campos obrigatórios', 'Preencha os campos destacados.');
      return false;
    }
    var dados = UI.dadosForm(form);
    if (dados.status !== 'Disponibilizado') dados.setor = '';

    SAGETI.store.criarNotebook(dados).then(function (r) {
      if (!r.ok) { UI.toast('error', 'Não foi possível salvar', r.erro); return; }
      UI.fecharModal();
      UI.toast('success', 'Notebook adicionado', 'Tombo ' + r.notebook.tombo + ' cadastrado.');
    });
    return false;
  }

  function abrirAdicionar() {
    var ref = UI.modal({
      titulo: 'Adicionar notebook',
      subtitulo: 'Entra direto na lista — detalhes de SO e licença você preenche depois, nas Observações',
      corpo: formAdicionarHTML(),
      botoes: [
        { texto: 'Cancelar', classe: 'btn--ghost' },
        { texto: 'Adicionar', classe: 'btn--primary', icone: 'check', acao: salvarNovoNotebook }
      ]
    });

    var selStatus = ref.el.querySelector('#nb-status');
    var campoSetor = ref.el.querySelector('#campo-nb-setor');
    selStatus.addEventListener('change', function () {
      campoSetor.classList.toggle('hidden', selStatus.value !== 'Disponibilizado');
    });

    var gear = ref.el.querySelector('[data-gerenciar-modelos]');
    if (gear) gear.addEventListener('click', abrirGerenciarModelos);
  }

  /* ---------- Montagem -------------------------------------------------------- */

  function montar(container) {
    container.innerHTML = esqueleto();

    function redesenharTudo() {
      desenharDashboard(container);
      renderFiltroBar(container);
      desenharTabela(container);
    }

    ligarModelos(function () { /* mudanças na lista de modelos não afetam dashboard/tabela diretamente */ });
    redesenharTudo();

    container.addEventListener('click', function (e) {
      var alvo;

      if ((alvo = e.target.closest('[data-acao="novo"]'))) {
        if (!SAGETI.auth.permissao('podeEditar')) {
          return UI.toast('warn', 'Sem permissão', 'Seu perfil é somente de consulta.');
        }
        return abrirAdicionar();
      }

      if ((alvo = e.target.closest('[data-status-filtro]'))) {
        return aplicarFiltroStatus(container, alvo.getAttribute('data-status-filtro'));
      }
      if ((alvo = e.target.closest('[data-remover]'))) {
        filtro[alvo.getAttribute('data-remover')] = '';
        return redesenharTudo();
      }

      if ((alvo = e.target.closest('[data-local-abrir]'))) {
        if (!SAGETI.auth.permissao('podeEditar')) {
          return UI.toast('warn', 'Sem permissão', 'Seu perfil é somente de consulta.');
        }
        editandoLocalId = alvo.getAttribute('data-local-abrir');
        return desenharTabela(container);
      }
      if ((alvo = e.target.closest('[data-local-cancelar]'))) {
        editandoLocalId = null;
        return desenharTabela(container);
      }
      if ((alvo = e.target.closest('[data-local-salvar]'))) {
        var idL = alvo.getAttribute('data-local-salvar');
        var linha = container.querySelector('[data-local-edit="' + idL + '"]');
        var predio = linha.querySelector('[data-local-select]').value;
        var setor = linha.querySelector('[data-setor-select]').value;
        SAGETI.store.atualizarNotebook(idL, { predio: predio, setor: setor }).then(function (r) {
          if (!r.ok) { UI.toast('error', 'Não foi possível salvar', r.erro); return; }
          editandoLocalId = null;
          desenharTabela(container);
        });
        return;
      }

      if ((alvo = e.target.closest('[data-obs-abrir]'))) {
        var nb = SAGETI.store.acharNotebookPorId(alvo.getAttribute('data-obs-abrir'));
        if (nb) abrirObservacoes(nb);
        return;
      }
    });

    // Enter salva / Escape cancela a edição de Local; sem edição aberta,
    // Enter/Espaço num card de status ativa o filtro (cards são focáveis).
    container.addEventListener('keydown', function (e) {
      var editando = e.target.closest('[data-local-edit]');
      if (editando) {
        // Impede que o Escape também chegue ao listener global da página
        // (aoTeclarEscapeGlobal) e limpe o filtro de status na mesma tecla.
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          var idL = editando.getAttribute('data-local-edit');
          var btn = container.querySelector('[data-local-salvar="' + idL + '"]');
          if (btn) btn.click();
        } else if (e.key === 'Escape') {
          editandoLocalId = null;
          desenharTabela(container);
        }
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        var kpi = e.target.closest('[data-status-filtro]');
        if (kpi) { e.preventDefault(); kpi.click(); }
      }
    });

    // Escape limpa o filtro de status só quando não há edição de Local nem
    // modal aberto (o UI.modal já tem seu próprio Escape-fecha-modal).
    function aoTeclarEscapeGlobal(e) {
      if (e.key !== 'Escape') return;
      if (editandoLocalId) return;
      if (document.querySelector('.modal-backdrop')) return;
      if (!filtro.status) return;
      filtro.status = '';
      redesenharTudo();
    }
    document.addEventListener('keydown', aoTeclarEscapeGlobal);

    var cancelar = SAGETI.store.assinar(function (ev) {
      if (ev && ev.tipo === 'listas') return desenharTabela(container); // prédios/setores podem ter mudado
      redesenharTudo();
    });

    return {
      destruir: function () {
        cancelar();
        desligarModelos();
        document.removeEventListener('keydown', aoTeclarEscapeGlobal);
      }
    };
  }

  SAGETI.pages = SAGETI.pages || {};
  SAGETI.pages.notebooks = {
    titulo: 'Notebooks',
    subtitulo: 'Inventário de notebooks — status e localização',
    montar: montar
  };

})(window.SAGETI);
