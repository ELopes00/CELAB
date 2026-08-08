/* ==========================================================================
   SAGE-TI — Exportação para Excel (XLSX) e PDF
   --------------------------------------------------------------------------
   SheetJS e jsPDF são carregados por CDN. Se algum não estiver disponível
   (offline), a exportação cai para CSV / janela de impressão em vez de
   simplesmente falhar.
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  var U = SAGETI.util;

  /* ---------- Definição de colunas ----------------------------------------- */

  var COLS_ESTOQUE = [
    { chave: 'equipamento',       titulo: 'Equipamento',      largura: 20 },
    { chave: 'modelo',            titulo: 'Modelo',           largura: 28 },
    { chave: 'tomboNovo',         titulo: 'Tombo Novo',       largura: 14 },
    { chave: 'tomboAntigo',       titulo: 'Tombo Antigo',     largura: 14 },
    { chave: 'status',            titulo: 'Status',           largura: 20 },
    { chave: 'noLaboratorio',     titulo: 'No Laboratório',   largura: 14, tipo: 'sim/nao' },
    { chave: 'chamado',           titulo: 'Chamado',          largura: 13 },
    { chave: 'dataEntrada',       titulo: 'Data de Entrada',  largura: 15, tipo: 'data' },
    { chave: 'predioOrigem',      titulo: 'Prédio de Origem', largura: 30 },
    { chave: 'setorOrigem',       titulo: 'Setor/Unidade',    largura: 38 },
    { chave: 'dataSaida',         titulo: 'Data de Saída',    largura: 15, tipo: 'data' },
    { chave: 'predioDestino',     titulo: 'Prédio de Destino',largura: 30 },
    { chave: 'setorDestino',      titulo: 'Setor de Destino', largura: 38 },
    { chave: 'tecnico',           titulo: 'Técnico Responsável', largura: 20 },
    { chave: 'ttr',               titulo: 'TTR',              largura: 16 },
    { chave: 'servicoSolicitado', titulo: 'Serviço Solicitado', largura: 46 }
  ];

  var COLS_MOV = [
    { chave: 'data',              titulo: 'Data',             largura: 13, tipo: 'data' },
    { chave: 'tipo',              titulo: 'Movimentação',     largura: 15, tipo: 'tipoMov' },
    { chave: 'chamado',           titulo: 'Chamado',          largura: 13 },
    { chave: 'equipamento',       titulo: 'Equipamento',      largura: 20 },
    { chave: 'modelo',            titulo: 'Modelo',           largura: 28 },
    { chave: 'tomboNovo',         titulo: 'Tombo Novo',       largura: 14 },
    { chave: 'tomboAntigo',       titulo: 'Tombo Antigo',     largura: 14 },
    { chave: 'statusAnterior',    titulo: 'Status Anterior',  largura: 20 },
    { chave: 'statusResultante',  titulo: 'Status Atual',     largura: 20 },
    { chave: 'predio',            titulo: 'Prédio',           largura: 30 },
    { chave: 'setor',             titulo: 'Setor/Unidade',    largura: 38 },
    { chave: 'tecnico',           titulo: 'Técnico Responsável', largura: 20 },
    { chave: 'ttr',               titulo: 'TTR',              largura: 16 },
    { chave: 'usuario',           titulo: 'Usuário',          largura: 14 },
    { chave: 'servicoSolicitado', titulo: 'Serviço Solicitado', largura: 46 },
    { chave: 'observacao',        titulo: 'Observação',       largura: 40 }
  ];

  /** Converte um registro em uma linha de células já formatadas. */
  function linhaDe(registro, colunas) {
    return colunas.map(function (c) {
      var v = registro[c.chave];
      if (c.tipo === 'data') return v ? U.dataBR(v) : '';
      if (c.tipo === 'tipoMov') return SAGETI.tipoMovMeta(v).rotulo;
      if (c.tipo === 'sim/nao') return v ? 'Sim' : 'Não';
      return v == null || v === '' ? '' : String(v);
    });
  }

  function matriz(registros, colunas) {
    return {
      cabecalho: colunas.map(function (c) { return c.titulo; }),
      linhas: registros.map(function (r) { return linhaDe(r, colunas); })
    };
  }

  /* ---------- Excel --------------------------------------------------------- */

  function temSheetJS() { return typeof window.XLSX !== 'undefined'; }

  /**
   * Gera um .xlsx com uma ou mais abas.
   * @param {Array<{nome:string, registros:Array, colunas:Array, resumo?:Array}>} abas
   */
  function paraExcel(abas, nomeArquivo) {
    if (!temSheetJS()) {
      SAGETI.ui.toast('warn', 'Excel indisponível', 'Biblioteca não carregada (sem internet?). Exportando em CSV.');
      var primeira = abas[0];
      return paraCSV(primeira.registros, primeira.colunas, nomeArquivo.replace(/\.xlsx$/, '.csv'));
    }

    var XLSX = window.XLSX;
    var wb = XLSX.utils.book_new();

    abas.forEach(function (aba) {
      var m = matriz(aba.registros, aba.colunas);
      var dados = [];

      if (aba.tituloRelatorio) {
        dados.push([aba.tituloRelatorio]);
        dados.push(['Gerado em ' + U.dataHoraBR(new Date().toISOString()) +
                    ' · ' + m.linhas.length + ' registro(s)']);
        dados.push([]);
      }
      if (aba.resumo && aba.resumo.length) {
        aba.resumo.forEach(function (par) { dados.push([par[0], par[1]]); });
        dados.push([]);
      }

      dados.push(m.cabecalho);
      m.linhas.forEach(function (l) { dados.push(l); });

      var ws = XLSX.utils.aoa_to_sheet(dados);
      ws['!cols'] = aba.colunas.map(function (c) { return { wch: c.largura || 16 }; });

      // Congela o cabeçalho da tabela.
      var linhaCabecalho = dados.length - m.linhas.length - 1;
      ws['!freeze'] = { xSplit: 0, ySplit: linhaCabecalho + 1 };
      ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({
          s: { r: linhaCabecalho, c: 0 },
          e: { r: dados.length - 1, c: aba.colunas.length - 1 }
        })
      };

      XLSX.utils.book_append_sheet(wb, ws, aba.nome.slice(0, 31));
    });

    XLSX.writeFile(wb, nomeArquivo);
    SAGETI.ui.toast('success', 'Excel gerado', nomeArquivo);
  }

  /* ---------- Excel com cores (ExcelJS) -------------------------------------
     O SheetJS (community) usado em `paraExcel` não grava estilo de célula —
     por isso a exportação colorida usa a ExcelJS (carregada por CDN, mesmo
     esquema das outras bibliotecas: se faltar, cai para `paraExcel` sem cor).
     A cor de cada célula da coluna de status vem do mesmo mapa usado nos
     badges da tela (SAGETI.statusCores), então tela e planilha nunca divergem.
     ---------------------------------------------------------------------- */

  function temExcelJS() { return typeof window.ExcelJS !== 'undefined'; }

  /**
   * Gera um .xlsx de uma aba só, pintando o fundo da coluna de status.
   * @param {{nome, titulo, registros, colunas, colunaStatus, resumo?}} cfg
   *   colunaStatus: chave (em `colunas`) cujo valor é um status do mapa de cores.
   */
  function paraExcelColorido(cfg, nomeArquivo) {
    if (!temExcelJS() || !SAGETI.statusCores) {
      SAGETI.ui.toast('warn', 'Excel colorido indisponível', 'Biblioteca não carregada — exportando sem cores.');
      return paraExcel([{
        nome: cfg.nome, tituloRelatorio: cfg.titulo,
        registros: cfg.registros, colunas: cfg.colunas, resumo: cfg.resumo
      }], nomeArquivo);
    }

    var wb = new window.ExcelJS.Workbook();
    wb.creator = SAGETI.APP.nome;
    wb.created = new Date();

    var ws = wb.addWorksheet(cfg.nome.slice(0, 31));
    ws.columns = cfg.colunas.map(function (c) { return { key: c.chave, width: c.largura || 16 }; });

    if (cfg.titulo) {
      ws.addRow([cfg.titulo]).font = { bold: true, size: 13 };
      ws.addRow(['Gerado em ' + U.dataHoraBR(new Date().toISOString()) + ' · ' + cfg.registros.length + ' registro(s)']);
      ws.addRow([]);
    }
    (cfg.resumo || []).forEach(function (par) { ws.addRow([par[0], par[1]]); });
    if (cfg.resumo && cfg.resumo.length) ws.addRow([]);

    var linhaCabecalho = ws.rowCount + 1;
    var headerRow = ws.addRow(cfg.colunas.map(function (c) { return c.titulo; }));
    headerRow.font = { bold: true, color: { argb: 'FF52514E' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2EE' } };
    ws.autoFilter = { from: { row: linhaCabecalho, column: 1 }, to: { row: linhaCabecalho, column: cfg.colunas.length } };
    ws.views = [{ state: 'frozen', ySplit: linhaCabecalho }];

    var idxStatus = cfg.colunas.findIndex(function (c) { return c.chave === cfg.colunaStatus; });

    cfg.registros.forEach(function (registro) {
      var linha = linhaDe(registro, cfg.colunas);
      var row = ws.addRow(linha);
      if (idxStatus !== -1) {
        var valorStatus = registro[cfg.colunaStatus];
        if (valorStatus) {
          var cor = SAGETI.statusCores.paraExcelFill(valorStatus);
          var cel = row.getCell(idxStatus + 1);
          cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cor.fundoARGB } };
          cel.font = { color: { argb: cor.fonteARGB }, bold: true };
        }
      }
    });

    wb.xlsx.writeBuffer().then(function (buffer) {
      U.baixarArquivo(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        nomeArquivo
      );
      SAGETI.ui.toast('success', 'Excel gerado', nomeArquivo + ' · coluna de status colorida');
    }).catch(function (e) {
      SAGETI.ui.toast('error', 'Falha ao gerar o Excel', e.message);
    });
  }

  /* ---------- CSV (fallback) ------------------------------------------------ */

  function paraCSV(registros, colunas, nomeArquivo) {
    var m = matriz(registros, colunas);
    function cel(v) {
      var s = String(v == null ? '' : v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var linhas = [m.cabecalho.map(cel).join(';')];
    m.linhas.forEach(function (l) { linhas.push(l.map(cel).join(';')); });
    // BOM para o Excel abrir acentuação corretamente.
    U.baixarArquivo('﻿' + linhas.join('\r\n'), nomeArquivo, 'text/csv;charset=utf-8');
    SAGETI.ui.toast('success', 'CSV gerado', nomeArquivo);
  }

  /* ---------- PDF ------------------------------------------------------------ */

  function temJsPDF() {
    return !!(window.jspdf && window.jspdf.jsPDF);
  }

  /**
   * Gera um PDF paisagem com cabeçalho institucional e tabela paginada.
   * @param {{titulo, subtitulo, registros, colunas, resumo?}} cfg
   */
  function paraPDF(cfg, nomeArquivo) {
    if (!temJsPDF()) {
      SAGETI.ui.toast('warn', 'PDF indisponível', 'Biblioteca não carregada. Abrindo a janela de impressão — escolha "Salvar como PDF".');
      return imprimirFallback(cfg);
    }

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    var larguraPag = doc.internal.pageSize.getWidth();
    var m = matriz(cfg.registros, cfg.colunas);

    // Cabeçalho
    doc.setFillColor(20, 24, 31);
    doc.rect(0, 0, larguraPag, 54, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(SAGETI.APP.nome, 40, 26);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(190, 196, 204);
    doc.text(SAGETI.APP.descricao, 40, 39, { maxWidth: larguraPag - 240 });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(cfg.titulo || 'Relatório', larguraPag - 40, 26, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(190, 196, 204);
    doc.text(
      'Gerado em ' + U.dataHoraBR(new Date().toISOString()) + ' · ' + m.linhas.length + ' registro(s)',
      larguraPag - 40, 39, { align: 'right' }
    );

    var y = 74;

    if (cfg.subtitulo) {
      doc.setTextColor(82, 81, 78);
      doc.setFontSize(8.5);
      doc.text(cfg.subtitulo, 40, y, { maxWidth: larguraPag - 80 });
      y += 16;
    }

    if (cfg.resumo && cfg.resumo.length) {
      doc.setFontSize(8.5);
      var x = 40;
      cfg.resumo.forEach(function (par) {
        doc.setTextColor(137, 135, 129);
        doc.text(String(par[0]).toUpperCase(), x, y);
        doc.setTextColor(11, 11, 11);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(String(par[1]), x, y + 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        x += 118;
      });
      y += 30;
    }

    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        head: [m.cabecalho],
        body: m.linhas,
        startY: y,
        margin: { left: 28, right: 28, top: 66 },
        styles: {
          font: 'helvetica', fontSize: 6.8, cellPadding: 3.4,
          textColor: [11, 11, 11], lineColor: [225, 224, 217], lineWidth: 0.4,
          overflow: 'linebreak', valign: 'middle'
        },
        headStyles: {
          fillColor: [242, 242, 238], textColor: [82, 81, 78],
          fontStyle: 'bold', fontSize: 6.6, lineWidth: 0.4
        },
        alternateRowStyles: { fillColor: [252, 252, 251] },
        columnStyles: colunasPDF(cfg.colunas),
        didDrawPage: function (dados) {
          var pag = doc.internal.getNumberOfPages();
          doc.setFontSize(7.5);
          doc.setTextColor(137, 135, 129);
          doc.text(SAGETI.APP.nome + ' · ' + (cfg.titulo || 'Relatório'), 28, doc.internal.pageSize.getHeight() - 16);
          doc.text('Página ' + dados.pageNumber + ' de ' + pag,
            larguraPag - 28, doc.internal.pageSize.getHeight() - 16, { align: 'right' });
        }
      });
    } else {
      doc.setFontSize(9);
      doc.setTextColor(11, 11, 11);
      doc.text('Plugin de tabelas do PDF não carregado. Use a exportação em Excel.', 40, y + 20);
    }

    doc.save(nomeArquivo);
    SAGETI.ui.toast('success', 'PDF gerado', nomeArquivo);
  }

  /** Distribui a largura das colunas proporcionalmente ao peso declarado. */
  function colunasPDF(colunas) {
    var estilos = {};
    var total = colunas.reduce(function (s, c) { return s + (c.largura || 16); }, 0);
    colunas.forEach(function (c, i) {
      estilos[i] = { cellWidth: (c.largura || 16) / total * 786 };
    });
    return estilos;
  }

  /** Sem jsPDF: monta uma página limpa e chama a impressão do navegador. */
  function imprimirFallback(cfg) {
    var m = matriz(cfg.registros, cfg.colunas);
    var win = window.open('', '_blank');
    if (!win) {
      SAGETI.ui.toast('error', 'Bloqueado', 'O navegador bloqueou a janela. Libere pop-ups para este site.');
      return;
    }
    var html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
      '<title>' + U.esc(cfg.titulo || ('Relatório ' + SAGETI.APP.nome)) + '</title><style>' +
      'body{font:11px system-ui,sans-serif;margin:24px;color:#0b0b0b}' +
      'h1{font-size:16px;margin:0}h2{font-size:11px;font-weight:400;color:#52514e;margin:2px 0 16px}' +
      'table{width:100%;border-collapse:collapse;font-size:8.5px}' +
      'th{background:#f2f2ee;text-align:left;padding:5px;border:1px solid #e1e0d9;font-size:8px}' +
      'td{padding:5px;border:1px solid #e1e0d9;vertical-align:top}' +
      '@page{size:A4 landscape;margin:12mm}</style></head><body>' +
      '<h1>' + U.esc(SAGETI.APP.nome) + ' — ' + U.esc(cfg.titulo || 'Relatório') + '</h1>' +
      '<h2>Gerado em ' + U.dataHoraBR(new Date().toISOString()) + ' · ' + m.linhas.length + ' registro(s)</h2>' +
      '<table><thead><tr>' +
      m.cabecalho.map(function (h) { return '<th>' + U.esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      m.linhas.map(function (l) {
        return '<tr>' + l.map(function (c) { return '<td>' + U.esc(c) + '</td>'; }).join('') + '</tr>';
      }).join('') +
      '</tbody></table></body></html>';
    win.document.write(html);
    win.document.close();
    setTimeout(function () { win.print(); }, 400);
  }

  /* ---------- Atalhos de alto nível ----------------------------------------- */

  /* Mede pelo TOM de cada status, não pelo rótulo: as listas são editáveis,
     então um status novo criado pelo usuário já entra no resumo certo. */
  function resumoParaExport() {
    var r = SAGETI.store.resumo();
    return [
      ['Total no laboratório', r.totalNoLab],
      ['Disponíveis',         r.porTom.good || 0],
      ['Em manutenção',       r.porTom.warning || 0],
      ['Com defeito',         r.porTom.critical || 0],
      ['Para leilão',         r.porTom.serious || 0],
      ['Fora do laboratório', r.totalFora]
    ];
  }

  /** "Exportar Geral": inventário completo + histórico, em um único arquivo. */
  function exportarGeralExcel() {
    var equipamentos = SAGETI.util.ordenarPor(SAGETI.store.listarEquipamentos(), 'equipamento');
    var movs = SAGETI.store.listarMovimentacoes();
    var r = SAGETI.store.resumo();

    var porTipo = Object.keys(r.porTipo).sort().map(function (k) {
      return { equipamento: k, quantidade: r.porTipo[k] };
    });
    var porSetor = Object.keys(r.porSetor).sort().map(function (k) {
      return { setor: k, quantidade: r.porSetor[k] };
    });

    var marca = SAGETI.APP.nome + ' — ';
    paraExcel([
      {
        nome: 'Inventário',
        tituloRelatorio: marca + 'Inventário Geral',
        registros: equipamentos,
        colunas: COLS_ESTOQUE,
        resumo: resumoParaExport()
      },
      {
        nome: 'Movimentações',
        tituloRelatorio: marca + 'Histórico de Movimentações',
        registros: movs,
        colunas: COLS_MOV
      },
      {
        nome: 'Resumo por tipo',
        tituloRelatorio: marca + 'Estoque do laboratório por tipo de equipamento',
        registros: porTipo,
        colunas: [
          { chave: 'equipamento', titulo: 'Equipamento', largura: 28 },
          { chave: 'quantidade',  titulo: 'Quantidade',  largura: 14 }
        ]
      },
      {
        nome: 'Resumo por setor',
        tituloRelatorio: marca + 'Estoque do laboratório por setor de origem',
        registros: porSetor,
        colunas: [
          { chave: 'setor',      titulo: 'Setor / Unidade', largura: 46 },
          { chave: 'quantidade', titulo: 'Quantidade',      largura: 14 }
        ]
      }
    ], SAGETI.APP.nome + '_Inventario_Geral_' + U.carimbo() + '.xlsx');
  }

  function exportarGeralPDF() {
    var equipamentos = SAGETI.util.ordenarPor(SAGETI.store.listarEquipamentos(), 'equipamento');
    paraPDF({
      titulo: 'Inventário Geral',
      subtitulo: 'Todos os equipamentos cadastrados no laboratório, incluindo os já disponibilizados.',
      registros: equipamentos,
      colunas: COLS_ESTOQUE,
      resumo: resumoParaExport().slice(0, 5)
    }, SAGETI.APP.nome + '_Inventario_Geral_' + U.carimbo() + '.pdf');
  }

  SAGETI.exportar = {
    COLS_ESTOQUE: COLS_ESTOQUE,
    COLS_MOV: COLS_MOV,
    matriz: matriz,
    paraExcel: paraExcel,
    paraExcelColorido: paraExcelColorido,
    paraPDF: paraPDF,
    paraCSV: paraCSV,
    exportarGeralExcel: exportarGeralExcel,
    exportarGeralPDF: exportarGeralPDF,
    resumoParaExport: resumoParaExport
  };

})(window.SAGETI);
