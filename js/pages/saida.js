/* ==========================================================================
   SAGE-TI — Aba: Saída de Equipamentos
   --------------------------------------------------------------------------
   Salvar aqui retira o item do estoque físico: `noLaboratorio` vira false e o
   destino é preenchido. O registro não é apagado, para preservar a
   rastreabilidade patrimonial — mas some da aba Estoque (filtro "No
   laboratório") e dos indicadores da Dashboard no mesmo instante.
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  var UI = SAGETI.ui;
  var U = SAGETI.util;
  var L = SAGETI.listas;

  function esqueleto() {
    return '' +
      '<div class="page-head">' +
        '<div>' +
          '<h1 class="page-head__title">Saída de Equipamentos</h1>' +
          '<p class="page-head__sub">Registre o envio de itens do laboratório para as unidades</p>' +
        '</div>' +
      '</div>' +

      '<div class="alert alert--info">' + UI.icone('info', 17) +
        '<span>Informe o <strong>tombo</strong> e o sistema localiza o equipamento no estoque. ' +
        'Ao salvar, ele sai do laboratório e os indicadores são recalculados na hora.</span>' +
      '</div>' +

      '<div class="card" style="margin-bottom:18px">' +
        '<div class="card__head">' +
          '<div>' +
            '<div class="card__title">Dados da saída</div>' +
            '<div class="card__sub">Campos com <span style="color:var(--status-critical)">*</span> ' +
              'são obrigatórios · o ícone ⚙ ao lado de um campo abre o gerenciador da lista</div>' +
          '</div>' +
        '</div>' +
        '<div class="card__body">' +
          '<form id="form-saida" novalidate>' +
            '<div class="form-grid">' +

              '<div class="field">' +
                '<label for="sa-data">Data de saída <span class="req">*</span></label>' +
                '<input class="input" type="date" id="sa-data" name="dataSaida" ' +
                  'value="' + U.hoje() + '" data-obrigatorio>' +
                '<span class="field__error">Informe a data de saída.</span>' +
              '</div>' +

              '<div class="field">' +
                '<label for="sa-chamado">Chamado</label>' +
                '<input class="input" type="text" id="sa-chamado" name="chamado" placeholder="Ex.: CH-10488">' +
              '</div>' +

              '<div class="field">' +
                '<label for="sa-tombo-novo">Tombo Novo</label>' +
                '<div class="field__linha">' +
                  '<input class="input" type="text" id="sa-tombo-novo" name="tomboNovo" ' +
                    'inputmode="numeric" placeholder="Digite para localizar…" ' +
                    'list="lista-tombos" autocomplete="off">' +
                  SAGETI.scanner.botaoHTML('sa-tombo-novo', 'Ler tombo pela câmera') +
                '</div>' +
                '<datalist id="lista-tombos"></datalist>' +
                '<span class="field__error">Informe o tombo novo ou o antigo.</span>' +
              '</div>' +

              '<div class="field">' +
                '<label for="sa-tombo-antigo">Tombo Antigo</label>' +
                '<div class="field__linha">' +
                  '<input class="input" type="text" id="sa-tombo-antigo" name="tomboAntigo" ' +
                    'inputmode="numeric" placeholder="Ex.: 11233" autocomplete="off">' +
                  SAGETI.scanner.botaoHTML('sa-tombo-antigo', 'Ler tombo pela câmera') +
                '</div>' +
              '</div>' +

              '<div class="field field--full" id="sa-achado-wrap" style="display:none">' +
                '<div class="result-preview" id="sa-achado"></div>' +
              '</div>' +

              '<div class="field">' +
                '<label for="sa-equipamento">Equipamento <span class="req">*</span></label>' +
                UI.selectGerenciavel({
                  id: 'sa-equipamento', name: 'equipamento',
                  lista: 'equipamentos', obrigatorio: true
                }) +
                '<span class="field__error">Selecione o equipamento.</span>' +
              '</div>' +

              '<div class="field">' +
                '<label for="sa-modelo">Modelo <span class="req">*</span></label>' +
                '<div class="field__linha">' +
                  '<select class="select" id="sa-modelo" name="modelo" data-obrigatorio></select>' +
                  (SAGETI.auth.permissao('podeGerenciarListas')
                    ? '<button type="button" class="field__gerenciar" data-gerenciar-lista="modelos" ' +
                      'data-alvo-campo="sa-modelo" title="Gerenciar modelos" ' +
                      'aria-label="Gerenciar modelos">' + UI.icone('engrenagem', 15) + '</button>'
                    : '') +
                '</div>' +
                '<span class="field__error">Selecione o modelo.</span>' +
              '</div>' +

              '<div class="field">' +
                '<label for="sa-status">Status <span class="req">*</span></label>' +
                UI.selectGerenciavel({
                  id: 'sa-status', name: 'status', lista: 'status',
                  opcoesLista: L.statusDe('saida'), valor: 'Solicitação',
                  obrigatorio: true, placeholder: 'Selecione…'
                }) +
                '<span class="field__help" id="sa-desc-status"></span>' +
                '<span class="field__error">Selecione o motivo da saída.</span>' +
              '</div>' +

              '<div class="field">' +
                '<label for="sa-ttr">TTR <span class="req">*</span></label>' +
                UI.selectGerenciavel({
                  id: 'sa-ttr', name: 'ttr', lista: 'ttrSaida',
                  valor: 'Pendente', obrigatorio: true, placeholder: 'Selecione…'
                }) +
                '<span class="field__error">Informe a situação do TTR.</span>' +
              '</div>' +

              '<div class="field">' +
                '<label for="sa-predio">Prédio de destino <span class="req">*</span></label>' +
                UI.selectGerenciavel({
                  id: 'sa-predio', name: 'predioDestino', lista: 'predios', obrigatorio: true
                }) +
                '<span class="field__error">Selecione o prédio de destino.</span>' +
              '</div>' +

              '<div class="field">' +
                '<label for="sa-setor">Setor / Unidade de destino <span class="req">*</span></label>' +
                UI.selectGerenciavel({
                  id: 'sa-setor', name: 'setorDestino', lista: 'setores', obrigatorio: true
                }) +
                '<span class="field__error">Selecione o setor ou unidade de destino.</span>' +
              '</div>' +

              '<div class="field">' +
                '<label for="sa-tecnico">Técnico responsável <span class="req">*</span></label>' +
                UI.selectGerenciavel({
                  id: 'sa-tecnico', name: 'tecnico', lista: 'tecnicos',
                  obrigatorio: true, placeholder: 'Selecione o técnico…'
                }) +
                '<span class="field__error">Informe o técnico responsável pela saída.</span>' +
              '</div>' +

              '<div class="field field--full">' +
                '<label for="sa-servico">Serviço solicitado</label>' +
                '<textarea class="textarea" id="sa-servico" name="servicoSolicitado" ' +
                  'placeholder="Descreva o serviço atendido ou o motivo da disponibilização…"></textarea>' +
              '</div>' +

            '</div>' +

            '<div class="form-actions">' +
              '<button type="submit" class="btn btn--primary" id="sa-enviar">' +
                UI.icone('saida', 16) + '<span>Registrar saída</span></button>' +
              '<button type="reset" class="btn btn--ghost">' +
                UI.icone('limpar', 16) + '<span>Limpar formulário</span></button>' +
            '</div>' +

          '</form>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card__head">' +
          '<div>' +
            '<div class="card__title">Últimas saídas registradas</div>' +
            '<div class="card__sub" id="saida-recentes-sub">20 lançamentos mais recentes</div>' +
          '</div>' +
          '<div class="card__spacer"></div>' +
          '<button class="btn btn--outline btn--sm" data-acao="excel">' +
            UI.icone('excel', 14) + '<span>Excel</span></button>' +
          '<button class="btn btn--outline btn--sm" data-acao="pdf">' +
            UI.icone('pdf', 14) + '<span>PDF</span></button>' +
        '</div>' +
        '<div class="card__body" style="padding-bottom:0">' +
          '<div class="status-filtros" id="sa-filtro-status" role="group" aria-label="Filtrar por status de saída"></div>' +
        '</div>' +
        '<div class="card__body card__body--flush">' +
          '<div class="table-wrap" id="saida-recentes"></div>' +
        '</div>' +
      '</div>';
  }

  /** Chip clicável (liga/desliga) na cor do próprio status — filtro múltiplo. */
  function chipFiltroStatus(status, ativo) {
    var estilo = SAGETI.statusCores ? SAGETI.statusCores.estiloBadge(status) : null;
    var style = estilo
      ? 'style="' +
        (ativo
          ? 'background:' + estilo.dot + ';border-color:' + estilo.dot + ';color:#fff"'
          : 'background:' + estilo.background + ';border-color:' + estilo.borderColor + '"')
      : '';
    return '<button type="button" class="status-filtro-chip' + (ativo ? ' is-active' : '') + '" ' +
      style + ' data-status="' + U.esc(status) + '" aria-pressed="' + (ativo ? 'true' : 'false') + '">' +
      (estilo ? '<span class="chip__dot" style="background:' + (ativo ? '#fff' : estilo.dot) + '"></span>' : '') +
      U.esc(status) + '</button>';
  }

  var filtroStatus = []; // status de saída marcados no filtro múltiplo; [] = todos

  function saidas() {
    return SAGETI.store.listarMovimentacoes().filter(function (m) { return m.tipo === 'SAIDA'; });
  }

  /** Aplica o filtro múltiplo de status (chips) sobre as saídas. */
  function saidasFiltradas() {
    var lista = saidas();
    if (!filtroStatus.length) return lista;
    return lista.filter(function (m) { return filtroStatus.indexOf(m.statusResultante) !== -1; });
  }

  function desenharFiltroStatus(container) {
    var alvo = container.querySelector('#sa-filtro-status');
    if (!alvo) return;
    var opcoes = L.statusDe('saida');
    alvo.innerHTML = opcoes.map(function (s) {
      return chipFiltroStatus(s, filtroStatus.indexOf(s) !== -1);
    }).join('') + (filtroStatus.length
      ? '<button type="button" class="status-filtro-limpar" data-limpar-status>Limpar filtro</button>'
      : '');
  }

  function desenharRecentes(container) {
    var todasFiltradas = saidasFiltradas();
    var lista = todasFiltradas.slice(0, 20);
    var alvo = container.querySelector('#saida-recentes');
    var sub = container.querySelector('#saida-recentes-sub');
    if (sub) {
      sub.textContent = filtroStatus.length
        ? todasFiltradas.length + ' resultado(s) para o filtro · mostrando até 20'
        : '20 lançamentos mais recentes';
    }
    if (!alvo) return;

    if (!lista.length) {
      alvo.innerHTML = UI.estadoVazio(
        filtroStatus.length ? 'Nenhuma saída para este filtro' : 'Nenhuma saída registrada',
        filtroStatus.length ? 'Ajuste ou limpe os status selecionados acima.'
          : 'O primeiro lançamento aparece aqui automaticamente.');
      return;
    }

    var html = '<table class="table"><thead><tr>' +
      '<th>Data</th><th>Chamado</th><th>Equipamento</th><th>Modelo</th>' +
      '<th>Tombo Novo</th><th>Tombo Antigo</th><th>Status</th>' +
      '<th>Prédio de destino</th><th>Setor / Unidade</th>' +
      '<th>Técnico</th><th>TTR</th><th>Registrado por</th>' +
      '</tr></thead><tbody>';

    lista.forEach(function (m) {
      html += '<tr>' +
        '<td class="num">' + U.dataBR(m.data) + '</td>' +
        '<td class="num">' + (m.chamado ? U.esc(m.chamado) : '<span class="muted">—</span>') + '</td>' +
        '<td class="strong">' + U.esc(m.equipamento || '—') + '</td>' +
        '<td>' + U.esc(m.modelo || '—') + '</td>' +
        '<td class="num tombo">' + (m.tomboNovo ? U.esc(m.tomboNovo) : '<span class="muted">—</span>') + '</td>' +
        '<td class="num tombo">' + (m.tomboAntigo ? U.esc(m.tomboAntigo) : '<span class="muted">—</span>') + '</td>' +
        '<td>' + UI.chipStatus(m.statusResultante) + '</td>' +
        '<td>' + U.esc(m.predio || '—') + '</td>' +
        '<td>' + U.esc(m.setor || '—') + '</td>' +
        '<td>' + (m.tecnico ? U.esc(m.tecnico) : '<span class="muted">—</span>') + '</td>' +
        '<td>' + UI.tagTTR(m.ttr) + '</td>' +
        '<td class="muted">' + U.esc(m.usuario || '—') + '</td>' +
      '</tr>';
    });

    alvo.innerHTML = html + '</tbody></table>';
  }

  /** Datalist com os tombos que ainda estão no laboratório. */
  function atualizarSugestoes(container) {
    var dl = container.querySelector('#lista-tombos');
    if (!dl) return;
    dl.innerHTML = SAGETI.store.estoqueLaboratorio().map(function (e) {
      var t = e.tomboNovo || e.tomboAntigo;
      if (!t) return '';
      return '<option value="' + U.esc(t) + '">' +
        U.esc(e.equipamento + ' · ' + e.modelo) + '</option>';
    }).join('');
  }

  function montar(container, navegar) {
    container.innerHTML = esqueleto();

    var form = container.querySelector('#form-saida');
    var selEquip = container.querySelector('#sa-equipamento');
    var selModelo = container.querySelector('#sa-modelo');
    var selStatus = container.querySelector('#sa-status');
    var descStatus = container.querySelector('#sa-desc-status');
    var tomboNovo = container.querySelector('#sa-tombo-novo');
    var tomboAntigo = container.querySelector('#sa-tombo-antigo');
    var achadoWrap = container.querySelector('#sa-achado-wrap');
    var achado = container.querySelector('#sa-achado');

    var repintarModelos = UI.ligarEquipamentoModelo(selEquip, selModelo);
    SAGETI.scanner.ligarBotoes(container);

    function mostrarDescStatus() {
      descStatus.textContent = L.statusMeta(selStatus.value).desc || '';
    }
    selStatus.addEventListener('change', mostrarDescStatus);
    mostrarDescStatus();

    /* Localiza o equipamento pelo tombo e preenche o restante do formulário. */
    function localizar() {
      var eq = SAGETI.store.acharPorTombo({
        tomboNovo: tomboNovo.value, tomboAntigo: tomboAntigo.value
      });
      if (!eq) { achadoWrap.style.display = 'none'; return null; }

      function linha(k, v) {
        return '<div class="result-preview__row"><span class="result-preview__k">' + U.esc(k) +
          '</span><span class="result-preview__v">' + v + '</span></div>';
      }

      achado.innerHTML =
        linha('Equipamento localizado', U.esc(eq.equipamento + ' · ' + eq.modelo)) +
        linha('Situação atual', UI.chipStatus(eq.status)) +
        linha('Origem', U.esc([eq.predioOrigem, eq.setorOrigem].filter(Boolean).join(' · ') || '—')) +
        linha('Entrada em', U.dataBR(eq.dataEntrada)) +
        (!eq.noLaboratorio
          ? linha('Atenção', '<span style="color:var(--status-critical)">Já saiu do laboratório em ' +
              U.dataBR(eq.dataSaida) + ' para ' + U.esc(eq.predioDestino || '—') + '</span>')
          : '');
      achadoWrap.style.display = '';

      if (eq.equipamento) {
        selEquip.value = eq.equipamento;
        selEquip.dispatchEvent(new Event('change'));
        selModelo.value = eq.modelo || '';
      }
      var campoChamado = container.querySelector('#sa-chamado');
      if (!campoChamado.value && eq.chamado) campoChamado.value = eq.chamado;
      if (!tomboNovo.value && eq.tomboNovo) tomboNovo.value = eq.tomboNovo;
      if (!tomboAntigo.value && eq.tomboAntigo) tomboAntigo.value = eq.tomboAntigo;

      return eq;
    }

    var localizarDebounce = U.debounce(localizar, 260);
    tomboNovo.addEventListener('input', localizarDebounce);
    tomboAntigo.addEventListener('input', localizarDebounce);
    tomboNovo.addEventListener('change', localizar);
    tomboAntigo.addEventListener('change', localizar);

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!SAGETI.auth.permissao('podeEditar')) {
        return UI.toast('warn', 'Sem permissão', 'Seu perfil é somente de consulta.');
      }
      if (!UI.validarForm(form)) {
        return UI.toast('warn', 'Campos obrigatórios', 'Preencha os campos destacados.');
      }

      var dados = UI.dadosForm(form);

      if (!dados.tomboNovo && !dados.tomboAntigo) {
        UI.marcarErro(tomboNovo, 'Informe o tombo novo ou o antigo.');
        return UI.toast('warn', 'Tombo obrigatório', 'Informe ao menos um número de tombo.');
      }

      SAGETI.store.registrarSaida(dados).then(function (r) {
        if (!r.ok) {
          UI.marcarErro(tomboNovo, 'Equipamento não disponível para saída.');
          return UI.toast('error', 'Saída não registrada', r.erro);
        }

        UI.toast('success', 'Saída registrada',
          r.equipamento.equipamento + ' · tombo ' +
          (r.equipamento.tomboNovo || r.equipamento.tomboAntigo) + ' → ' +
          (r.equipamento.predioDestino || 'destino') + '. Estoque e dashboard atualizados.');

        form.reset();
        container.querySelector('#sa-data').value = U.hoje();
        repintarModelos = UI.ligarEquipamentoModelo(selEquip, selModelo);
        mostrarDescStatus();
        achadoWrap.style.display = 'none';
        tomboNovo.focus();
      });
    });

    form.addEventListener('reset', function () {
      setTimeout(function () {
        container.querySelector('#sa-data').value = U.hoje();
        repintarModelos = UI.ligarEquipamentoModelo(selEquip, selModelo);
        mostrarDescStatus();
        achadoWrap.style.display = 'none';
        container.querySelectorAll('.field').forEach(function (f) { f.classList.remove('has-error'); });
      }, 0);
    });

    container.addEventListener('click', function (e) {
      var chipStatus = e.target.closest('[data-status]');
      if (chipStatus) {
        var s = chipStatus.getAttribute('data-status');
        var i = filtroStatus.indexOf(s);
        if (i === -1) filtroStatus.push(s); else filtroStatus.splice(i, 1);
        desenharFiltroStatus(container);
        desenharRecentes(container);
        return;
      }
      if (e.target.closest('[data-limpar-status]')) {
        filtroStatus = [];
        desenharFiltroStatus(container);
        desenharRecentes(container);
        return;
      }

      var acao = e.target.closest('[data-acao]');
      if (!acao) return;
      var lista = saidasFiltradas();
      if (!lista.length) return UI.toast('warn', 'Nada a exportar', 'Nenhuma saída corresponde ao filtro atual.');

      if (acao.getAttribute('data-acao') === 'excel') {
        var nomeArq = SAGETI.APP.nome + '_Saidas_' + U.carimbo() + '.xlsx';
        if (SAGETI.exportar.paraExcelColorido) {
          SAGETI.exportar.paraExcelColorido({
            nome: 'Saídas', titulo: SAGETI.APP.nome + ' — Saídas de Equipamentos',
            registros: lista, colunas: SAGETI.exportar.COLS_MOV, colunaStatus: 'statusResultante'
          }, nomeArq);
        } else {
          SAGETI.exportar.paraExcel([{
            nome: 'Saídas', tituloRelatorio: SAGETI.APP.nome + ' — Saídas de Equipamentos',
            registros: lista, colunas: SAGETI.exportar.COLS_MOV
          }], nomeArq);
        }
      } else {
        SAGETI.exportar.paraPDF({
          titulo: 'Saídas de Equipamentos',
          subtitulo: filtroStatus.length
            ? 'Status filtrados: ' + filtroStatus.join(', ')
            : 'Todas as saídas registradas do laboratório',
          registros: lista, colunas: SAGETI.exportar.COLS_MOV
        }, SAGETI.APP.nome + '_Saidas_' + U.carimbo() + '.pdf');
      }
    });

    function repintarListas() {
      UI.repintarSelect(selEquip, L.get('equipamentos'), 'Selecione…');
      UI.repintarSelect(selStatus, L.statusDe('saida'), 'Selecione…');
      UI.repintarSelect(container.querySelector('#sa-ttr'), L.ttrDe('saida'), 'Selecione…');
      UI.repintarSelect(container.querySelector('#sa-predio'), L.get('predios'), 'Selecione…');
      UI.repintarSelect(container.querySelector('#sa-setor'), L.get('setores'), 'Selecione…');
      UI.repintarSelect(container.querySelector('#sa-tecnico'), L.get('tecnicos'), 'Selecione o técnico…');
      if (repintarModelos) repintarModelos(true);
      mostrarDescStatus();
    }

    desenharFiltroStatus(container);
    desenharRecentes(container);
    atualizarSugestoes(container);

    var cancelar = SAGETI.store.assinar(function (ev) {
      if (ev && ev.tipo === 'listas') { repintarListas(); desenharFiltroStatus(container); return; }
      desenharRecentes(container);
      atualizarSugestoes(container);
    });

    return { destruir: cancelar };
  }

  SAGETI.pages = SAGETI.pages || {};
  SAGETI.pages.saida = {
    titulo: 'Saída de Equipamentos',
    subtitulo: 'Envio de itens para as unidades',
    montar: montar
  };

})(window.SAGETI);
