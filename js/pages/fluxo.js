/* ==========================================================================
   SAGE-TI — Painéis de Fluxo: Controle de Saída e Fluxo de Entrada/Estoque
   --------------------------------------------------------------------------
   Duas telas alternadas por abas (.seg). Cada indicador é uma contagem
   direta sobre o estado atual do laboratório ou sobre o histórico de
   movimentações — os mesmos dados que store.js já mantém em memória e
   atualiza em tempo real via onSnapshot.

   Modo dashboard: todo card e toda barra do gráfico são clicáveis — ao
   clicar, abre um modal com Equipamento/Modelo/Tombo de cada item que
   compõe aquele número (ou um aviso quando não há nenhum).

   Tela "Saída" conta MOVIMENTAÇÕES do tipo SAIDA, agrupadas pelo status
   escolhido no formulário de saída (m.statusResultante) — não é o estoque
   atual, é o histórico de quem já saiu.

   Tela "Entrada/Estoque" conta o ESTOQUE ATUAL no laboratório
   (estoqueLaboratorio()), agrupado por status — exceto "Empréstimo em
   Aberto", que por regra de negócio sai do laboratório ao ser registrado
   (noLaboratorio vira false na saída, independente do noLab de fábrica do
   status), então precisa ler de todos os equipamentos, não só do estoque.
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  var UI = SAGETI.ui;
  var U = SAGETI.util;
  var L = SAGETI.listas;

  var titulo = 'Painéis de Fluxo';
  var subtitulo = 'Saída, entrada e estoque real por tipo de movimentação';

  var telaAtual = 'saida';
  var detalhes = {}; // chave -> { titulo, lista }  — repovoado a cada desenhar()

  // Os 4 status de saída que viram card na tela — o gráfico "Tipos de Saída"
  // fica restrito a eles (não aos 8 que L.statusDe('saida') devolveria).
  var STATUS_SAIDA_MENCIONADOS = ['Substituição', 'Subs. Equip. Defeito', 'Solicitação', 'Empréstimo'];

  /* ---------- Listas-base (contagem = lista.length) -------------------------- */

  function movimentacoesSaida() {
    return SAGETI.store.listarMovimentacoes().filter(function (m) { return m.tipo === 'SAIDA'; });
  }

  function listaSaidaPorStatus(statusValor) {
    return movimentacoesSaida().filter(function (m) { return m.statusResultante === statusValor; });
  }

  function listaSolicitacoesPendentes() {
    return movimentacoesSaida().filter(function (m) {
      return m.statusResultante === 'Solicitação' && /pendente/i.test(m.ttr || '');
    });
  }

  function saidaPorStatusDados() {
    var mapa = {};
    movimentacoesSaida().forEach(function (m) {
      var k = m.statusResultante || 'Não informado';
      mapa[k] = (mapa[k] || 0) + 1;
    });
    return mapa;
  }

  function listaStatusNoLab(statusValor) {
    return SAGETI.store.estoqueLaboratorio().filter(function (e) { return e.status === statusValor; });
  }

  function listaLeilao() {
    return SAGETI.store.estoqueLaboratorio().filter(function (e) {
      return e.status === 'Leilão' || e.status === 'Devolução Eq. Obsoleto';
    });
  }

  function listaDisponiveis() {
    return SAGETI.store.estoqueLaboratorio().filter(function (e) {
      return (L.statusMeta(e.status).tom || 'neutral') === 'good';
    });
  }

  function listaEmprestimoAberto() {
    return SAGETI.store.listarEquipamentos().filter(function (e) { return e.status === 'Empréstimo'; });
  }

  /* ---------- Modal de detalhes ------------------------------------------------ */

  function abrirDetalhes(chave) {
    var info = detalhes[chave];
    if (!info) return;
    UI.modalEquipamentos(info.titulo, info.lista);
  }

  /* ---------- Construtores de HTML ------------------------------------------ */

  /** Aceita um status real (resolve a cor por SAGETI.statusCores) ou um valor CSS pronto (#hex / var(--x)). */
  function corAccent(chave) {
    if (!chave) return '';
    if (chave.charAt(0) === '#' || chave.indexOf('var(') === 0) return chave;
    return (SAGETI.statusCores && SAGETI.statusCores.hex(chave)) || '';
  }

  /** Registra a lista sob `chave` (para o clique abrir o modal) e desenha o card. */
  function tile(chave, corChave, rotulo, lista, rodape, hero) {
    detalhes[chave] = { titulo: rotulo, lista: lista };
    var accent = corAccent(corChave);
    var estilo = 'cursor:pointer' + (accent ? ';--stat-accent:' + accent : '');
    return '<div class="stat' + (hero ? ' stat--hero' : '') + '" ' +
      'data-chave="' + chave + '" role="button" tabindex="0" style="' + estilo + '">' +
      '<div class="stat__label"><span class="dot"></span>' + U.esc(rotulo) + '</div>' +
      '<div class="stat__value">' + U.numero(lista.length) + '</div>' +
      '<div class="stat__foot">' + U.esc(rodape) + '</div>' +
      '</div>';
  }

  function kpisSaidaHTML() {
    return '' +
      tile('saida-total', 'var(--brand)', 'Saída Total', movimentacoesSaida(),
        'Fora do estoque — não é mais controle do laboratório', true) +
      tile('saida-substituicao', 'Substituição', 'Substituição', listaSaidaPorStatus('Substituição'),
        'Trocado por outro equipamento, sem defeito') +
      tile('saida-substituicao-defeito', 'Subs. Equip. Defeito', 'Substituição por Defeito',
        listaSaidaPorStatus('Subs. Equip. Defeito'), 'Troca motivada por defeito no equipamento') +
      tile('saida-solicitacao', 'Solicitação', 'Solicitação', listaSaidaPorStatus('Solicitação'),
        'Nova solicitação, ex.: estação de trabalho') +
      tile('saida-solicitacao-pendente', 'Solicitação', 'Solicitação Pendente', listaSolicitacoesPendentes(),
        'Aguardando atendimento (TTR pendente)') +
      tile('saida-emprestimo', 'Empréstimo', 'Empréstimo', listaSaidaPorStatus('Empréstimo'),
        'Temporária — retorna como Devolução');
  }

  function kpisEntradaHTML() {
    return '' +
      tile('entrada-disponiveis', 'var(--status-good)', 'Disponíveis Total', listaDisponiveis(),
        'Em estoque, pronto para disponibilizar', true) +
      tile('entrada-devolucao', 'Devolução', 'Devolução', listaStatusNoLab('Devolução'),
        'Íntegra — soma ao Disponível') +
      tile('entrada-devolucao-defeito', 'Devolucao Defeito', 'Devolução por Defeito',
        listaStatusNoLab('Devolucao Defeito'), 'Retorno chegou com defeito — segue para Leilão') +
      tile('entrada-emprestimo-devolvido', 'Devolução Empréstimo', 'Empréstimo Devolvido',
        listaStatusNoLab('Devolução Empréstimo'), 'Empréstimo encerrado — voltou como devolução') +
      tile('entrada-manutencao', 'Manutenção', 'Manutenção', listaStatusNoLab('Manutenção'),
        'Indisponível no reparo · desistência volta ao Disponível') +
      tile('entrada-leilao', 'Leilão', 'Leilão', listaLeilao(),
        'Defeito, ocioso, depreciado ou inservível') +
      tile('entrada-defeito', 'Defeito', 'Defeito', listaStatusNoLab('Defeito'),
        'Diagnosticado com defeito, aguardando destinação') +
      tile('entrada-doacao', 'Doação', 'Doação', listaStatusNoLab('Doação'),
        'Não apto para uso pelos servidores do TJ') +
      tile('entrada-aquisicao', 'Entrada de Estoque', 'Aquisição', listaStatusNoLab('Entrada de Estoque'),
        'Entrada de equipamentos novos (já contado em Disponível)') +
      tile('entrada-emprestimo-aberto', 'Empréstimo', 'Empréstimo em Aberto', listaEmprestimoAberto(),
        'Emprestado e ainda não devolvido');
  }

  function cartaoGrafico(tit, sub, canvasId) {
    return '' +
      '<figure class="card" style="margin:0 0 16px">' +
        '<div class="card__head">' +
          '<div style="min-width:0">' +
            '<figcaption class="card__title">' + U.esc(tit) + '</figcaption>' +
            '<div class="card__sub">' + U.esc(sub) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="card__body">' +
          '<div class="chart-box" data-canvas="' + canvasId + '" data-rotulo="' + U.esc(tit) + '">' +
            '<canvas id="' + canvasId + '" role="img" aria-label="' + U.esc(tit) + '"></canvas>' +
          '</div>' +
        '</div>' +
      '</figure>';
  }

  function chipTom(tom, rotulo) {
    return '<span class="chip chip--tom-' + tom + '"><span class="chip__dot"></span>' + U.esc(rotulo) + '</span>';
  }

  /** Card estático — não depende de dados ao vivo, montado uma vez no esqueleto. */
  function regrasHTML() {
    var chipDisponivel = chipTom('good', 'Disponível');
    var chipDefeitoOcioso = chipTom('critical', 'Defeito · Ocioso · Depreciado · Inservível');
    var linhas = [
      [UI.chipStatus('Devolução'), 'sem defeito', chipDisponivel],
      [UI.chipStatus('Devolução'), 'com defeito', UI.chipStatus('Leilão')],
      [UI.chipStatus('Manutenção'), 'desistência do usuário', chipDisponivel],
      [chipDefeitoOcioso, 'entrada direta e unificada', UI.chipStatus('Leilão')]
    ];

    var linhasHTML = linhas.map(function (l, i) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0' +
        (i ? ';border-top:1px solid var(--border)' : '') + '">' +
        l[0] +
        '<div style="flex:1;text-align:center;font-size:11px;color:var(--text-muted);line-height:1.4">' +
          '<div style="font-size:14px">&rarr;</div>' + U.esc(l[1]) +
        '</div>' +
        l[2] +
        '</div>';
    }).join('');

    return '' +
      '<div class="card">' +
        '<div class="card__head"><div class="card__title">Regras de Fluxo</div></div>' +
        '<div class="card__body" style="padding-top:4px">' + linhasHTML + '</div>' +
      '</div>';
  }

  /* ---------- Esqueleto ------------------------------------------------------ */

  function esqueleto() {
    return '' +
      '<div class="seg" role="tablist" aria-label="Selecionar painel" style="margin-bottom:16px">' +
        '<button type="button" class="is-active" data-tela="saida" role="tab" aria-selected="true">' +
          'Controle de Saída</button>' +
        '<button type="button" data-tela="entrada" role="tab" aria-selected="false">' +
          'Fluxo de Entrada &amp; Estoque Real</button>' +
      '</div>' +

      '<div data-tela-alvo="saida">' +
        '<div class="kpi-row" id="fluxo-kpis-saida"></div>' +
        cartaoGrafico('Tipos de Saída',
          'Motivo de saída de cada equipamento que deixou o laboratório — clique numa barra para ver os itens',
          'grafico-saida-status') +
      '</div>' +

      '<div data-tela-alvo="entrada" class="hidden">' +
        '<div class="kpi-row" id="fluxo-kpis-entrada"></div>' +
        regrasHTML() +
      '</div>';
  }

  /* ---------- Render ---------------------------------------------------------- */

  function desenhar(container) {
    detalhes = {};

    var kSaida = container.querySelector('#fluxo-kpis-saida');
    if (kSaida) kSaida.innerHTML = kpisSaidaHTML();

    var kEntrada = container.querySelector('#fluxo-kpis-entrada');
    if (kEntrada) kEntrada.innerHTML = kpisEntradaHTML();

    SAGETI.charts.barrasPorTipo('grafico-saida-status', saidaPorStatusDados(), {
      // Só os 4 status que viram card acima — não os 8 que o formulário de
      // saída aceita (Manutenção/Disponibilizado/etc. têm outro papel ali).
      todasCategorias: STATUS_SAIDA_MENCIONADOS,
      aoClicar: function (categoria) {
        if (!categoria) return;
        UI.modalEquipamentos(categoria, listaSaidaPorStatus(categoria));
      }
    });
  }

  /* ---------- Montagem --------------------------------------------------------- */

  function montar(container) {
    container.innerHTML = esqueleto();

    container.addEventListener('click', function (e) {
      var alvo = e.target.closest('[data-tela]');
      if (alvo) {
        telaAtual = alvo.getAttribute('data-tela');
        container.querySelectorAll('[data-tela]').forEach(function (b) {
          var ativo = b === alvo;
          b.classList.toggle('is-active', ativo);
          b.setAttribute('aria-selected', ativo ? 'true' : 'false');
        });
        container.querySelectorAll('[data-tela-alvo]').forEach(function (bloco) {
          bloco.classList.toggle('hidden', bloco.getAttribute('data-tela-alvo') !== telaAtual);
        });
        return;
      }

      alvo = e.target.closest('[data-chave]');
      if (alvo) abrirDetalhes(alvo.getAttribute('data-chave'));
    });

    // Teclado: os cards de KPI são focáveis (role="button"); Enter/Espaço ativa.
    container.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var alvo = e.target.closest('[data-chave]');
      if (!alvo) return;
      e.preventDefault();
      alvo.click();
    });

    desenhar(container);

    // Tempo real: qualquer mutação no store repinta os dois painéis.
    var cancelar = SAGETI.store.assinar(function () { desenhar(container); });

    return {
      destruir: function () {
        cancelar();
        SAGETI.charts.destruirTodos();
      }
    };
  }

  SAGETI.pages = SAGETI.pages || {};
  SAGETI.pages.fluxo = { titulo: titulo, subtitulo: subtitulo, montar: montar };

})(window.SAGETI);
