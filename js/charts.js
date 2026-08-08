/* ==========================================================================
   SAGE-TI — Camada de gráficos (Chart.js)
   --------------------------------------------------------------------------
   Decisões de forma e cor:
   · "Por tipo de equipamento" tem 14 classes possíveis -> BARRAS HORIZONTAIS
     em uma única cor (o comprimento já codifica a magnitude). Um donut de 14
     fatias seria ilegível e um degradê por valor duplicaria a codificação.
   · "Composição do estoque" tem 4 estados de saúde -> DONUT (parte-do-todo,
     <= 6 segmentos) com a paleta de STATUS, que é reservada para estado.
     "Disponibilizado" fica fora: não está no laboratório e não é estado de
     saúde — aparece como stat tile próprio.
   · "Entradas x Saídas" são duas identidades -> LINHAS nos slots categóricos
     1 e 2, com legenda sempre presente.
   Toda cor sai de variáveis CSS, então o modo escuro é um conjunto de passos
   selecionado — não uma inversão automática.
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  var instancias = {};   // id do canvas -> Chart
  var construtores = {}; // id do canvas -> função que redesenha

  function css(nome) {
    return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  }

  function paleta() {
    return {
      surface:   css('--surface-1'),
      texto:     css('--text-primary'),
      secundario:css('--text-secondary'),
      muted:     css('--text-muted'),
      grid:      css('--gridline'),
      baseline:  css('--baseline'),
      series: [
        css('--series-1'), css('--series-2'), css('--series-3'), css('--series-4'),
        css('--series-5'), css('--series-6'), css('--series-7'), css('--series-8')
      ],
      status: {
        good:     css('--status-good'),
        warning:  css('--status-warning'),
        serious:  css('--status-serious'),
        critical: css('--status-critical'),
        neutral:  css('--status-neutral')
      }
    };
  }

  function disponivel() { return typeof window.Chart !== 'undefined'; }

  /* ---------- Suporte a drill-down ------------------------------------------
     Marcas clicáveis: a selecionada mantém a cor cheia e as demais recuam
     para 22% de opacidade. O recuo é o que comunica "há um filtro ativo" sem
     precisar de outro elemento na tela.
     ---------------------------------------------------------------------- */

  function comAlpha(cor, alpha) {
    var c = String(cor || '').trim();
    if (c[0] === '#') {
      if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
      var n = parseInt(c.slice(1), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
    }
    if (c.indexOf('rgb(') === 0) return c.replace('rgb(', 'rgba(').replace(')', ',' + alpha + ')');
    return c;
  }

  /**
   * Cores de uma série considerando a seleção atual.
   * @param {string[]} rotulos
   * @param {string|string[]} cores  uma cor para todos, ou uma por marca
   * @param {string} selecionado     rótulo em destaque ('' = nenhum)
   */
  function coresComSelecao(rotulos, cores, selecionado) {
    var lista = Array.isArray(cores) ? cores : rotulos.map(function () { return cores; });
    if (!selecionado) return lista;
    return lista.map(function (cor, i) {
      return rotulos[i] === selecionado ? cor : comAlpha(cor, 0.22);
    });
  }

  /** Handlers de clique e de cursor, compartilhados por todos os gráficos. */
  function interacao(rotulos, aoClicar) {
    if (!aoClicar) return {};
    return {
      onClick: function (evt, elementos) {
        if (!elementos.length) return aoClicar('');   // clique no vazio limpa
        aoClicar(rotulos[elementos[0].index]);
      },
      onHover: function (evt, elementos) {
        var alvo = evt.native && evt.native.target;
        if (alvo) alvo.style.cursor = elementos.length ? 'pointer' : 'default';
      }
    };
  }

  /**
   * Devolve o canvas do gráfico, recriando-o se um estado vazio o tiver
   * substituído. Sem isso, uma dashboard que nasce vazia nunca voltaria a
   * desenhar depois do primeiro registro.
   * O contêiner precisa declarar data-canvas="<id>" (e opcionalmente
   * data-rotulo) — ver o cartão de gráfico em pages/dashboard.js.
   */
  function obterCanvas(canvasId) {
    var canvas = document.getElementById(canvasId);
    if (canvas) return canvas;

    var box = document.querySelector('[data-canvas="' + canvasId + '"]');
    if (!box) return null;

    box.innerHTML = '';
    canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', box.getAttribute('data-rotulo') || 'Gráfico');
    box.appendChild(canvas);
    return canvas;
  }

  /** Substitui o canvas por uma mensagem, preservando o contêiner. */
  function mensagemNoLugar(canvas, iconeNome, texto, complemento) {
    var box = canvas.parentElement;
    if (!box) return;
    destruir(canvas.id);
    box.innerHTML = '<div class="chart-empty">' + SAGETI.ui.icone(iconeNome, 34) +
      '<div>' + SAGETI.util.esc(texto) + '</div>' +
      (complemento ? '<div style="font-size:11.5px">' + SAGETI.util.esc(complemento) + '</div>' : '') +
      '</div>';
  }

  function semBiblioteca(canvas, mensagem) {
    mensagemNoLugar(canvas, 'grafico',
      mensagem || 'Biblioteca de gráficos indisponível.',
      'Os mesmos números estão na visão "Tabela" deste cartão.');
  }

  function vazio(canvas, mensagem) {
    mensagemNoLugar(canvas, 'vazio', mensagem || 'Sem dados no período.');
  }

  function destruir(id) {
    if (instancias[id]) { instancias[id].destroy(); delete instancias[id]; }
  }

  /** Tooltip com a mesma tinta do resto da interface. */
  function tooltipBase(p) {
    return {
      backgroundColor: p.surface,
      titleColor: p.texto,
      bodyColor: p.secundario,
      borderColor: p.grid,
      borderWidth: 1,
      cornerRadius: 8,
      padding: 10,
      titleFont: { size: 12.5, weight: '600', family: 'system-ui, sans-serif' },
      bodyFont: { size: 12.5, family: 'system-ui, sans-serif' },
      displayColors: true,
      boxWidth: 9,
      boxHeight: 9,
      boxPadding: 5,
      usePointStyle: true
    };
  }

  var FONTE = { family: 'system-ui, -apple-system, "Segoe UI", sans-serif', size: 11.5 };

  /* ---------- 1. Barras horizontais: estoque por tipo ---------------------- */

  /**
   * @param {Object} dados               { categoria: quantidade }
   * @param {Object} [opcoes]
   * @param {Function} opcoes.aoClicar   recebe a categoria clicada ('' limpa)
   * @param {string}  opcoes.selecionado categoria em destaque
   * @param {string[]} opcoes.todasCategorias  garante a exibição de todas,
   *        inclusive as zeradas — mostrar "Scanner: 0" é informação, não ruído.
   */
  function barrasPorTipo(canvasId, dados, opcoes) {
    opcoes = opcoes || {};
    var canvas = obterCanvas(canvasId);
    if (!canvas) return;
    destruir(canvasId);
    construtores[canvasId] = function () { barrasPorTipo(canvasId, dados, opcoes); };

    var chaves = Object.keys(dados);
    if (opcoes.todasCategorias) {
      opcoes.todasCategorias.forEach(function (c) {
        if (chaves.indexOf(c) === -1) chaves.push(c);
      });
    }

    var itens = chaves
      .map(function (k) { return { rotulo: k, valor: dados[k] || 0 }; })
      .filter(function (i) { return opcoes.todasCategorias || i.valor > 0; })
      // Maior primeiro; entre os zerados, ordem alfabética.
      .sort(function (a, b) {
        if (b.valor !== a.valor) return b.valor - a.valor;
        return a.rotulo.localeCompare(b.rotulo, 'pt-BR');
      });

    if (!itens.length) return vazio(canvas, 'Nenhum equipamento no recorte atual.');
    if (!disponivel()) return semBiblioteca(canvas);

    var p = paleta();
    var rotulos = itens.map(function (i) { return i.rotulo; });
    var total = itens.reduce(function (s, i) { return s + i.valor; }, 0);

    instancias[canvasId] = new window.Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: rotulos,
        datasets: [{
          label: 'Equipamentos',
          data: itens.map(function (i) { return i.valor; }),
          // Série única: uma cor para todas as barras (o comprimento já codifica
          // a magnitude); a seleção apenas recua as não escolhidas.
          backgroundColor: coresComSelecao(rotulos, p.series[0], opcoes.selecionado),
          hoverBackgroundColor: p.series[0],
          borderRadius: { topLeft: 0, bottomLeft: 0, topRight: 4, bottomRight: 4 },
          borderSkipped: 'start',
          barThickness: 'flex',
          maxBarThickness: 18,
          categoryPercentage: 0.82,
          barPercentage: 0.9
        }]
      },
      options: Object.assign({
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 30, left: 2, top: 4, bottom: 2 } },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign(tooltipBase(p), {
            callbacks: {
              label: function (ctx) {
                var pct = total ? Math.round(ctx.parsed.x / total * 100) : 0;
                return ' ' + SAGETI.util.numero(ctx.parsed.x) + ' un. · ' + pct + '% do recorte';
              },
              afterLabel: function () {
                return opcoes.aoClicar ? 'Clique para filtrar' : '';
              }
            }
          })
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: p.grid, drawTicks: false, lineWidth: 1 },
            border: { color: p.baseline },
            ticks: { color: p.muted, font: FONTE, precision: 0, padding: 6 }
          },
          y: {
            grid: { display: false },
            border: { color: p.baseline },
            ticks: {
              color: p.secundario, font: FONTE, padding: 6, autoSkip: false,
              // Categoria selecionada em destaque também no eixo.
              callback: function (v, i) {
                var r = rotulos[i];
                return r.length > 22 ? r.slice(0, 21) + '…' : r;
              }
            }
          }
        },
        animation: { duration: 320 }
      }, interacao(rotulos, opcoes.aoClicar)),
      plugins: [rotuloNaPonta(p, opcoes.selecionado, rotulos)]
    });
  }

  /** Valor na ponta da barra — rótulo direto, sem número em cima de tudo. */
  function rotuloNaPonta(p, selecionado, rotulos) {
    return {
      id: 'rotuloNaPonta',
      afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx;
        var meta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        meta.data.forEach(function (barra, i) {
          var v = chart.data.datasets[0].data[i];
          var atenuado = selecionado && rotulos && rotulos[i] !== selecionado;
          // Zerado ainda recebe o "0": a ausência é informação no drill-down.
          ctx.font = (v && !atenuado ? '600 ' : '400 ') + '11.5px ' + FONTE.family;
          ctx.fillStyle = atenuado || !v ? p.muted : p.secundario;
          ctx.fillText(SAGETI.util.numero(v), barra.x + 7, barra.y);
        });
        ctx.restore();
      }
    };
  }

  /* ---------- 2. Donut: composição do estoque por status ------------------- */

  /**
   * Donut de parte-do-todo.
   * @param {string} canvasId
   * @param {Array<{rotulo,valor,cor}>} fatias  já ordenadas por severidade;
   *        as de valor zero são descartadas. Máximo recomendado: 6.
   */
  function donutStatus(canvasId, fatias, opcoes) {
    opcoes = opcoes || {};
    var canvas = obterCanvas(canvasId);
    if (!canvas) return;
    destruir(canvasId);
    construtores[canvasId] = function () { donutStatus(canvasId, fatias, opcoes); };

    var p = paleta();
    var itens = (fatias || []).filter(function (i) { return i.valor > 0; });

    if (!itens.length) return vazio(canvas, 'Nenhum equipamento no recorte atual.');
    if (!disponivel()) return semBiblioteca(canvas);

    var rotulos = itens.map(function (i) { return i.rotulo; });
    var total = itens.reduce(function (s, i) { return s + i.valor; }, 0);
    var sel = opcoes.selecionado;
    // Com uma fatia selecionada, o centro mostra o recorte, não o todo.
    var destaque = sel ? (itens.find(function (i) { return i.rotulo === sel; }) || {}).valor || 0 : total;

    instancias[canvasId] = new window.Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: rotulos,
        datasets: [{
          data: itens.map(function (i) { return i.valor; }),
          backgroundColor: coresComSelecao(rotulos, itens.map(function (i) { return i.cor; }), sel),
          hoverBackgroundColor: itens.map(function (i) { return i.cor; }),
          borderColor: p.surface,   // o "borda" aqui é o vão de 2px na cor da superfície
          borderWidth: 2,
          hoverOffset: 6,
          spacing: 0
        }]
      },
      options: Object.assign({
        responsive: true,
        maintainAspectRatio: false,
        cutout: '64%',
        layout: { padding: 8 },
        plugins: {
          legend: { display: false }, // legenda desenhada em HTML, com os valores
          tooltip: Object.assign(tooltipBase(p), {
            callbacks: {
              label: function (ctx) {
                var pct = total ? Math.round(ctx.parsed / total * 100) : 0;
                return ' ' + SAGETI.util.numero(ctx.parsed) + ' un. · ' + pct + '%';
              },
              afterLabel: function (ctx) {
                if (!opcoes.aoClicar) return '';
                return rotulos[ctx.dataIndex] === sel
                  ? 'Clique para remover o filtro'
                  : 'Clique para filtrar por esta situação';
              }
            }
          })
        },
        animation: { duration: 320 }
      }, interacao(rotulos, opcoes.aoClicar)),
      plugins: [{
        id: 'centro',
        afterDraw: function (chart) {
          var ctx = chart.ctx;
          var area = chart.chartArea;
          if (!area) return;
          var cx = (area.left + area.right) / 2;
          var cy = (area.top + area.bottom) / 2;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.fillStyle = p.texto;
          ctx.font = '620 26px ' + FONTE.family;   // figuras proporcionais
          ctx.fillText(SAGETI.util.numero(destaque), cx, cy + 2);
          ctx.fillStyle = p.muted;
          ctx.font = '11.5px ' + FONTE.family;
          ctx.fillText(sel ? String(sel).toLowerCase() : (opcoes.rotuloCentro || 'no laboratório'),
            cx, cy + 20);
          ctx.restore();
        }
      }]
    });
  }

  /* ---------- 3. Linhas: entradas x saídas --------------------------------- */

  function linhasMovimentacao(canvasId, serie) {
    var canvas = obterCanvas(canvasId);
    if (!canvas) return;
    destruir(canvasId);
    construtores[canvasId] = function () { linhasMovimentacao(canvasId, serie); };

    var houve = serie.entradas.some(Boolean) || serie.saidas.some(Boolean);
    if (!houve) return vazio(canvas, 'Sem movimentações no período.');
    if (!disponivel()) return semBiblioteca(canvas);

    var p = paleta();
    var rotulos = serie.labels.map(function (iso) { return SAGETI.util.dataBR(iso).slice(0, 5); });

    instancias[canvasId] = new window.Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: rotulos,
        datasets: [
          {
            label: 'Entradas',
            data: serie.entradas,
            borderColor: p.series[0],
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.28,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBorderWidth: 2,
            pointHoverBorderColor: p.surface,   // anel de 2px na cor da superfície
            pointHoverBackgroundColor: p.series[0]
          },
          {
            label: 'Saídas',
            data: serie.saidas,
            borderColor: p.series[1],
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.28,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBorderWidth: 2,
            pointHoverBorderColor: p.surface,
            pointHoverBackgroundColor: p.series[1]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },  // alvo generoso, sem mira
        layout: { padding: { top: 6, right: 8 } },
        plugins: {
          legend: { display: false }, // legenda em HTML, sempre presente
          tooltip: Object.assign(tooltipBase(p), {
            callbacks: {
              title: function (itens) {
                var i = itens[0].dataIndex;
                return SAGETI.util.dataBR(serie.labels[i]);
              },
              label: function (ctx) { return ' ' + ctx.dataset.label + ': ' + ctx.parsed.y; }
            }
          })
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: p.baseline },
            ticks: {
              color: p.muted, font: FONTE, maxRotation: 0, autoSkip: true,
              maxTicksLimit: 10, padding: 6
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: p.grid, drawTicks: false, lineWidth: 1 },
            border: { display: false },
            ticks: { color: p.muted, font: FONTE, precision: 0, padding: 8 }
          }
        },
        animation: { duration: 380 }
      }
    });
  }

  /* ---------- 4. Barras: top prédios de origem ----------------------------- */

  function barrasPorPredio(canvasId, porPredio, limite, opcoes) {
    opcoes = opcoes || {};
    var canvas = obterCanvas(canvasId);
    if (!canvas) return;
    destruir(canvasId);
    construtores[canvasId] = function () { barrasPorPredio(canvasId, porPredio, limite, opcoes); };

    limite = limite || 8;
    var todos = Object.keys(porPredio)
      .map(function (k) { return { rotulo: k, valor: porPredio[k] }; })
      .filter(function (i) { return i.valor > 0; })
      .sort(function (a, b) { return b.valor - a.valor; });

    if (!todos.length) return vazio(canvas, 'Nenhuma origem registrada.');

    // Cauda vira "Outros" — nunca se resolve excesso de classes gerando cores.
    var itens = todos.slice(0, limite);
    var cauda = todos.slice(limite);
    if (cauda.length) {
      itens.push({
        rotulo: 'Outros (' + cauda.length + ')',
        valor: cauda.reduce(function (s, i) { return s + i.valor; }, 0)
      });
    }

    if (!disponivel()) return semBiblioteca(canvas);
    var p = paleta();
    var completos = itens.map(function (i) { return i.rotulo; });
    // "Outros (n)" é um agregado: não serve como filtro.
    var clicaveis = opcoes.aoClicar ? function (r) {
      if (/^Outros \(\d+\)$/.test(r)) return;
      opcoes.aoClicar(r);
    } : null;

    instancias[canvasId] = new window.Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: completos.map(function (r) {
          return r.length > 30 ? r.slice(0, 29) + '…' : r;
        }),
        datasets: [{
          label: 'Equipamentos',
          data: itens.map(function (i) { return i.valor; }),
          backgroundColor: coresComSelecao(completos, p.series[0], opcoes.selecionado),
          hoverBackgroundColor: p.series[0],
          borderRadius: { topLeft: 0, bottomLeft: 0, topRight: 4, bottomRight: 4 },
          borderSkipped: 'start',
          maxBarThickness: 18,
          categoryPercentage: 0.82
        }]
      },
      options: Object.assign({
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 30 } },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign(tooltipBase(p), {
            callbacks: {
              title: function (ctx) { return completos[ctx[0].dataIndex]; },
              label: function (ctx) { return ' ' + SAGETI.util.numero(ctx.parsed.x) + ' un.'; }
            }
          })
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: p.grid, drawTicks: false },
            border: { color: p.baseline },
            ticks: { color: p.muted, font: FONTE, precision: 0, padding: 6 }
          },
          y: {
            grid: { display: false },
            border: { color: p.baseline },
            ticks: { color: p.secundario, font: FONTE, padding: 6, autoSkip: false }
          }
        },
        animation: { duration: 320 }
      }, interacao(completos, clicaveis)),
      plugins: [rotuloNaPonta(p, opcoes.selecionado, completos)]
    });
  }

  /* ---------- Legenda HTML e tabela-gêmea ----------------------------------- */

  /** Legenda com swatch + rótulo + valor (identidade nunca depende só da cor). */
  function legendaHTML(itens) {
    return itens.map(function (i) {
      return '<span class="chart-legend__item">' +
        '<span class="chart-legend__swatch" style="background:' + i.cor + '"></span>' +
        SAGETI.util.esc(i.rotulo) +
        (i.valor != null ? ' <span class="chart-legend__val">' + SAGETI.util.numero(i.valor) + '</span>' : '') +
        '</span>';
    }).join('');
  }

  /** Tabela equivalente ao gráfico — todo valor é alcançável sem hover. */
  function tabelaHTML(colunas, linhas) {
    var html = '<table class="chart-table"><thead><tr>';
    colunas.forEach(function (c) { html += '<th>' + SAGETI.util.esc(c) + '</th>'; });
    html += '</tr></thead><tbody>';
    linhas.forEach(function (l) {
      html += '<tr>';
      l.forEach(function (celula, i) {
        if (i === 0 && typeof celula === 'object') {
          html += '<td><span class="chart-table__key" style="background:' + celula.cor + '"></span>' +
            SAGETI.util.esc(celula.texto) + '</td>';
        } else {
          html += '<td>' + SAGETI.util.esc(celula) + '</td>';
        }
      });
      html += '</tr>';
    });
    return html + '</tbody></table>';
  }

  /** Redesenha todos os gráficos vivos — usado na troca de tema. */
  function repintarTodos() {
    Object.keys(construtores).forEach(function (id) {
      if (document.getElementById(id)) {
        try { construtores[id](); } catch (e) { /* canvas já removido */ }
      } else {
        destruir(id);
        delete construtores[id];
      }
    });
  }

  /** Libera todos os canvases ao trocar de página. */
  function destruirTodos() {
    Object.keys(instancias).forEach(destruir);
    construtores = {};
  }

  SAGETI.charts = {
    barrasPorTipo: barrasPorTipo,
    donutStatus: donutStatus,
    linhasMovimentacao: linhasMovimentacao,
    barrasPorPredio: barrasPorPredio,
    legendaHTML: legendaHTML,
    tabelaHTML: tabelaHTML,
    repintarTodos: repintarTodos,
    destruirTodos: destruirTodos,
    paleta: paleta,
    disponivel: disponivel
  };

})(window.SAGETI);
