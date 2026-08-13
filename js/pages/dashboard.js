/* ==========================================================================
   SAGE-TI — Dashboard com drill-down (cross-filtering)
   --------------------------------------------------------------------------
   Um único objeto `filtro` governa a tela inteira. Toda mudança — vinda do
   select de modelo, de um clique numa fatia do donut ou numa barra — recalcula
   os KPIs, os quatro gráficos e as tabelas-gêmeas a partir do MESMO recorte.
   Nenhum gráfico filtra a si próprio: cada um continua mostrando a distribuição
   completa da sua dimensão, com a seleção em destaque e o resto recuado.
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  var UI = SAGETI.ui;
  var U = SAGETI.util;
  var L = SAGETI.listas;

  var titulo = 'Dashboard';
  var subtitulo = 'Visão geral do estoque em tempo real';

  /* ---------- Estado do drill-down ---------------------------------------- */

  var filtro = { modelo: '', tom: '', status: '', equipamento: '', predio: '', grupo: '' };
  // Rótulo exibido -> tom técnico do status. Mantém a UI legível e a regra fiel.
  var TONS_DONUT = [
    { rotulo: 'Disponível',   tom: 'good' },
    { rotulo: 'Em triagem',   tom: 'info' },
    { rotulo: 'Manutenção',   tom: 'warning' },
    { rotulo: 'Leilão',       tom: 'serious' },
    { rotulo: 'Defeito',      tom: 'critical' },
    { rotulo: 'Sem situação', tom: 'neutral' }
  ];

  function tomDoRotulo(rotulo) {
    var m = TONS_DONUT.find(function (t) { return t.rotulo === rotulo; });
    return m ? m.tom : '';
  }
  function rotuloDoTom(tom) {
    var m = TONS_DONUT.find(function (t) { return t.tom === tom; });
    return m ? m.rotulo : '';
  }

  // "Composição do estoque" em 4 grupos de destino — Disponível absorve tudo
  // que já soma ou volta ao estoque (Estoque, Aquisição, Devolução íntegra,
  // Empréstimo devolvido); Leilão absorve tudo que está com defeito (Leilão,
  // Devolução Eq. Obsoleto, Defeito, Devolução por Defeito), já que os dois
  // primeiros já indicam "vai a leilão" e os dois de defeito seguem pra lá
  // pela mesma regra de negócio do Fluxo.
  var FATIAS_DONUT = [
    { rotulo: 'Disponível', tom: 'good',
      statuses: ['Estoque', 'Entrada de Estoque', 'Devolução', 'Devolução Empréstimo'] },
    { rotulo: 'Manutenção', tom: 'warning', statuses: ['Manutenção'] },
    { rotulo: 'Leilão', tom: 'serious',
      statuses: ['Leilão', 'Devolução Eq. Obsoleto', 'Defeito', 'Devolucao Defeito'] },
    { rotulo: 'Doação', statusCor: 'Doação', statuses: ['Doação'] }
  ];
  // Todo status coberto por algum grupo acima — o que sobrar vira "Outros".
  var STATUS_COBERTOS_DONUT = FATIAS_DONUT.reduce(function (acc, f) {
    return acc.concat(f.statuses);
  }, []);

  function statusesDoGrupoDonut(rotulo) {
    var g = FATIAS_DONUT.find(function (f) { return f.rotulo === rotulo; });
    return g ? g.statuses : [];
  }

  function temFiltro() {
    return !!(filtro.modelo || filtro.tom || filtro.status || filtro.equipamento || filtro.predio || filtro.grupo);
  }

  function limparFiltros() {
    filtro = { modelo: '', tom: '', status: '', equipamento: '', predio: '', grupo: '' };
  }

  /* ---------- Recorte ------------------------------------------------------
     `exceto` deixa de aplicar uma dimensão, para cada gráfico mostrar a
     distribuição completa da sua própria dimensão em vez de uma barra só.
     ---------------------------------------------------------------------- */

  function recorte(exceto) {
    return SAGETI.store.estoqueLaboratorio().filter(function (e) {
      if (filtro.modelo && exceto !== 'modelo' && e.modelo !== filtro.modelo) return false;
      if (filtro.equipamento && exceto !== 'equipamento' && e.equipamento !== filtro.equipamento) return false;
      if (filtro.grupo && exceto !== 'grupo') {
        var g = FATIAS_DONUT.find(function (f) { return f.rotulo === filtro.grupo; });
        if (!g || g.statuses.indexOf(e.status) === -1) return false;
      }
      if (filtro.predio && exceto !== 'predio' && e.predioOrigem !== filtro.predio) return false;
      if (filtro.tom && exceto !== 'tom') {
        if ((L.statusMeta(e.status).tom || 'neutral') !== filtro.tom) return false;
      }
      if (filtro.status && exceto !== 'status' && e.status !== filtro.status) return false;
      return true;
    });
  }

  function agrupar(lista, campo) {
    var mapa = {};
    lista.forEach(function (e) {
      var k = e[campo] || 'Não informado';
      mapa[k] = (mapa[k] || 0) + 1;
    });
    return mapa;
  }

  /** Itens cujo status está em `statuses` (aceita um status só ou uma lista deles). */
  function porStatusLista(lista, statuses) {
    var alvo = Array.isArray(statuses) ? statuses : [statuses];
    return lista.filter(function (e) { return alvo.indexOf(e.status) > -1; });
  }

  function porTomLista(lista, tom) {
    return lista.filter(function (e) { return (L.statusMeta(e.status).tom || 'neutral') === tom; });
  }

  /* ---------- Esqueleto ----------------------------------------------------- */

  function esqueleto() {
    return '' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-head__title">Visão geral</h1>' +
          '<p class="page-head__sub" id="dash-atualizado">Atualizado agora</p>' +
        '</div>' +
        '<div class="page-head__spacer"></div>' +
        '<div class="btn-group">' +
          '<button class="btn btn--outline" data-exportar="excel">' +
            UI.icone('excel', 16) + '<span>Exportar Geral · Excel</span></button>' +
          '<button class="btn btn--outline" data-exportar="pdf">' +
            UI.icone('pdf', 16) + '<span>Exportar Geral · PDF</span></button>' +
        '</div>' +
      '</div>' +

      '<div class="quick-actions">' +
        atalho('entrada', '', 'entrada', 'Nova Entrada', 'Registrar chegada ao laboratório') +
        atalho('saida', 'quick-card__icon--out', 'saida', 'Nova Saída', 'Enviar equipamento a uma unidade') +
        atalho('relatorios', 'quick-card__icon--doc', 'relatorio', 'Relatórios', 'Histórico completo e filtros') +
      '</div>' +

      // Uma linha de filtro acima de tudo o que ela escopa.
      '<div class="filter-bar" style="align-items:center">' +
        '<div class="field field--grow">' +
          '<label for="dash-modelo">Filtrar por modelo</label>' +
          '<select class="select" id="dash-modelo">' +
            UI.opcoes(L.get('modelos'), '', 'Todos os modelos') + '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="dash-equip">Equipamento</label>' +
          '<select class="select" id="dash-equip">' +
            UI.opcoes(L.get('equipamentos'), '', 'Todos') + '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="dash-tom">Situação</label>' +
          '<select class="select" id="dash-tom">' +
            UI.opcoes(TONS_DONUT.map(function (t) {
              return { valor: t.tom, rotulo: t.rotulo };
            }), '', 'Todas') + '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="dash-status">Status</label>' +
          '<select class="select" id="dash-status">' +
            UI.opcoes(L.statusTodos(), '', 'Todos os status') + '</select>' +
        '</div>' +
        '<div style="flex:1 1 100%;min-width:0" id="dash-chips"></div>' +
      '</div>' +

      '<div class="kpi-row" id="dash-kpis"></div>' +

      '<div class="chart-grid">' +
        cartaoGrafico('Estoque por tipo de equipamento',
          'Clique em uma barra para filtrar a dashboard por categoria',
          'grafico-tipo', 'tall', 'tipo') +
        cartaoGrafico('Composição do estoque',
          'Clique em uma fatia para filtrar por situação',
          'grafico-status', 'tall', 'status') +
      '</div>' +

      '<div class="chart-grid">' +
        cartaoGrafico('Entradas e saídas — últimos 30 dias',
          'Volume diário de movimentações registradas',
          'grafico-mov', '', 'mov') +
        cartaoGrafico('Prédios de origem',
          'Clique em uma barra para filtrar por prédio',
          'grafico-predio', '', 'predio') +
      '</div>';
  }

  function atalho(rota, classeIcone, nomeIcone, tit, sub) {
    return '<button class="quick-card" data-ir="' + rota + '">' +
      '<span class="quick-card__icon ' + classeIcone + '">' + UI.icone(nomeIcone, 19) + '</span>' +
      '<span class="quick-card__text">' +
        '<span class="quick-card__title">' + U.esc(tit) + '</span>' +
        '<span class="quick-card__sub">' + U.esc(sub) + '</span>' +
      '</span></button>';
  }

  /** Cartão de gráfico com alternador Gráfico/Tabela (a11y: valor sem hover). */
  function cartaoGrafico(tit, sub, id, altura, chave) {
    return '' +
      '<figure class="card" style="margin:0">' +
        '<div class="card__head">' +
          '<div style="min-width:0">' +
            '<figcaption class="card__title">' + U.esc(tit) + '</figcaption>' +
            '<div class="card__sub">' + U.esc(sub) + '</div>' +
          '</div>' +
          '<div class="card__spacer"></div>' +
          '<div class="seg" role="group" aria-label="Modo de exibição">' +
            '<button type="button" class="is-active" data-vista="grafico" data-alvo="' + chave + '">Gráfico</button>' +
            '<button type="button" data-vista="tabela" data-alvo="' + chave + '">Tabela</button>' +
          '</div>' +
        '</div>' +
        '<div class="chart-legend" id="legenda-' + chave + '"></div>' +
        '<div class="card__body">' +
          '<div class="chart-box' + (altura === 'tall' ? ' chart-box--tall' : '') + '" ' +
            'data-vista-alvo="grafico" data-chave="' + chave + '" ' +
            'data-canvas="' + id + '" data-rotulo="' + U.esc(tit) + '">' +
            '<canvas id="' + id + '" role="img" aria-label="' + U.esc(tit) + '"></canvas>' +
          '</div>' +
          '<div class="table-wrap hidden" data-vista-alvo="tabela" data-chave="' + chave + '"></div>' +
        '</div>' +
      '</figure>';
  }

  /* ---------- Chips de filtro ativo ----------------------------------------- */

  function chipsHTML() {
    if (!temFiltro()) {
      return '<div style="font-size:12px;color:var(--text-muted);padding-top:2px">' +
        'Nenhum filtro ativo — clique nas barras ou nas fatias dos gráficos para investigar.' +
        '</div>';
    }

    var partes = [];
    function chip(dim, rotulo, valor) {
      partes.push('<button type="button" class="chip chip--tom-info" data-remover="' + dim + '" ' +
        'title="Remover este filtro" style="cursor:pointer;border-style:solid">' +
        '<span class="chip__dot"></span>' + U.esc(rotulo) + ': <strong>' + U.esc(valor) +
        '</strong> <span aria-hidden="true" style="opacity:.65;margin-left:2px">&times;</span>' +
        '<span class="sr-only">Remover filtro</span></button>');
    }

    if (filtro.modelo) chip('modelo', 'Modelo', filtro.modelo);
    if (filtro.equipamento) chip('equipamento', 'Equipamento', filtro.equipamento);
    if (filtro.tom) chip('tom', 'Situação', rotuloDoTom(filtro.tom));
    if (filtro.status) chip('status', 'Status', filtro.status);
    if (filtro.predio) chip('predio', 'Prédio', filtro.predio);
    if (filtro.grupo) chip('grupo', 'Composição', filtro.grupo);

    return '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding-top:2px">' +
      '<span style="font-size:12px;color:var(--text-secondary)">Filtros ativos:</span>' +
      partes.join('') +
      '<button type="button" class="btn btn--ghost btn--sm" data-limpar-dash>' +
        UI.icone('limpar', 14) + '<span>Limpar tudo</span></button>' +
      '</div>';
  }

  /* ---------- KPIs -----------------------------------------------------------
     Clicáveis: cada card abre um modal com Equipamento/Modelo/Tombo — mesma
     interação dos Painéis de Fluxo. Os status granulares (Devolução,
     Doação, Substituição...) ficam só nos Painéis de Fluxo; aqui a
     granularidade equivalente entra pelo donut "Composição do estoque" (ver
     desenhar()), não duplicando cards.
     ---------------------------------------------------------------------- */

  var detalhesKpi = {}; // chave -> { titulo, lista } — repovoado a cada kpisHTML()

  /** Aceita um status real (resolve a cor por SAGETI.statusCores) ou um valor CSS pronto (#hex / var(--x)). */
  function corAccentKpi(chave) {
    if (!chave) return '';
    if (chave.charAt(0) === '#' || chave.indexOf('var(') === 0) return chave;
    return (SAGETI.statusCores && SAGETI.statusCores.hex(chave)) || '';
  }

  function kpisHTML(lista) {
    detalhesKpi = {};

    function tile(chave, corChave, rotulo, sublista, rodape, hero) {
      detalhesKpi[chave] = { titulo: rotulo, lista: sublista };
      var accent = corAccentKpi(corChave);
      return '<div class="stat' + (hero ? ' stat--hero' : '') + '" data-kpi="' + chave + '" ' +
        'role="button" tabindex="0" style="cursor:pointer' + (accent ? ';--stat-accent:' + accent : '') + '">' +
        '<div class="stat__label"><span class="dot"></span>' + U.esc(rotulo) + '</div>' +
        '<div class="stat__value">' + U.numero(sublista.length) + '</div>' +
        '<div class="stat__foot">' + U.esc(rodape) + '</div>' +
        '</div>';
    }

    var totalGeral = SAGETI.store.estoqueLaboratorio().length;
    var rodapeHero = temFiltro()
      ? 'de ' + U.numero(totalGeral) + ' no laboratório · recorte filtrado'
      : U.numero(SAGETI.store.resumo().totalCadastrado) + ' cadastrados · ' +
        U.numero(SAGETI.store.resumo().totalFora) + ' fora do laboratório';

    return '' +
      tile('hero', 'var(--brand)', temFiltro() ? 'Equipamentos no recorte' : 'Equipamentos no laboratório',
        lista, rodapeHero, true) +
      tile('good', 'var(--status-good)', 'Disponíveis em estoque',
        porStatusLista(lista, statusesDoGrupoDonut('Disponível')),
        'Estoque, aquisição e devoluções (com ou sem empréstimo) já íntegras') +
      tile('manutencao', 'var(--status-warning)', 'Em manutenção', porTomLista(lista, 'warning'),
        'Em reparo no laboratório') +
      tile('defeito', 'var(--status-critical)', 'Com defeito', porTomLista(lista, 'critical'),
        'Aguardando destinação') +
      tile('leilao', 'var(--status-serious)', 'Para leilão', porTomLista(lista, 'serious'),
        'Baixados do patrimônio ativo');
  }

  /* ---------- Render -------------------------------------------------------- */

  function desenhar(container) {
    var p = SAGETI.charts.paleta();
    var todasCategorias = L.get('equipamentos');

    // Recorte principal (todos os filtros) e recortes por dimensão.
    var base = recorte();
    var listaTipo = recorte('equipamento');   // barras de tipo: sem o filtro de tipo
    var listaStatus = recorte('grupo');       // donut: sem o filtro de composição
    var listaPredio = recorte('predio');      // prédios: sem o filtro de prédio

    /* --- cabeçalho, chips e KPIs --- */
    container.querySelector('#dash-atualizado').textContent =
      'Atualizado às ' + new Date().toLocaleTimeString('pt-BR',
        { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    container.querySelector('#dash-chips').innerHTML = chipsHTML();
    container.querySelector('#dash-kpis').innerHTML = kpisHTML(base);

    /* --- 1. Estoque por tipo (clicável) --- */
    var dadosTipo = agrupar(listaTipo, 'equipamento');
    SAGETI.charts.barrasPorTipo('grafico-tipo', dadosTipo, {
      todasCategorias: todasCategorias,   // mostra as 14, inclusive as zeradas
      selecionado: filtro.equipamento,
      aoClicar: function (categoria) {
        filtro.equipamento = (categoria && categoria !== filtro.equipamento) ? categoria : '';
        sincronizarCampos(container);
        desenhar(container);
      }
    });
    container.querySelector('#legenda-tipo').innerHTML = filtro.tom
      ? '<span class="chart-legend__item" style="color:var(--text-secondary)">' +
        'Mostrando apenas equipamentos com situação <strong style="color:var(--text-primary)">' +
        U.esc(rotuloDoTom(filtro.tom)) + '</strong></span>'
      : '';
    preencherTabela(container, 'tipo', ['Equipamento', 'Quantidade'],
      todasCategorias
        .map(function (c) { return { rotulo: c, valor: dadosTipo[c] || 0 }; })
        .sort(function (a, b) {
          return b.valor - a.valor || a.rotulo.localeCompare(b.rotulo, 'pt-BR');
        })
        .map(function (i) { return [{ texto: i.rotulo, cor: p.series[0] }, U.numero(i.valor)]; }));

    /* --- 2. Composição por situação (donut clicável) — 4 grupos de destino --- */
    var fatias = FATIAS_DONUT.map(function (f) {
      return {
        rotulo: f.rotulo,
        cor: f.tom ? p.status[f.tom] : SAGETI.statusCores.hex(f.statusCor),
        valor: porStatusLista(listaStatus, f.statuses).length
      };
    });
    // Qualquer status fora do mapa acima (ex.: criado pelo usuário) some aqui,
    // não do total — mesma garantia que o teste automatizado já cobra hoje.
    var outros = listaStatus.filter(function (e) { return STATUS_COBERTOS_DONUT.indexOf(e.status) === -1; });
    if (outros.length) fatias.push({ rotulo: 'Outros', cor: p.status.neutral, valor: outros.length });
    fatias = fatias.filter(function (f) { return f.valor > 0; });

    SAGETI.charts.donutStatus('grafico-status', fatias, {
      selecionado: filtro.grupo,
      rotuloCentro: temFiltro() ? 'no recorte' : 'no laboratório',
      aoClicar: function (rotulo) {
        if (rotulo === 'Outros') return; // fatia de segurança, sem grupo único para filtrar
        filtro.grupo = (rotulo && rotulo !== filtro.grupo) ? rotulo : '';
        sincronizarCampos(container);
        desenhar(container);
      }
    });
    container.querySelector('#legenda-status').innerHTML = SAGETI.charts.legendaHTML(fatias);

    // A tabela-gêmea detalha status por status — nada fica só no agrupamento.
    var porStatus = agrupar(listaStatus, 'status');
    preencherTabela(container, 'status', ['Status', 'Quantidade'],
      Object.keys(porStatus)
        .sort(function (a, b) { return porStatus[b] - porStatus[a]; })
        .map(function (s) {
          var meta = L.statusMeta(s);
          var cor = meta.tom === 'info' ? p.series[0] : (p.status[meta.tom] || p.status.neutral);
          return [{ texto: s, cor: cor }, U.numero(porStatus[s])];
        }));

    /* --- 3. Movimentações (segue o filtro de modelo/equipamento) --- */
    var serie = serieFiltrada(30);
    SAGETI.charts.linhasMovimentacao('grafico-mov', serie);
    container.querySelector('#legenda-mov').innerHTML = SAGETI.charts.legendaHTML([
      { rotulo: 'Entradas', cor: p.series[0],
        valor: serie.entradas.reduce(function (a, b) { return a + b; }, 0) },
      { rotulo: 'Saídas', cor: p.series[1],
        valor: serie.saidas.reduce(function (a, b) { return a + b; }, 0) }
    ]);
    preencherTabela(container, 'mov', ['Data', 'Entradas', 'Saídas'],
      serie.labels.map(function (iso, i) {
        return [U.dataBR(iso), U.numero(serie.entradas[i]), U.numero(serie.saidas[i])];
      }).filter(function (l) { return l[1] !== '0' || l[2] !== '0'; }).reverse());

    /* --- 4. Prédios (clicável) --- */
    var dadosPredio = agrupar(listaPredio, 'predioOrigem');
    SAGETI.charts.barrasPorPredio('grafico-predio', dadosPredio, 8, {
      selecionado: filtro.predio,
      aoClicar: function (predio) {
        filtro.predio = (predio && predio !== filtro.predio) ? predio : '';
        desenhar(container);
      }
    });
    container.querySelector('#legenda-predio').innerHTML = '';
    preencherTabela(container, 'predio', ['Prédio de origem', 'Quantidade'],
      Object.keys(dadosPredio)
        .sort(function (a, b) { return dadosPredio[b] - dadosPredio[a]; })
        .map(function (k) { return [{ texto: k, cor: p.series[0] }, U.numero(dadosPredio[k])]; }));
  }

  /** Série de movimentações respeitando modelo e equipamento do filtro. */
  function serieFiltrada(dias) {
    if (!filtro.modelo && !filtro.equipamento) return SAGETI.store.serieMovimentacoes(dias);

    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    var labels = [], mapa = {};
    for (var i = dias - 1; i >= 0; i--) {
      var iso = new Date(hoje.getTime() - i * 86400000).toISOString().slice(0, 10);
      labels.push(iso);
      mapa[iso] = { entradas: 0, saidas: 0 };
    }
    SAGETI.store.listarMovimentacoes().forEach(function (m) {
      if (filtro.modelo && m.modelo !== filtro.modelo) return;
      if (filtro.equipamento && m.equipamento !== filtro.equipamento) return;
      var k = (m.data || '').slice(0, 10);
      if (!mapa[k]) return;
      if (m.tipo === 'ENTRADA') mapa[k].entradas++;
      else if (m.tipo === 'SAIDA') mapa[k].saidas++;
    });
    return {
      labels: labels,
      entradas: labels.map(function (l) { return mapa[l].entradas; }),
      saidas: labels.map(function (l) { return mapa[l].saidas; })
    };
  }

  function preencherTabela(container, chave, colunas, linhas) {
    var alvo = container.querySelector('[data-vista-alvo="tabela"][data-chave="' + chave + '"]');
    if (!alvo) return;
    alvo.innerHTML = linhas.length
      ? SAGETI.charts.tabelaHTML(colunas, linhas)
      : '<div style="padding:28px;text-align:center;color:var(--text-muted);font-size:13px">Sem dados.</div>';
  }

  /** Mantém os selects em sincronia com os cliques nos gráficos. */
  function sincronizarCampos(container) {
    var m = container.querySelector('#dash-modelo');
    var e = container.querySelector('#dash-equip');
    var t = container.querySelector('#dash-tom');
    var s = container.querySelector('#dash-status');
    if (m) m.value = filtro.modelo;
    if (e) e.value = filtro.equipamento;
    if (t) t.value = filtro.tom;
    if (s) s.value = filtro.status;
  }

  /* ---------- Montagem ------------------------------------------------------ */

  function montar(container, navegar) {
    container.innerHTML = esqueleto();
    sincronizarCampos(container);

    var CAMPOS = [
      ['#dash-modelo', 'modelo'], ['#dash-equip', 'equipamento'],
      ['#dash-tom', 'tom'], ['#dash-status', 'status']
    ];

    CAMPOS.forEach(function (par) {
      var el = container.querySelector(par[0]);
      if (!el) return;
      el.addEventListener('change', function () {
        filtro[par[1]] = this.value;
        desenhar(container);
      });
    });

    container.addEventListener('click', function (e) {
      var alvo;

      if ((alvo = e.target.closest('[data-kpi]'))) {
        var info = detalhesKpi[alvo.getAttribute('data-kpi')];
        if (info) UI.modalEquipamentos(info.titulo, info.lista);
        return;
      }

      if ((alvo = e.target.closest('[data-remover]'))) {
        filtro[alvo.getAttribute('data-remover')] = '';
        sincronizarCampos(container);
        return desenhar(container);
      }

      if (e.target.closest('[data-limpar-dash]')) {
        limparFiltros();
        sincronizarCampos(container);
        return desenhar(container);
      }

      if ((alvo = e.target.closest('[data-ir]'))) return navegar(alvo.getAttribute('data-ir'));

      if ((alvo = e.target.closest('[data-exportar]'))) {
        if (alvo.getAttribute('data-exportar') === 'excel') SAGETI.exportar.exportarGeralExcel();
        else SAGETI.exportar.exportarGeralPDF();
        return;
      }

      if ((alvo = e.target.closest('[data-vista]'))) {
        var chave = alvo.getAttribute('data-alvo');
        var modo = alvo.getAttribute('data-vista');
        alvo.parentElement.querySelectorAll('button').forEach(function (b) {
          b.classList.remove('is-active');
        });
        alvo.classList.add('is-active');
        container.querySelectorAll('[data-vista-alvo][data-chave="' + chave + '"]').forEach(function (painel) {
          painel.classList.toggle('hidden', painel.getAttribute('data-vista-alvo') !== modo);
        });
      }
    });

    // Teclado: os cards de KPI são focáveis (role="button"); Enter/Espaço ativa.
    container.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var alvo = e.target.closest('[data-kpi]');
      if (!alvo) return;
      e.preventDefault();
      alvo.click();
    });

    // Esc limpa o drill-down — saída rápida de qualquer recorte.
    function aoTeclar(ev) {
      if (ev.key !== 'Escape' || !temFiltro()) return;
      if (document.querySelector('.modal-backdrop')) return;   // o modal tem prioridade
      limparFiltros();
      sincronizarCampos(container);
      desenhar(container);
    }
    document.addEventListener('keydown', aoTeclar);

    desenhar(container);

    /** Repinta os selects quando as listas mudam. */
    function repintarListas() {
      UI.repintarSelect(container.querySelector('#dash-modelo'), L.get('modelos'), 'Todos os modelos');
      UI.repintarSelect(container.querySelector('#dash-equip'), L.get('equipamentos'), 'Todos');
      UI.repintarSelect(container.querySelector('#dash-status'), L.statusTodos(), 'Todos os status');
      // Um modelo excluído deixa de existir: o filtro correspondente cai.
      if (filtro.modelo && L.get('modelos').indexOf(filtro.modelo) === -1) filtro.modelo = '';
      if (filtro.equipamento && L.get('equipamentos').indexOf(filtro.equipamento) === -1) filtro.equipamento = '';
      if (filtro.status && L.statusTodos().indexOf(filtro.status) === -1) filtro.status = '';
      sincronizarCampos(container);
      desenhar(container);
    }

    // Tempo real: qualquer mutação repinta a dashboard mantendo o recorte.
    var cancelar = SAGETI.store.assinar(function (ev) {
      if (ev && ev.tipo === 'listas') return repintarListas();
      desenhar(container);
    });

    return {
      destruir: function () {
        cancelar();
        document.removeEventListener('keydown', aoTeclar);
        SAGETI.charts.destruirTodos();
      }
    };
  }

  SAGETI.pages = SAGETI.pages || {};
  SAGETI.pages.dashboard = {
    titulo: titulo,
    subtitulo: subtitulo,
    montar: montar,
    // expostos para os testes
    _filtro: function () { return filtro; },
    _recorte: recorte,
    _limpar: limparFiltros
  };

})(window.SAGETI);
