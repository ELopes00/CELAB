/* ==========================================================================
   SAGE-TI — Importação de planilha (.xlsx / .xls / .csv)
   --------------------------------------------------------------------------
   Fluxo em três passos, sem gravar nada até a confirmação:
     1. Arquivo   — upload ou arrastar; escolha da aba da planilha.
     2. Colunas   — o sistema detecta os cabeçalhos e deixa ajustar à mão.
     3. Conferir  — simulação completa: quantos entram, quantos são ignorados
                    por tombo repetido e quantos são recusados, linha a linha.
   Só então o botão "Importar" grava.
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  var UI = SAGETI.ui;
  var U = SAGETI.util;

  /* ---------- Campos aceitos e sinônimos de cabeçalho -----------------------
     `apelidos` são comparados sem acento nem caixa, então "Tombo Novo",
     "TOMBO_NOVO" e "tombo novo" caem no mesmo campo.
     ---------------------------------------------------------------------- */

  var CAMPOS = [
    { chave: 'equipamento',       rotulo: 'Equipamento',        apelidos: ['equipamento', 'categoria', 'tipo', 'tipo de equipamento', 'item', 'descricao', 'descrição'] },
    { chave: 'modelo',            rotulo: 'Modelo',             apelidos: ['modelo', 'marca modelo', 'marca/modelo', 'marca'] },
    { chave: 'tomboNovo',         rotulo: 'Tombo Novo',         apelidos: ['tombo novo', 'tombonovo', 'tombo', 'patrimonio', 'patrimônio', 'n patrimonio', 'nº patrimônio', 'novo tombo'] },
    { chave: 'tomboAntigo',       rotulo: 'Tombo Antigo',       apelidos: ['tombo antigo', 'tomboantigo', 'antigo tombo', 'patrimonio antigo', 'tombo anterior'] },
    { chave: 'status',            rotulo: 'Status',             apelidos: ['status', 'situacao', 'situação', 'estado', 'motivo'] },
    { chave: 'chamado',           rotulo: 'Chamado',            apelidos: ['chamado', 'ticket', 'os', 'n chamado', 'nº chamado', 'protocolo'] },
    { chave: 'dataEntrada',       rotulo: 'Data de Entrada',    apelidos: ['data de entrada', 'data entrada', 'dataentrada', 'entrada', 'data'] },
    { chave: 'predioOrigem',      rotulo: 'Prédio de Origem',   apelidos: ['predio de origem', 'prédio de origem', 'predio origem', 'predio', 'prédio', 'origem', 'predio de onde veio'] },
    { chave: 'setorOrigem',       rotulo: 'Setor de Origem',    apelidos: ['setor de origem', 'setor origem', 'setor', 'unidade', 'setor/unidade', 'setor unidade', 'lotacao', 'lotação'] },
    { chave: 'dataSaida',         rotulo: 'Data de Saída',      apelidos: ['data de saida', 'data de saída', 'data saida', 'datasaida', 'saida', 'saída'] },
    { chave: 'predioDestino',     rotulo: 'Prédio de Destino',  apelidos: ['predio de destino', 'prédio de destino', 'predio destino', 'destino'] },
    { chave: 'setorDestino',      rotulo: 'Setor de Destino',   apelidos: ['setor de destino', 'setor destino', 'unidade de destino', 'unidade destino'] },
    { chave: 'ttr',               rotulo: 'TTR',                apelidos: ['ttr', 'termo', 'termo de transferencia', 'termo de transferência'] },
    { chave: 'tecnico',           rotulo: 'Técnico Responsável', apelidos: ['tecnico', 'técnico', 'tecnico responsavel', 'técnico responsável', 'responsavel', 'responsável', 'atendente'] },
    { chave: 'servicoSolicitado', rotulo: 'Serviço Solicitado', apelidos: ['servico solicitado', 'serviço solicitado', 'servico', 'serviço', 'observacao', 'observação', 'obs', 'descricao do servico'] }
  ];

  /* ---------- Leitura de arquivo -------------------------------------------- */

  function lerArquivo(arquivo) {
    return new Promise(function (resolve, reject) {
      var ehCSV = /\.csv$/i.test(arquivo.name);
      var leitor = new FileReader();

      leitor.onerror = function () { reject(new Error('Não foi possível ler o arquivo.')); };

      leitor.onload = function () {
        try {
          if (ehCSV) {
            resolve({ abas: ['CSV'], porAba: { CSV: lerCSV(String(leitor.result)) } });
            return;
          }
          if (typeof window.XLSX === 'undefined') {
            reject(new Error('A biblioteca de leitura de Excel não carregou. ' +
              'Verifique a conexão ou salve a planilha como .csv.'));
            return;
          }
          var wb = window.XLSX.read(new Uint8Array(leitor.result), {
            type: 'array', cellDates: true, cellText: false
          });
          var porAba = {};
          wb.SheetNames.forEach(function (nome) {
            porAba[nome] = window.XLSX.utils.sheet_to_json(wb.Sheets[nome], {
              header: 1, raw: false, defval: '', blankrows: false
            });
          });
          resolve({ abas: wb.SheetNames, porAba: porAba });
        } catch (e) {
          reject(new Error('Arquivo inválido ou corrompido: ' + e.message));
        }
      };

      if (ehCSV) leitor.readAsText(arquivo, 'UTF-8');
      else leitor.readAsArrayBuffer(arquivo);
    });
  }

  /** CSV com detecção de separador e suporte a campos entre aspas. */
  function lerCSV(texto) {
    texto = texto.replace(/^﻿/, '');
    var primeira = texto.split(/\r?\n/)[0] || '';
    var sep = (primeira.split(';').length > primeira.split(',').length) ? ';' : ',';

    var linhas = [], atual = [], campo = '', dentro = false;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (dentro) {
        if (c === '"') {
          if (texto[i + 1] === '"') { campo += '"'; i++; }
          else dentro = false;
        } else campo += c;
        continue;
      }
      if (c === '"') { dentro = true; continue; }
      if (c === sep) { atual.push(campo); campo = ''; continue; }
      if (c === '\n') { atual.push(campo); linhas.push(atual); atual = []; campo = ''; continue; }
      if (c === '\r') continue;
      campo += c;
    }
    if (campo !== '' || atual.length) { atual.push(campo); linhas.push(atual); }

    return linhas.filter(function (l) {
      return l.some(function (v) { return String(v).trim() !== ''; });
    });
  }

  /* ---------- Detecção de colunas ------------------------------------------- */

  function detectarMapa(cabecalho) {
    var mapa = {};
    var usadas = {};

    CAMPOS.forEach(function (campo) {
      for (var i = 0; i < cabecalho.length; i++) {
        if (usadas[i]) continue;
        var titulo = U.slug(cabecalho[i]);
        if (!titulo) continue;
        if (campo.apelidos.some(function (a) { return U.slug(a) === titulo; })) {
          mapa[campo.chave] = i;
          usadas[i] = true;
          return;
        }
      }
      // Segunda passada: aceita correspondência parcial.
      for (var j = 0; j < cabecalho.length; j++) {
        if (usadas[j]) continue;
        var t = U.slug(cabecalho[j]);
        if (!t) continue;
        if (campo.apelidos.some(function (a) {
          var s = U.slug(a);
          return s.length > 3 && (t.indexOf(s) > -1 || s.indexOf(t) > -1);
        })) {
          mapa[campo.chave] = j;
          usadas[j] = true;
          return;
        }
      }
      mapa[campo.chave] = -1;
    });

    return mapa;
  }

  /* ---------- Normalização de valores --------------------------------------- */

  /** Aceita 31/07/2026, 2026-07-31, Date e serial do Excel. */
  function paraISO(valor) {
    if (valor == null || valor === '') return '';
    if (valor instanceof Date && !isNaN(valor)) {
      return new Date(valor.getTime() - valor.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 10);
    }
    var s = String(valor).trim();
    if (!s) return '';

    var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (m) {
      var ano = m[3].length === 2 ? '20' + m[3] : m[3];
      return ano + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    }
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');

    // Serial do Excel (dias desde 30/12/1899).
    if (/^\d{5}(\.\d+)?$/.test(s)) {
      var d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
      if (!isNaN(d)) return d.toISOString().slice(0, 10);
    }
    return '';
  }

  /** Preserva zeros à esquerda do tombo (045112 não pode virar 45112). */
  function paraTombo(valor) {
    if (valor == null) return '';
    var s = String(valor).trim();
    if (/^\d+(\.0+)?$/.test(s)) s = s.replace(/\.0+$/, '');
    return s;
  }

  /** Converte a matriz da planilha em registros, segundo o mapa de colunas. */
  function montarLinhas(matriz, mapa, linhaCabecalho) {
    var out = [];
    for (var i = linhaCabecalho + 1; i < matriz.length; i++) {
      var bruta = matriz[i] || [];
      var reg = { _linha: i + 1 };

      CAMPOS.forEach(function (campo) {
        var idx = mapa[campo.chave];
        var v = (idx >= 0 && idx < bruta.length) ? bruta[idx] : '';

        if (campo.chave === 'dataEntrada' || campo.chave === 'dataSaida') {
          reg[campo.chave] = paraISO(v);
        } else if (campo.chave === 'tomboNovo' || campo.chave === 'tomboAntigo') {
          reg[campo.chave] = paraTombo(v);
        } else {
          reg[campo.chave] = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
        }
      });

      out.push(reg);
    }
    return out;
  }

  /* ---------- Modelo de planilha -------------------------------------------- */

  function baixarModelo() {
    var cabecalho = CAMPOS.map(function (c) { return c.rotulo; });
    var exemplo = [
      'Monitor', 'LG 24BL550J-B', '045112', '11233', 'Entrada de Estoque',
      'CH-10450', '31/07/2026', 'Sede Administrativa',
      'STI - Secretaria de Tecnologia da Informação',
      '', '', '', 'Realizada', 'Keittony Rodrigo',
      'Recolhimento para avaliação técnica.'
    ];

    if (typeof window.XLSX !== 'undefined') {
      var ws = window.XLSX.utils.aoa_to_sheet([cabecalho, exemplo]);
      ws['!cols'] = CAMPOS.map(function (c) {
        return { wch: Math.max(14, Math.min(40, c.rotulo.length + 8)) };
      });
      var wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Inventário');
      window.XLSX.writeFile(wb, SAGETI.APP.nome + '_modelo_importacao.xlsx');
    } else {
      var csv = cabecalho.join(';') + '\r\n' + exemplo.join(';');
      U.baixarArquivo('﻿' + csv, SAGETI.APP.nome + '_modelo_importacao.csv', 'text/csv;charset=utf-8');
    }
    UI.toast('success', 'Modelo gerado',
      'Preencha as colunas e importe. Colunas em branco podem ser removidas.');
  }

  /* ---------- Interface ----------------------------------------------------- */

  function abrir() {
    if (!SAGETI.auth.permissao('podeImportar')) {
      return UI.toast('warn', 'Sem permissão', 'Seu perfil não pode importar dados.');
    }

    var ctx = {
      passo: 1,
      arquivo: null,
      abas: [], porAba: {}, aba: '',
      linhaCabecalho: 0,
      mapa: {},
      detectado: {},
      linhas: [],
      simulacao: null,
      criarOpcoes: true,
      atualizarExistentes: false
    };

    var corpo = document.createElement('div');

    var ref = UI.modal({
      titulo: 'Importar planilha',
      subtitulo: 'Carga de inventário a partir de Excel ou CSV',
      corpo: corpo,
      botoes: [
        { texto: 'Baixar modelo', classe: 'btn--ghost', icone: 'download',
          fechar: false, acao: function () { baixarModelo(); return false; } },
        { texto: 'Fechar', classe: 'btn--ghost' }
      ]
    });

    function passosHTML() {
      var nomes = ['Arquivo', 'Colunas', 'Conferir'];
      return '<div class="import-passos">' + nomes.map(function (n, i) {
        var num = i + 1;
        var cls = num === ctx.passo ? 'is-atual' : (num < ctx.passo ? 'is-feito' : '');
        return '<span class="import-passo ' + cls + '">' +
          '<span class="import-passo__n">' + (num < ctx.passo ? '✓' : num) + '</span>' + n + '</span>';
      }).join('') + '</div>';
    }

    function desenhar() {
      if (ctx.passo === 1) desenharPasso1();
      else if (ctx.passo === 2) desenharPasso2();
      else desenharPasso3();
    }

    /* --- passo 1: arquivo --- */
    function desenharPasso1() {
      corpo.innerHTML = passosHTML() +
        '<div class="dropzone" id="dz" tabindex="0" role="button" ' +
          'aria-label="Selecionar arquivo para importar">' +
          UI.icone('upload', 32) +
          '<div class="dropzone__titulo">Arraste a planilha aqui ou clique para escolher</div>' +
          '<div class="dropzone__sub">Formatos aceitos: .xlsx, .xls e .csv</div>' +
        '</div>' +
        '<input type="file" id="arq" accept=".xlsx,.xls,.csv" class="hidden">' +
        '<div class="alert alert--info" style="margin:16px 0 0">' + UI.icone('info', 17) +
          '<span>Nada é gravado agora. Você verá exatamente o que será criado antes de ' +
          'confirmar. Se não souber o formato, use <strong>Baixar modelo</strong>.</span></div>' +
        '<div id="erro-arq"></div>';

      var dz = corpo.querySelector('#dz');
      var input = corpo.querySelector('#arq');

      dz.addEventListener('click', function () { input.click(); });
      dz.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('is-over'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('is-over'); });
      });
      dz.addEventListener('drop', function (e) {
        var f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) carregar(f);
      });
      input.addEventListener('change', function () {
        if (this.files && this.files[0]) carregar(this.files[0]);
      });
    }

    function carregar(arquivo) {
      var erro = corpo.querySelector('#erro-arq');
      erro.innerHTML = '<div style="padding:12px;font-size:12.5px;color:var(--text-muted)">' +
        'Lendo ' + U.esc(arquivo.name) + '…</div>';

      lerArquivo(arquivo).then(function (res) {
        ctx.arquivo = arquivo;
        ctx.abas = res.abas;
        ctx.porAba = res.porAba;
        // Primeira aba que tenha ao menos duas linhas.
        ctx.aba = res.abas.find(function (a) { return (res.porAba[a] || []).length > 1; }) || res.abas[0];

        var matriz = ctx.porAba[ctx.aba] || [];
        if (matriz.length < 2) {
          erro.innerHTML = '<div class="alert" style="margin-top:14px;border-color:' +
            'var(--status-critical)">' + UI.icone('alerta', 17) +
            '<span>A planilha tem menos de duas linhas: é preciso um cabeçalho e ao ' +
            'menos um registro.</span></div>';
          return;
        }
        prepararMapa();
        ctx.passo = 2;
        desenhar();
      }).catch(function (e) {
        erro.innerHTML = '<div class="alert" style="margin-top:14px;border-color:' +
          'var(--status-critical)">' + UI.icone('alerta', 17) +
          '<span>' + U.esc(e.message) + '</span></div>';
      });
    }

    function prepararMapa() {
      var matriz = ctx.porAba[ctx.aba] || [];
      // Cabeçalho = primeira linha com 2+ células preenchidas.
      ctx.linhaCabecalho = 0;
      for (var i = 0; i < Math.min(matriz.length, 12); i++) {
        var preenchidas = (matriz[i] || []).filter(function (v) {
          return String(v).trim() !== '';
        }).length;
        if (preenchidas >= 2) { ctx.linhaCabecalho = i; break; }
      }
      ctx.mapa = detectarMapa(matriz[ctx.linhaCabecalho] || []);
      ctx.detectado = Object.assign({}, ctx.mapa);
    }

    /* --- passo 2: colunas --- */
    function desenharPasso2() {
      var matriz = ctx.porAba[ctx.aba] || [];
      var cabecalho = matriz[ctx.linhaCabecalho] || [];
      var totalLinhas = Math.max(0, matriz.length - ctx.linhaCabecalho - 1);

      var colunasOpcoes = [{ valor: '-1', rotulo: '— não importar —' }];
      cabecalho.forEach(function (c, i) {
        colunasOpcoes.push({
          valor: String(i),
          rotulo: (String(c).trim() || 'Coluna ' + (i + 1)) + '  [' + letraColuna(i) + ']'
        });
      });

      var detectados = Object.keys(ctx.detectado).filter(function (k) {
        return ctx.detectado[k] >= 0;
      }).length;

      var html = passosHTML() +
        '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px">' +
          '<div class="field" style="flex:1 1 200px">' +
            '<label for="sel-aba">Aba da planilha</label>' +
            '<select class="select" id="sel-aba">' +
              UI.opcoes(ctx.abas.map(function (a) {
                return { valor: a, rotulo: a + '  (' +
                  Math.max(0, (ctx.porAba[a] || []).length - 1) + ' linha(s))' };
              }), ctx.aba, false) + '</select>' +
          '</div>' +
          '<div class="field" style="flex:0 1 170px">' +
            '<label for="sel-cab">Linha do cabeçalho</label>' +
            '<input class="input" type="number" id="sel-cab" min="1" max="20" ' +
              'value="' + (ctx.linhaCabecalho + 1) + '">' +
          '</div>' +
        '</div>' +

        '<div class="alert alert--info" style="margin-bottom:14px">' + UI.icone('check', 17) +
          '<span><strong>' + detectados + ' de ' + CAMPOS.length + ' colunas</strong> ' +
          'reconhecidas automaticamente em ' + U.esc(ctx.arquivo.name) + ' · ' +
          totalLinhas + ' linha(s) de dados. Ajuste o que estiver errado abaixo.</span></div>' +

        '<div class="section-title" style="margin-top:0">Correspondência de colunas</div>' +
        '<div class="mapa-colunas">';

      CAMPOS.forEach(function (campo) {
        var auto = ctx.detectado[campo.chave] >= 0 &&
                   ctx.detectado[campo.chave] === ctx.mapa[campo.chave];
        html += '<div class="mapa-item' + (auto ? ' mapa-item--auto' : '') + '">' +
          '<label for="map-' + campo.chave + '">' + U.esc(campo.rotulo) + '</label>' +
          '<select class="select" id="map-' + campo.chave + '" data-campo="' + campo.chave + '">' +
            UI.opcoes(colunasOpcoes, String(ctx.mapa[campo.chave]), false) +
          '</select></div>';
      });

      html += '</div>' +

        '<div class="section-title">Opções da importação</div>' +
        '<div style="display:grid;gap:10px">' +
          '<label style="display:flex;align-items:flex-start;gap:9px;font-size:12.5px;cursor:pointer">' +
            '<input type="checkbox" id="opt-criar"' + (ctx.criarOpcoes ? ' checked' : '') +
              ' style="width:15px;height:15px;accent-color:var(--brand);margin-top:1px">' +
            '<span>Cadastrar automaticamente valores novos nas listas ' +
            '<span style="color:var(--text-muted)">(modelos, setores, prédios, técnicos e ' +
            'status que apareçam na planilha e ainda não existam)</span></span></label>' +
          '<label style="display:flex;align-items:flex-start;gap:9px;font-size:12.5px;cursor:pointer">' +
            '<input type="checkbox" id="opt-atualizar"' + (ctx.atualizarExistentes ? ' checked' : '') +
              ' style="width:15px;height:15px;accent-color:var(--brand);margin-top:1px">' +
            '<span>Atualizar equipamentos cujo tombo já existe ' +
            '<span style="color:var(--text-muted)">(desmarcado, tombos repetidos são ' +
            'ignorados e nada é sobrescrito)</span></span></label>' +
        '</div>' +

        '<div class="form-actions">' +
          '<button type="button" class="btn btn--ghost" data-voltar="1">' +
            UI.icone('voltar', 16) + '<span>Trocar arquivo</span></button>' +
          '<span class="spacer"></span>' +
          '<button type="button" class="btn btn--primary" data-simular>' +
            UI.icone('olho', 16) + '<span>Conferir antes de importar</span></button>' +
        '</div>';

      corpo.innerHTML = html;

      corpo.querySelector('#sel-aba').addEventListener('change', function () {
        ctx.aba = this.value;
        prepararMapa();
        desenhar();
      });
      corpo.querySelector('#sel-cab').addEventListener('change', function () {
        var n = Math.max(1, Number(this.value) || 1) - 1;
        ctx.linhaCabecalho = n;
        var m = ctx.porAba[ctx.aba] || [];
        ctx.mapa = detectarMapa(m[n] || []);
        ctx.detectado = Object.assign({}, ctx.mapa);
        desenhar();
      });
      corpo.querySelectorAll('[data-campo]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          ctx.mapa[this.getAttribute('data-campo')] = Number(this.value);
        });
      });
      corpo.querySelector('#opt-criar').addEventListener('change', function () {
        ctx.criarOpcoes = this.checked;
      });
      corpo.querySelector('#opt-atualizar').addEventListener('change', function () {
        ctx.atualizarExistentes = this.checked;
      });
      corpo.querySelector('[data-voltar]').addEventListener('click', function () {
        ctx.passo = 1; desenhar();
      });
      corpo.querySelector('[data-simular]').addEventListener('click', simular);
    }

    function letraColuna(i) {
      var s = '';
      i += 1;
      while (i > 0) {
        var r = (i - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        i = Math.floor((i - 1) / 26);
      }
      return s;
    }

    function simular() {
      if (ctx.mapa.tomboNovo < 0 && ctx.mapa.tomboAntigo < 0) {
        return UI.toast('error', 'Coluna de tombo obrigatória',
          'Indique ao menos a coluna de Tombo Novo ou de Tombo Antigo — é o tombo que ' +
          'identifica cada equipamento.');
      }
      ctx.linhas = montarLinhas(ctx.porAba[ctx.aba] || [], ctx.mapa, ctx.linhaCabecalho);
      SAGETI.store.importarLinhas(ctx.linhas, {
        simular: true,
        criarOpcoes: ctx.criarOpcoes,
        atualizarExistentes: ctx.atualizarExistentes
      }).then(function (simulacao) {
        ctx.simulacao = simulacao;
        ctx.passo = 3;
        desenhar();
      });
    }

    /* --- passo 3: conferir --- */
    function desenharPasso3() {
      var s = ctx.simulacao;
      var problemas = s.itens.filter(function (i) {
        return i.resultado === 'ignorado' || i.resultado === 'recusado';
      });

      var html = passosHTML() +
        '<div class="import-resumo">' +
          tile('criado', s.criados, 'Serão criados') +
          tile('atualizado', s.atualizados, 'Serão atualizados') +
          tile('ignorado', s.ignorados, 'Ignorados') +
          tile('recusado', s.recusados, 'Recusados') +
        '</div>';

      if (!s.criados && !s.atualizados) {
        html += '<div class="alert" style="border-color:var(--status-warning);' +
          'background:var(--wash-warning)">' + UI.icone('alerta', 17) +
          '<span>Nenhuma linha seria importada. Reveja a correspondência de colunas — ' +
          'em especial a coluna de tombo — ou marque "Atualizar equipamentos cujo tombo ' +
          'já existe".</span></div>';
      }

      if (problemas.length) {
        html += '<div class="section-title">Linhas não importadas (' + problemas.length + ')</div>' +
          '<div class="table-wrap" style="max-height:230px;overflow-y:auto;border:1px solid ' +
            'var(--border);border-radius:var(--radius)">' +
          '<table class="chart-table"><thead><tr><th>Linha</th><th>Tombo</th>' +
            '<th>Resultado</th><th style="text-align:left">Motivo</th></tr></thead><tbody>';
        problemas.slice(0, 200).forEach(function (i) {
          html += '<tr><td>' + i.linha + '</td>' +
            '<td>' + U.esc(i.tombo || '—') + '</td>' +
            '<td>' + (i.resultado === 'recusado'
              ? '<span class="chip chip--tom-critical"><span class="chip__dot"></span>Recusado</span>'
              : '<span class="chip chip--tom-warning"><span class="chip__dot"></span>Ignorado</span>') +
            '</td><td style="text-align:left">' + U.esc(i.motivo || '') + '</td></tr>';
        });
        html += '</tbody></table></div>';
        if (problemas.length > 200) {
          html += '<div style="font-size:11.5px;color:var(--text-muted);margin-top:6px">' +
            'Exibindo as 200 primeiras de ' + problemas.length + '.</div>';
        }
      }

      if (ctx.criarOpcoes) {
        html += '<div class="alert alert--info" style="margin-top:14px">' + UI.icone('info', 17) +
          '<span>Valores que não existirem nas listas serão cadastrados durante a ' +
          'importação. Depois, revise em <strong>Configurações → Listas</strong>.</span></div>';
      }

      html += '<div class="form-actions">' +
          '<button type="button" class="btn btn--ghost" data-voltar="2">' +
            UI.icone('voltar', 16) + '<span>Ajustar colunas</span></button>' +
          '<span class="spacer"></span>' +
          '<button type="button" class="btn btn--primary" data-confirmar' +
            (!s.criados && !s.atualizados ? ' disabled' : '') + '>' +
            UI.icone('salvar', 16) + '<span>Importar ' +
            (s.criados + s.atualizados) + ' registro(s)</span></button>' +
        '</div>';

      corpo.innerHTML = html;

      corpo.querySelector('[data-voltar]').addEventListener('click', function () {
        ctx.passo = 2; desenhar();
      });
      var btn = corpo.querySelector('[data-confirmar]');
      if (btn) btn.addEventListener('click', confirmar);
    }

    function tile(classe, valor, rotulo) {
      return '<div class="import-tile import-tile--' + classe + '">' +
        '<div class="import-tile__v">' + U.numero(valor) + '</div>' +
        '<div class="import-tile__r">' + U.esc(rotulo) + '</div></div>';
    }

    function confirmar() {
      var btn = corpo.querySelector('[data-confirmar]');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>Importando…</span>';
      }

      // Cede um quadro para o botão repintar antes do trabalho pesado.
      setTimeout(function () {
        SAGETI.store.importarLinhas(ctx.linhas, {
          criarOpcoes: ctx.criarOpcoes,
          atualizarExistentes: ctx.atualizarExistentes
        }).then(function (rel) {
          UI.fecharModal();
          UI.toast('success', 'Importação concluída',
            rel.criados + ' criado(s), ' + rel.atualizados + ' atualizado(s), ' +
            rel.ignorados + ' ignorado(s), ' + rel.recusados + ' recusado(s).', 9000);

          if (rel.opcoesCriadas.length) {
            UI.toast('info', rel.opcoesCriadas.length + ' opção(ões) cadastrada(s)',
              'Novos valores entraram nas listas. Revise em Configurações → Listas.', 9000);
          }
          if (SAGETI.app && SAGETI.app.navegar) SAGETI.app.navegar('estoque');
        }).catch(function (erro) {
          if (btn) { btn.disabled = false; btn.innerHTML = '<span>Importar</span>'; }
          UI.toast('error', 'Falha na importação', erro.message);
        });
      }, 40);
    }

    desenhar();
    return ref;
  }

  SAGETI.importar = {
    abrir: abrir,
    baixarModelo: baixarModelo,
    CAMPOS: CAMPOS,
    // expostos para os testes
    _lerCSV: lerCSV,
    _paraISO: paraISO,
    _paraTombo: paraTombo,
    _detectarMapa: detectarMapa,
    _montarLinhas: montarLinhas
  };

})(window.SAGETI);
