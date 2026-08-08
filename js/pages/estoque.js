/* ==========================================================================
   SAGE-TI — Aba: Estoque Laboratório
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  var UI = SAGETI.ui;
  var U = SAGETI.util;

  var L = SAGETI.listas;
  var POR_PAGINA = 25;

  // Estado da view (persiste enquanto a aba está montada)
  var filtros = {
    busca: '', status: '', equipamento: '', modelo: '',
    ttr: '', setor: '', predio: '', tecnico: '', local: 'lab'
  };
  var ordem = { campo: 'atualizadoEm', direcao: 'desc' };
  var pagina = 1;

  /* ---------- Filtro -------------------------------------------------------- */

  function filtrar() {
    var lista = SAGETI.store.listarEquipamentos();

    // Presença física vem do campo, não do rótulo do status.
    if (filtros.local === 'lab') {
      lista = lista.filter(function (e) { return e.noLaboratorio; });
    } else if (filtros.local === 'fora') {
      lista = lista.filter(function (e) { return !e.noLaboratorio; });
    }

    if (filtros.status) lista = lista.filter(function (e) { return e.status === filtros.status; });
    if (filtros.equipamento) lista = lista.filter(function (e) { return e.equipamento === filtros.equipamento; });
    if (filtros.modelo) lista = lista.filter(function (e) { return e.modelo === filtros.modelo; });
    if (filtros.ttr) lista = lista.filter(function (e) { return e.ttr === filtros.ttr; });
    if (filtros.tecnico) lista = lista.filter(function (e) { return e.tecnico === filtros.tecnico; });
    if (filtros.predio) {
      lista = lista.filter(function (e) {
        return e.predioOrigem === filtros.predio || e.predioDestino === filtros.predio;
      });
    }
    if (filtros.setor) {
      lista = lista.filter(function (e) {
        return e.setorOrigem === filtros.setor || e.setorDestino === filtros.setor;
      });
    }

    if (filtros.busca) {
      var termo = U.slug(filtros.busca);
      lista = lista.filter(function (e) {
        return U.slug([
          e.tomboNovo, e.tomboAntigo, e.equipamento, e.modelo,
          e.chamado, e.predioOrigem, e.setorOrigem, e.predioDestino,
          e.setorDestino, e.servicoSolicitado, e.tecnico, e.status
        ].join(' ')).indexOf(termo) > -1;
      });
    }

    return U.ordenarPor(lista, ordem.campo, ordem.direcao);
  }

  /* ---------- Esqueleto ----------------------------------------------------- */

  function esqueleto() {
    return '' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-head__title">Estoque Laboratório</h1>' +
          '<p class="page-head__sub">Equipamentos sob guarda do laboratório, com situação atual</p>' +
        '</div>' +
        '<div class="page-head__spacer"></div>' +
        '<div class="btn-group">' +
          '<button class="btn btn--outline btn--sm" data-acao="importar">' +
            UI.icone('planilha', 14) + '<span>Importar</span></button>' +
          '<button class="btn btn--outline btn--sm" data-acao="excel">' +
            UI.icone('excel', 14) + '<span>Excel</span></button>' +
          '<button class="btn btn--outline btn--sm" data-acao="pdf">' +
            UI.icone('pdf', 14) + '<span>PDF</span></button>' +
          '<button class="btn btn--primary" data-acao="novo">' +
            UI.icone('plus', 16) + '<span>Adicionar Equipamento</span></button>' +
        '</div>' +
      '</div>' +

      // Todos os filtros leem das listas editáveis.
      '<div class="filter-bar">' +
        '<div class="field field--grow">' +
          '<label for="f-busca">Buscar</label>' +
          '<div class="field__linha">' +
            '<input class="input" type="search" id="f-busca" placeholder="Tombo, modelo, chamado, prédio, setor…">' +
            SAGETI.scanner.botaoHTML('f-busca', 'Ler tombo pela câmera') +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label for="f-local">Localização</label>' +
          '<select class="select" id="f-local">' +
            '<option value="lab">No laboratório</option>' +
            '<option value="fora">Fora do laboratório</option>' +
            '<option value="todos">Todos</option>' +
          '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="f-status">Status</label>' +
          '<select class="select" id="f-status">' + UI.opcoes(L.statusTodos(), '', 'Todos os status') + '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="f-equip">Equipamento</label>' +
          '<select class="select" id="f-equip">' + UI.opcoes(L.get('equipamentos'), '', 'Todos') + '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="f-modelo">Modelo</label>' +
          '<select class="select" id="f-modelo">' + UI.opcoes(L.get('modelos'), '', 'Todos') + '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="f-predio">Prédio</label>' +
          '<select class="select" id="f-predio">' + UI.opcoes(L.get('predios'), '', 'Todos') + '</select>' +
        '</div>' +
        '<div class="field field--grow">' +
          '<label for="f-setor">Setor / Unidade</label>' +
          '<select class="select" id="f-setor">' + UI.opcoes(L.get('setores'), '', 'Todos') + '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="f-tecnico">Técnico</label>' +
          '<select class="select" id="f-tecnico">' + UI.opcoes(L.get('tecnicos'), '', 'Todos') + '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="f-ttr">TTR</label>' +
          '<select class="select" id="f-ttr">' +
            UI.opcoes(L.ttrDe('entrada').concat(L.ttrDe('saida').filter(function (t) {
              return L.ttrDe('entrada').indexOf(t) === -1;
            })), '', 'Todos') + '</select>' +
        '</div>' +
        '<button class="btn btn--ghost btn--sm" data-acao="limpar-filtros" style="margin-bottom:1px">' +
          UI.icone('limpar', 14) + '<span>Limpar</span></button>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card__body card__body--flush">' +
          '<div class="table-wrap" id="estoque-tabela"></div>' +
        '</div>' +
        '<div class="table-foot" id="estoque-rodape"></div>' +
      '</div>';
  }

  /* ---------- Tabela -------------------------------------------------------- */

  var COLUNAS = [
    { chave: 'equipamento',  titulo: 'Equipamento',  ordenavel: true },
    { chave: 'modelo',       titulo: 'Modelo',       ordenavel: true },
    { chave: 'tomboNovo',    titulo: 'Tombo Novo',   ordenavel: true },
    { chave: 'tomboAntigo',  titulo: 'Tombo Antigo', ordenavel: true },
    { chave: 'status',       titulo: 'Status',       ordenavel: true },
    { chave: 'predioOrigem', titulo: 'Prédio',       ordenavel: true },
    { chave: 'setorOrigem',  titulo: 'Setor / Unidade', ordenavel: true },
    { chave: 'chamado',      titulo: 'Chamado',      ordenavel: true },
    { chave: 'dataEntrada',  titulo: 'Entrada',      ordenavel: true },
    { chave: 'tecnico',      titulo: 'Técnico',      ordenavel: true },
    { chave: 'ttr',          titulo: 'TTR',          ordenavel: true }
  ];

  function desenharTabela(container) {
    var lista = filtrar();
    var totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    if (pagina > totalPaginas) pagina = totalPaginas;
    var fatia = lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

    var alvo = container.querySelector('#estoque-tabela');

    if (!lista.length) {
      alvo.innerHTML = UI.estadoVazio(
        'Nenhum equipamento encontrado',
        temFiltroAtivo()
          ? 'Ajuste ou limpe os filtros para ver mais resultados.'
          : 'Comece adicionando um equipamento ou registrando uma entrada.',
        '<button class="btn btn--primary btn--sm" data-acao="novo" style="margin-top:6px">' +
          UI.icone('plus', 14) + '<span>Adicionar Equipamento</span></button>'
      );
      container.querySelector('#estoque-rodape').innerHTML =
        '<span>0 equipamentos</span><span class="spacer"></span>';
      return;
    }

    var html = '<table class="table"><thead><tr>';
    COLUNAS.forEach(function (c) {
      var ativo = ordem.campo === c.chave;
      html += '<th' + (c.ordenavel ? ' class="sortable' + (ativo ? ' is-sorted' : '') +
        '" data-ordenar="' + c.chave + '" role="button" tabindex="0"' +
        ' aria-sort="' + (ativo ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none') + '"' : '') + '>' +
        U.esc(c.titulo) +
        (c.ordenavel ? '<span class="sort-ind">' + (ativo ? (ordem.direcao === 'asc' ? '▲' : '▼') : '↕') + '</span>' : '') +
        '</th>';
    });
    html += '<th class="col-actions">Ações</th></tr></thead><tbody>';

    fatia.forEach(function (e) {
      html += '<tr data-id="' + U.esc(e.id) + '">' +
        '<td class="strong">' + U.esc(e.equipamento || '—') + '</td>' +
        '<td>' + U.esc(e.modelo || '—') + '</td>' +
        '<td class="num tombo">' + (e.tomboNovo ? U.esc(e.tomboNovo) : '<span class="muted">—</span>') + '</td>' +
        '<td class="num tombo">' + (e.tomboAntigo ? U.esc(e.tomboAntigo) : '<span class="muted">—</span>') + '</td>' +
        '<td>' + UI.chipStatus(e.status) + '</td>' +
        '<td>' + (!e.noLaboratorio
                    ? '<span class="muted">→ ' + U.esc(e.predioDestino || '—') + '</span>'
                    : U.esc(e.predioOrigem || '—')) + '</td>' +
        '<td>' + (!e.noLaboratorio
                    ? '<span class="muted">→ ' + U.esc(e.setorDestino || '—') + '</span>'
                    : U.esc(e.setorOrigem || '—')) + '</td>' +
        '<td class="num">' + (e.chamado ? U.esc(e.chamado) : '<span class="muted">—</span>') + '</td>' +
        '<td class="num">' + U.dataBR(e.dataEntrada) + '</td>' +
        '<td>' + (e.tecnico ? U.esc(e.tecnico) : '<span class="muted">—</span>') + '</td>' +
        '<td>' + UI.tagTTR(e.ttr) + '</td>' +
        '<td class="col-actions">' +
          '<button class="icon-btn" data-ver="' + U.esc(e.id) + '" title="Ver detalhes" aria-label="Ver detalhes">' +
            UI.icone('olho', 15) + '</button> ' +
          (SAGETI.auth.permissao('podeEditar')
            ? '<button class="icon-btn" data-editar="' + U.esc(e.id) + '" title="Editar" aria-label="Editar">' +
              UI.icone('editar', 15) + '</button> ' : '') +
          (SAGETI.auth.permissao('podeExcluir')
            ? '<button class="icon-btn" data-excluir="' + U.esc(e.id) + '" title="Excluir" aria-label="Excluir">' +
              UI.icone('lixeira', 15) + '</button>' : '') +
        '</td>' +
      '</tr>';
    });

    html += '</tbody></table>';
    alvo.innerHTML = html;

    var inicio = (pagina - 1) * POR_PAGINA + 1;
    var fim = Math.min(pagina * POR_PAGINA, lista.length);
    container.querySelector('#estoque-rodape').innerHTML =
      '<span>Exibindo <strong>' + inicio + '–' + fim + '</strong> de <strong>' +
        U.numero(lista.length) + '</strong> equipamento(s)</span>' +
      '<span class="spacer"></span>' +
      UI.paginador(pagina, totalPaginas);
  }

  function temFiltroAtivo() {
    return !!(filtros.busca || filtros.status || filtros.equipamento || filtros.modelo ||
              filtros.ttr || filtros.setor || filtros.predio || filtros.tecnico ||
              filtros.local !== 'lab');
  }

  /* ---------- Formulário (criar / editar) ------------------------------------ */

  /**
   * Status oferecidos na aba Estoque: os marcados para o contexto 'estoque'
   * mais o valor atual do registro, para a edição de um item cujo status veio
   * de uma entrada (ou foi removido da lista) não trocar o valor sem avisar.
   */
  function statusDisponiveis(statusAtual) {
    var lista = L.statusDe('estoque');
    if (statusAtual && lista.indexOf(statusAtual) === -1) lista = lista.concat([statusAtual]);
    return lista;
  }

  function formHTML(eq) {
    var ed = eq || {};
    return '' +
      '<form id="form-eq" novalidate>' +
        '<div class="form-grid">' +

          '<div class="field">' +
            '<label for="eq-equipamento">Categoria / Equipamento <span class="req">*</span></label>' +
            UI.selectGerenciavel({
              id: 'eq-equipamento', name: 'equipamento', lista: 'equipamentos',
              valor: ed.equipamento, obrigatorio: true
            }) +
            '<span class="field__error">Selecione o equipamento.</span>' +
          '</div>' +

          '<div class="field">' +
            '<label for="eq-modelo">Modelo <span class="req">*</span></label>' +
            '<div class="field__linha">' +
              '<select class="select" id="eq-modelo" name="modelo" data-obrigatorio></select>' +
              (SAGETI.auth.permissao('podeGerenciarListas')
                ? '<button type="button" class="field__gerenciar" data-gerenciar-lista="modelos" ' +
                  'data-alvo-campo="eq-modelo" title="Gerenciar modelos" ' +
                  'aria-label="Gerenciar modelos">' + UI.icone('engrenagem', 15) + '</button>'
                : '') +
            '</div>' +
            '<span class="field__help">A lista é filtrada pela categoria escolhida.</span>' +
            '<span class="field__error">Selecione o modelo.</span>' +
          '</div>' +

          '<div class="field">' +
            '<label for="eq-tombo-novo">Tombo Novo</label>' +
            '<input class="input" type="text" id="eq-tombo-novo" name="tomboNovo" inputmode="numeric" ' +
              'value="' + U.esc(ed.tomboNovo || '') + '" placeholder="Ex.: 045112">' +
            '<span class="field__error">Informe o tombo novo ou o antigo.</span>' +
          '</div>' +

          '<div class="field">' +
            '<label for="eq-tombo-antigo">Tombo Antigo</label>' +
            '<input class="input" type="text" id="eq-tombo-antigo" name="tomboAntigo" inputmode="numeric" ' +
              'value="' + U.esc(ed.tomboAntigo || '') + '" placeholder="Ex.: 11233">' +
          '</div>' +

          '<div class="field">' +
            '<label for="eq-status">Status <span class="req">*</span></label>' +
            UI.selectGerenciavel({
              id: 'eq-status', name: 'status', lista: 'status',
              opcoesLista: statusDisponiveis(ed.status),
              valor: ed.status || 'Estoque', obrigatorio: true, placeholder: false
            }) +
            '<span class="field__help" id="eq-desc-status"></span>' +
          '</div>' +

          '<div class="field">' +
            '<label for="eq-ttr">TTR</label>' +
            UI.selectGerenciavel({
              id: 'eq-ttr', name: 'ttr', lista: 'ttrEntrada',
              valor: ed.ttr || 'Pendente', placeholder: 'Selecione…'
            }) +
          '</div>' +

          '<div class="field">' +
            '<label for="eq-chamado">Chamado</label>' +
            '<input class="input" type="text" id="eq-chamado" name="chamado" ' +
              'value="' + U.esc(ed.chamado || '') + '" placeholder="Ex.: CH-10450">' +
          '</div>' +

          '<div class="field">' +
            '<label for="eq-data">Data de entrada</label>' +
            '<input class="input" type="date" id="eq-data" name="dataEntrada" ' +
              'value="' + U.esc(ed.dataEntrada || U.hoje()) + '">' +
          '</div>' +

          '<div class="field">' +
            '<label for="eq-predio">Prédio de origem</label>' +
            UI.selectGerenciavel({
              id: 'eq-predio', name: 'predioOrigem', lista: 'predios', valor: ed.predioOrigem
            }) +
          '</div>' +

          '<div class="field">' +
            '<label for="eq-setor">Setor / Unidade</label>' +
            UI.selectGerenciavel({
              id: 'eq-setor', name: 'setorOrigem', lista: 'setores', valor: ed.setorOrigem
            }) +
          '</div>' +

          '<div class="field">' +
            '<label for="eq-tecnico">Técnico responsável</label>' +
            UI.selectGerenciavel({
              id: 'eq-tecnico', name: 'tecnico', lista: 'tecnicos',
              valor: ed.tecnico, placeholder: 'Não informado'
            }) +
          '</div>' +

          '<div class="field field--full">' +
            '<label for="eq-servico">Serviço solicitado</label>' +
            '<textarea class="textarea" id="eq-servico" name="servicoSolicitado" ' +
              'placeholder="Descreva o serviço ou a observação técnica…">' +
              U.esc(ed.servicoSolicitado || '') + '</textarea>' +
          '</div>' +

        '</div>' +
      '</form>';
  }

  function abrirForm(container, eq) {
    var edicao = !!eq;
    var ref = UI.modal({
      titulo: edicao ? 'Editar equipamento' : 'Adicionar equipamento',
      subtitulo: edicao
        ? 'Alterações ficam registradas no histórico de movimentações'
        : 'O item entra direto no estoque do laboratório',
      corpo: formHTML(eq),
      botoes: [
        { texto: 'Cancelar', classe: 'btn--ghost' },
        {
          texto: edicao ? 'Salvar alterações' : 'Adicionar',
          classe: 'btn--primary',
          icone: 'check',
          acao: function (caixa) { return salvar(container, caixa, eq); }
        }
      ]
    });

    UI.ligarEquipamentoModelo(
      ref.el.querySelector('#eq-equipamento'),
      ref.el.querySelector('#eq-modelo'),
      eq && eq.modelo
    );

    // Explica o efeito do status escolhido sobre a contagem do estoque.
    var selStatus = ref.el.querySelector('#eq-status');
    var desc = ref.el.querySelector('#eq-desc-status');
    function explicar() {
      var meta = L.statusMeta(selStatus.value);
      desc.textContent = (meta.desc ? meta.desc + ' · ' : '') +
        (meta.noLab ? 'conta no estoque do laboratório' : 'não conta no estoque');
    }
    selStatus.addEventListener('change', explicar);
    explicar();
  }

  /**
   * O modal fecha sozinho quando `acao` NÃO devolve `false` (ver UI.modal).
   * Como salvar agora é assíncrono, esta função sempre devolve `false` na
   * hora — e fecha o modal ela mesma, manualmente, quando o Firestore confirma.
   */
  function salvar(container, caixa, eq) {
    var form = caixa.querySelector('#form-eq');
    if (!UI.validarForm(form)) {
      UI.toast('warn', 'Campos obrigatórios', 'Preencha os campos destacados.');
      return false;
    }

    var dados = UI.dadosForm(form);

    if (!dados.tomboNovo && !dados.tomboAntigo) {
      UI.marcarErro(caixa.querySelector('#eq-tombo-novo'), 'Informe o tombo novo ou o antigo.');
      UI.toast('warn', 'Tombo obrigatório', 'O equipamento precisa de ao menos um número de tombo.');
      return false;
    }

    var promessa = eq
      ? SAGETI.store.atualizarEquipamento(eq.id, dados)
      : SAGETI.store.criarEquipamento(dados);

    promessa.then(function (r) {
      if (!r.ok) {
        UI.toast('error', 'Não foi possível salvar', r.erro);
        return;
      }
      UI.fecharModal();
      UI.toast('success',
        eq ? 'Equipamento atualizado' : 'Equipamento adicionado',
        (r.equipamento.equipamento || '') + ' · tombo ' +
        (r.equipamento.tomboNovo || r.equipamento.tomboAntigo));
    });

    return false;
  }

  /* ---------- Detalhes ------------------------------------------------------- */

  function abrirDetalhes(eq) {
    function linha(k, v) {
      return '<div class="result-preview__row"><span class="result-preview__k">' + U.esc(k) +
        '</span><span class="result-preview__v">' + (v || '<span class="muted">—</span>') + '</span></div>';
    }

    var historico = SAGETI.store.listarMovimentacoes()
      .filter(function (m) { return m.equipamentoId === eq.id; })
      .slice(0, 8);

    var corpo =
      '<div class="result-preview" style="margin-bottom:16px">' +
        linha('Equipamento', U.esc(eq.equipamento)) +
        linha('Modelo', U.esc(eq.modelo)) +
        linha('Tombo novo', U.esc(eq.tomboNovo)) +
        linha('Tombo antigo', U.esc(eq.tomboAntigo)) +
        linha('Status', UI.chipStatus(eq.status)) +
        linha('Localização', eq.noLaboratorio
          ? '<span class="tag tag--ok">No laboratório</span>'
          : '<span class="tag">Fora do laboratório</span>') +
        linha('TTR', UI.tagTTR(eq.ttr)) +
        linha('Técnico responsável', U.esc(eq.tecnico)) +
        linha('Chamado', U.esc(eq.chamado)) +
        linha('Entrada', U.dataBR(eq.dataEntrada)) +
        linha('Origem', U.esc([eq.predioOrigem, eq.setorOrigem].filter(Boolean).join(' · '))) +
        (!eq.noLaboratorio
          ? linha('Saída', U.dataBR(eq.dataSaida)) +
            linha('Destino', U.esc([eq.predioDestino, eq.setorDestino].filter(Boolean).join(' · ')))
          : '') +
        linha('Serviço solicitado', U.esc(eq.servicoSolicitado)) +
        linha('Última atualização', U.dataHoraBR(eq.atualizadoEm)) +
      '</div>' +
      '<div class="section-title" style="margin-top:0">Histórico deste equipamento</div>' +
      (historico.length
        ? '<div class="table-wrap"><table class="chart-table"><thead><tr>' +
          '<th>Data</th><th>Movimentação</th><th>Situação</th><th>Local</th></tr></thead><tbody>' +
          historico.map(function (m) {
            return '<tr><td>' + U.dataBR(m.data) + '</td>' +
              '<td>' + UI.chipTipoMov(m.tipo) + '</td>' +
              '<td>' + U.esc(m.statusResultante || '—') + '</td>' +
              '<td style="text-align:left">' + U.esc(m.predio || '—') + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<p style="font-size:12.5px;color:var(--text-muted)">Sem movimentações registradas.</p>');

    UI.modal({
      titulo: eq.equipamento + ' — ' + eq.modelo,
      subtitulo: 'Tombo ' + (eq.tomboNovo || eq.tomboAntigo || 'não informado'),
      corpo: corpo,
      botoes: [{ texto: 'Fechar', classe: 'btn--ghost' }]
    });
  }

  /* ---------- Exportação ------------------------------------------------------ */

  function rotuloFiltro() {
    var partes = [];
    if (filtros.local === 'lab') partes.push('Somente itens no laboratório');
    if (filtros.local === 'fora') partes.push('Somente itens fora do laboratório');
    if (filtros.status) partes.push('Status: ' + filtros.status);
    if (filtros.equipamento) partes.push('Equipamento: ' + filtros.equipamento);
    if (filtros.modelo) partes.push('Modelo: ' + filtros.modelo);
    if (filtros.predio) partes.push('Prédio: ' + filtros.predio);
    if (filtros.setor) partes.push('Setor: ' + filtros.setor);
    if (filtros.tecnico) partes.push('Técnico: ' + filtros.tecnico);
    if (filtros.ttr) partes.push('TTR: ' + filtros.ttr);
    if (filtros.busca) partes.push('Busca: "' + filtros.busca + '"');
    return partes.length ? partes.join(' · ') : 'Sem filtros aplicados';
  }

  function exportar(formato) {
    var lista = filtrar();
    if (!lista.length) {
      UI.toast('warn', 'Nada a exportar', 'Nenhum equipamento corresponde aos filtros atuais.');
      return;
    }
    var nome = SAGETI.APP.nome + '_Estoque_' + U.carimbo();
    if (formato === 'excel') {
      var cfgExcel = {
        nome: 'Estoque',
        titulo: SAGETI.APP.nome + ' — Estoque Laboratório',
        registros: lista,
        colunas: SAGETI.exportar.COLS_ESTOQUE,
        colunaStatus: 'status',
        resumo: [['Filtros', rotuloFiltro()], ['Registros', lista.length]]
      };
      if (SAGETI.exportar.paraExcelColorido) {
        SAGETI.exportar.paraExcelColorido(cfgExcel, nome + '.xlsx');
      } else {
        SAGETI.exportar.paraExcel([{
          nome: cfgExcel.nome, tituloRelatorio: cfgExcel.titulo,
          registros: cfgExcel.registros, colunas: cfgExcel.colunas, resumo: cfgExcel.resumo
        }], nome + '.xlsx');
      }
    } else {
      SAGETI.exportar.paraPDF({
        titulo: 'Estoque Laboratório',
        subtitulo: rotuloFiltro(),
        registros: lista,
        colunas: SAGETI.exportar.COLS_ESTOQUE
      }, nome + '.pdf');
    }
  }

  /* ---------- Montagem -------------------------------------------------------- */

  function montar(container) {
    container.innerHTML = esqueleto();
    SAGETI.scanner.ligarBotoes(container);

    var CAMPOS_FILTRO = [
      ['#f-local', 'local'], ['#f-status', 'status'], ['#f-equip', 'equipamento'],
      ['#f-modelo', 'modelo'], ['#f-predio', 'predio'], ['#f-setor', 'setor'],
      ['#f-tecnico', 'tecnico'], ['#f-ttr', 'ttr']
    ];

    function sincronizarFiltros() {
      container.querySelector('#f-busca').value = filtros.busca;
      CAMPOS_FILTRO.forEach(function (par) {
        var el = container.querySelector(par[0]);
        if (el) el.value = filtros[par[1]];
      });
    }
    sincronizarFiltros();

    var redesenhar = function () { desenharTabela(container); };

    var buscaDebounce = U.debounce(function (v) {
      filtros.busca = v; pagina = 1; redesenhar();
    }, 200);

    container.querySelector('#f-busca').addEventListener('input', function () {
      buscaDebounce(this.value);
    });

    CAMPOS_FILTRO.forEach(function (par) {
      var el = container.querySelector(par[0]);
      if (!el) return;
      el.addEventListener('change', function () {
        filtros[par[1]] = this.value;
        pagina = 1;
        redesenhar();
      });
    });

    container.addEventListener('click', function (e) {
      var alvo;

      if ((alvo = e.target.closest('[data-acao="novo"]'))) {
        if (!SAGETI.auth.permissao('podeEditar')) {
          return UI.toast('warn', 'Sem permissão', 'Seu perfil é somente de consulta.');
        }
        return abrirForm(container);
      }

      if ((alvo = e.target.closest('[data-acao="limpar-filtros"]'))) {
        filtros = {
          busca: '', status: '', equipamento: '', modelo: '',
          ttr: '', setor: '', predio: '', tecnico: '', local: 'lab'
        };
        pagina = 1;
        sincronizarFiltros();
        return redesenhar();
      }

      if ((alvo = e.target.closest('[data-acao="importar"]'))) return SAGETI.importar.abrir();
      if ((alvo = e.target.closest('[data-acao="excel"]'))) return exportar('excel');
      if ((alvo = e.target.closest('[data-acao="pdf"]')))   return exportar('pdf');

      if ((alvo = e.target.closest('[data-ver]'))) {
        var eqV = SAGETI.store.acharPorId(alvo.getAttribute('data-ver'));
        if (eqV) abrirDetalhes(eqV);
        return;
      }

      if ((alvo = e.target.closest('[data-editar]'))) {
        var eqE = SAGETI.store.acharPorId(alvo.getAttribute('data-editar'));
        if (eqE) abrirForm(container, eqE);
        return;
      }

      if ((alvo = e.target.closest('[data-excluir]'))) {
        var id = alvo.getAttribute('data-excluir');
        var eqX = SAGETI.store.acharPorId(id);
        if (!eqX) return;
        UI.confirmar({
          titulo: 'Excluir equipamento',
          mensagem: 'Remover ' + eqX.equipamento + ' — ' + eqX.modelo + ' (tombo ' +
                    (eqX.tomboNovo || eqX.tomboAntigo) + ')? A exclusão fica registrada no histórico.',
          confirmar: 'Excluir',
          perigo: true
        }).then(function (ok) {
          if (!ok) return;
          SAGETI.store.excluirEquipamento(id).then(function (r) {
            if (r.ok) UI.toast('success', 'Equipamento excluído', 'Registro removido do estoque.');
            else UI.toast('error', 'Falha ao excluir', r.erro);
          });
        });
        return;
      }

      if ((alvo = e.target.closest('[data-ordenar]'))) {
        var campo = alvo.getAttribute('data-ordenar');
        if (ordem.campo === campo) ordem.direcao = ordem.direcao === 'asc' ? 'desc' : 'asc';
        else { ordem.campo = campo; ordem.direcao = 'asc'; }
        return redesenhar();
      }

      if ((alvo = e.target.closest('[data-pagina]'))) {
        var p = Number(alvo.getAttribute('data-pagina'));
        if (p >= 1) { pagina = p; redesenhar(); }
      }
    });

    // Teclado nos cabeçalhos ordenáveis
    container.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var th = e.target.closest('[data-ordenar]');
      if (!th) return;
      e.preventDefault();
      th.click();
    });

    desenharTabela(container);

    /** Repinta os selects dos filtros quando as listas mudam. */
    function repintarFiltros() {
      var fontes = {
        '#f-status': L.statusTodos(),
        '#f-equip': L.get('equipamentos'),
        '#f-modelo': L.get('modelos'),
        '#f-predio': L.get('predios'),
        '#f-setor': L.get('setores'),
        '#f-tecnico': L.get('tecnicos')
      };
      Object.keys(fontes).forEach(function (sel) {
        var el = container.querySelector(sel);
        if (!el) return;
        var atual = el.value;
        el.innerHTML = UI.opcoes(fontes[sel], atual, 'Todos');
        el.value = atual;
        if (el.value !== atual) {
          // A opção filtrada deixou de existir: volta para "Todos".
          el.value = '';
          var chave = (CAMPOS_FILTRO.find(function (p) { return p[0] === sel; }) || [])[1];
          if (chave) filtros[chave] = '';
        }
      });
      desenharTabela(container);
    }

    // Tempo real: entradas, saídas e mudanças de lista repintam esta tela.
    var cancelar = SAGETI.store.assinar(function (ev) {
      if (ev && ev.tipo === 'listas') return repintarFiltros();
      desenharTabela(container);
    });

    return { destruir: cancelar };
  }

  SAGETI.pages = SAGETI.pages || {};
  SAGETI.pages.estoque = {
    titulo: 'Estoque Laboratório',
    subtitulo: 'Equipamentos sob guarda do laboratório',
    montar: montar
  };

})(window.SAGETI);
