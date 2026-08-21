/* ==========================================================================
   SAGE-TI — Aba: Entrada de Equipamentos
   --------------------------------------------------------------------------
   Salvar aqui cria ou atualiza o item no Estoque Laboratório e repinta a
   Dashboard no mesmo instante. Todos os dropdowns leem de SAGETI.listas e
   trazem o botão de engrenagem para gerenciar as opções sem sair da tela.
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
          '<h1 class="page-head__title">Entrada de Equipamentos</h1>' +
          '<p class="page-head__sub">Registre a chegada de itens ao laboratório</p>' +
        '</div>' +
        '<div class="page-head__spacer"></div>' +
        '<button class="btn btn--outline" data-acao="importar">' +
          UI.icone('planilha', 16) + '<span>Importar planilha</span></button>' +
      '</div>' +

      '<div class="alert alert--info">' + UI.icone('info', 17) +
        '<span>Ao salvar, o equipamento é criado no <strong>Estoque Laboratório</strong> e a ' +
        '<strong>Dashboard</strong> é atualizada na hora. Se o tombo já existir, o registro ' +
        'existente é atualizado em vez de duplicado.</span>' +
      '</div>' +

      '<div class="card" style="margin-bottom:18px">' +
        '<div class="card__head">' +
          '<div>' +
            '<div class="card__title">Dados da entrada</div>' +
            '<div class="card__sub">Campos com <span style="color:var(--status-critical)">*</span> ' +
              'são obrigatórios · o ícone ⚙ ao lado de um campo abre o gerenciador da lista</div>' +
          '</div>' +
        '</div>' +
        '<div class="card__body">' +
          '<form id="form-entrada" novalidate>' +
            '<div class="form-grid">' +

              '<div class="field">' +
                '<label for="en-data">Data de entrada <span class="req">*</span></label>' +
                '<input class="input" type="date" id="en-data" name="dataEntrada" ' +
                  'value="' + U.hoje() + '" max="' + U.hoje() + '" data-obrigatorio>' +
                '<span class="field__error">Informe a data de entrada.</span>' +
              '</div>' +

              '<div class="field">' +
                '<label for="en-chamado">Chamado</label>' +
                '<input class="input" type="text" id="en-chamado" name="chamado" placeholder="Ex.: CH-10450">' +
              '</div>' +

              '<div class="field">' +
                '<label for="en-tombo-novo">Tombo Novo</label>' +
                '<div class="field__linha">' +
                  '<input class="input" type="text" id="en-tombo-novo" name="tomboNovo" ' +
                    'inputmode="numeric" placeholder="Ex.: 045112" autocomplete="off">' +
                  SAGETI.scanner.botaoHTML('en-tombo-novo', 'Ler tombo pela câmera') +
                '</div>' +
                '<span class="field__help" id="en-aviso-tombo">Pode ficar em branco e ser preenchido depois.</span>' +
              '</div>' +

              '<div class="field">' +
                '<label for="en-tombo-antigo">Tombo Antigo</label>' +
                '<div class="field__linha">' +
                  '<input class="input" type="text" id="en-tombo-antigo" name="tomboAntigo" ' +
                    'inputmode="numeric" placeholder="Ex.: 11233" autocomplete="off">' +
                  SAGETI.scanner.botaoHTML('en-tombo-antigo', 'Ler tombo pela câmera') +
                '</div>' +
              '</div>' +

              '<div class="field">' +
                '<label for="en-quantidade">Quantidade <span class="req">*</span></label>' +
                '<input class="input" type="number" id="en-quantidade" name="quantidade" ' +
                  'min="1" max="200" step="1" value="1" data-obrigatorio>' +
                '<span class="field__help" id="en-aviso-quantidade">Só disponível com os tombos em branco — ' +
                  'ideal para periféricos sem tombo individual (ex.: mouses, cabos, headsets).</span>' +
                '<span class="field__error">Informe uma quantidade válida.</span>' +
              '</div>' +

              '<div class="field">' +
                '<label for="en-equipamento">Equipamento <span class="req">*</span></label>' +
                UI.selectGerenciavel({
                  id: 'en-equipamento', name: 'equipamento',
                  lista: 'equipamentos', obrigatorio: true
                }) +
                '<span class="field__error">Selecione o equipamento.</span>' +
              '</div>' +

              '<div class="field">' +
                '<label for="en-modelo">Modelo <span class="req">*</span></label>' +
                '<div class="field__linha">' +
                  '<select class="select" id="en-modelo" name="modelo" data-obrigatorio></select>' +
                  (SAGETI.auth.permissao('podeGerenciarListas')
                    ? '<button type="button" class="field__gerenciar" data-gerenciar-lista="modelos" ' +
                      'data-alvo-campo="en-modelo" title="Gerenciar modelos" ' +
                      'aria-label="Gerenciar modelos">' + UI.icone('engrenagem', 15) + '</button>'
                    : '') +
                '</div>' +
                '<span class="field__help">A lista é filtrada pela categoria escolhida.</span>' +
                '<span class="field__error">Selecione o modelo.</span>' +
              '</div>' +

              '<div class="field">' +
                '<label for="en-status">Status <span class="req">*</span></label>' +
                UI.selectGerenciavel({
                  id: 'en-status', name: 'status', lista: 'status',
                  opcoesLista: L.statusDe('entrada'), valor: 'Entrada de Estoque',
                  obrigatorio: true, placeholder: 'Selecione…'
                }) +
                '<span class="field__help" id="en-desc-status"></span>' +
                '<span class="field__error">Selecione o status.</span>' +
              '</div>' +

              '<div class="field">' +
                '<label for="en-ttr">TTR <span class="req">*</span></label>' +
                UI.selectGerenciavel({
                  id: 'en-ttr', name: 'ttr', lista: 'ttrEntrada',
                  valor: 'Pendente', obrigatorio: true, placeholder: 'Selecione…'
                }) +
                '<span class="field__error">Informe a situação do TTR.</span>' +
              '</div>' +

              '<div class="field">' +
                '<label for="en-predio">Prédio de onde veio <span class="req">*</span></label>' +
                UI.selectGerenciavel({
                  id: 'en-predio', name: 'predioOrigem', lista: 'predios', obrigatorio: true
                }) +
                '<span class="field__error">Selecione o prédio de origem.</span>' +
              '</div>' +

              '<div class="field">' +
                '<label for="en-setor">Setor / Unidade <span class="req">*</span></label>' +
                UI.selectGerenciavel({
                  id: 'en-setor', name: 'setorOrigem', lista: 'setores', obrigatorio: true
                }) +
                '<span class="field__error">Selecione o setor ou unidade.</span>' +
              '</div>' +

              '<div class="field field--full">' +
                '<label for="en-servico">Serviço solicitado</label>' +
                '<textarea class="textarea" id="en-servico" name="servicoSolicitado" ' +
                  'placeholder="Descreva o serviço solicitado, o defeito relatado ou o motivo do recolhimento…"></textarea>' +
              '</div>' +

            '</div>' +

            '<div class="form-actions">' +
              '<button type="submit" class="btn btn--primary">' +
                UI.icone('entrada', 16) + '<span>Registrar entrada</span></button>' +
              '<button type="reset" class="btn btn--ghost">' +
                UI.icone('limpar', 16) + '<span>Limpar formulário</span></button>' +
              '<span class="spacer"></span>' +
              '<label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text-secondary)">' +
                '<input type="checkbox" id="en-continuar" checked style="width:15px;height:15px;accent-color:var(--brand)">' +
                'Manter dados para o próximo lançamento' +
              '</label>' +
            '</div>' +

          '</form>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card__head">' +
          '<div>' +
            '<div class="card__title">Últimas entradas registradas</div>' +
            '<div class="card__sub">20 lançamentos mais recentes</div>' +
          '</div>' +
          '<div class="card__spacer"></div>' +
          '<button class="btn btn--outline btn--sm" data-acao="excel">' +
            UI.icone('excel', 14) + '<span>Excel</span></button>' +
          '<button class="btn btn--outline btn--sm" data-acao="pdf">' +
            UI.icone('pdf', 14) + '<span>PDF</span></button>' +
        '</div>' +
        '<div class="card__body card__body--flush">' +
          '<div class="table-wrap" id="entrada-recentes"></div>' +
        '</div>' +
      '</div>';
  }

  function entradas() {
    return SAGETI.store.listarMovimentacoes().filter(function (m) { return m.tipo === 'ENTRADA'; });
  }

  function desenharRecentes(container) {
    var lista = entradas().slice(0, 20);
    var alvo = container.querySelector('#entrada-recentes');
    if (!alvo) return;

    if (!lista.length) {
      alvo.innerHTML = UI.estadoVazio('Nenhuma entrada registrada',
        'O primeiro lançamento aparece aqui automaticamente.');
      return;
    }

    var html = '<table class="table"><thead><tr>' +
      '<th>Data</th><th>Chamado</th><th>Equipamento</th><th>Modelo</th>' +
      '<th>Tombo Novo</th><th>Tombo Antigo</th><th>Status</th><th>Origem</th>' +
      '<th>Setor / Unidade</th><th>TTR</th><th>Registrado por</th>' +
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
        '<td>' + UI.tagTTR(m.ttr) + '</td>' +
        '<td class="muted">' + U.esc(m.usuario || '—') + '</td>' +
      '</tr>';
    });

    alvo.innerHTML = html + '</tbody></table>';
  }

  function montar(container, navegar) {
    container.innerHTML = esqueleto();

    var form = container.querySelector('#form-entrada');
    var selEquip = container.querySelector('#en-equipamento');
    var selModelo = container.querySelector('#en-modelo');
    var selStatus = container.querySelector('#en-status');
    var descStatus = container.querySelector('#en-desc-status');
    var tomboNovo = container.querySelector('#en-tombo-novo');
    var tomboAntigo = container.querySelector('#en-tombo-antigo');
    var aviso = container.querySelector('#en-aviso-tombo');
    var campoQtd = container.querySelector('#en-quantidade');

    var repintarModelos = UI.ligarEquipamentoModelo(selEquip, selModelo);
    SAGETI.scanner.ligarBotoes(container);

    function mostrarDescStatus() {
      var meta = L.statusMeta(selStatus.value);
      descStatus.textContent = meta.desc || '';
    }
    selStatus.addEventListener('change', mostrarDescStatus);
    mostrarDescStatus();

    /* Avisa quando o tombo já existe e pré-preenche categoria e modelo. */
    function checarTombo() {
      var existente = SAGETI.store.acharPorTombo({
        tomboNovo: tomboNovo.value, tomboAntigo: tomboAntigo.value
      });
      if (!existente) {
        aviso.textContent = (tomboNovo.value || tomboAntigo.value)
          ? '' : 'Pode ficar em branco e ser preenchido depois.';
        aviso.style.color = '';
        return;
      }

      aviso.textContent = 'Tombo já cadastrado (' + existente.equipamento + ' · ' +
        existente.modelo + ', status "' + existente.status + '"' +
        (existente.noLaboratorio ? '' : ', fora do laboratório') +
        '). Salvar atualiza este registro.';
      aviso.style.color = 'var(--status-warning)';

      if (!selEquip.value) {
        selEquip.value = existente.equipamento;
        selEquip.dispatchEvent(new Event('change'));
        selModelo.value = existente.modelo;
      }
    }
    tomboNovo.addEventListener('blur', checarTombo);
    tomboAntigo.addEventListener('blur', checarTombo);

    /* Quantidade > 1 só faz sentido sem tombo individual (ex.: periféricos). */
    function sincronizarQuantidade() {
      var temTombo = !!(tomboNovo.value.trim() || tomboAntigo.value.trim());
      campoQtd.disabled = temTombo;
      if (temTombo) campoQtd.value = 1;
    }
    tomboNovo.addEventListener('input', sincronizarQuantidade);
    tomboAntigo.addEventListener('input', sincronizarQuantidade);
    sincronizarQuantidade();

    /** Registra a mesma entrada `quantidade` vezes em sequência (sem tombo). */
    function registrarEmLote(dados, quantidade) {
      var restantes = quantidade;
      var sucesso = 0;
      var erro = null;
      function proximo() {
        if (restantes <= 0) return Promise.resolve();
        restantes--;
        return SAGETI.store.registrarEntrada(dados).then(function (r) {
          if (!r.ok) { erro = r.erro; return; }
          sucesso++;
          return proximo();
        });
      }
      return proximo().then(function () { return { sucesso: sucesso, erro: erro }; });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!SAGETI.auth.permissao('podeEditar')) {
        return UI.toast('warn', 'Sem permissão', 'Seu perfil é somente de consulta.');
      }
      if (!UI.validarForm(form)) {
        return UI.toast('warn', 'Campos obrigatórios', 'Preencha os campos destacados.');
      }

      var dados = UI.dadosForm(form);
      var quantidade = Math.max(1, Math.min(200, parseInt(dados.quantidade, 10) || 1));

      if (quantidade > 1 && (tomboNovo.value.trim() || tomboAntigo.value.trim())) {
        UI.marcarErro(campoQtd, 'Quantidade só pode ser maior que 1 com os tombos em branco.');
        return UI.toast('warn', 'Quantidade não permitida',
          'Cada tombo identifica um equipamento único — deixe os tombos em branco para adicionar vários de uma vez.');
      }

      function limparParaProximo() {
        campoQtd.value = 1;
        campoQtd.disabled = false;
        if (container.querySelector('#en-continuar').checked) {
          // Preserva data, prédio, setor e chamado; zera o que identifica o item.
          tomboNovo.value = '';
          tomboAntigo.value = '';
          container.querySelector('#en-servico').value = '';
          aviso.textContent = 'Pode ficar em branco e ser preenchido depois.';
          tomboNovo.focus();
        } else {
          form.reset();
          container.querySelector('#en-data').value = U.hoje();
          repintarModelos = UI.ligarEquipamentoModelo(selEquip, selModelo);
          mostrarDescStatus();
          aviso.textContent = 'Pode ficar em branco e ser preenchido depois.';
        }
      }

      if (quantidade > 1) {
        registrarEmLote(dados, quantidade).then(function (r) {
          if (r.sucesso === 0) return UI.toast('error', 'Não foi possível registrar', r.erro);

          if (r.erro) {
            UI.toast('warn', r.sucesso + ' de ' + quantidade + ' itens adicionados',
              'Um dos itens falhou: ' + r.erro);
          } else {
            UI.toast('success', r.sucesso + ' equipamentos adicionados',
              dados.equipamento + ' · ' + dados.modelo + ' — estoque e dashboard atualizados.');
          }
          limparParaProximo();
        });
        return;
      }

      SAGETI.store.registrarEntrada(dados).then(function (r) {
        if (!r.ok) return UI.toast('error', 'Não foi possível registrar', r.erro);

        UI.toast('success',
          r.criado ? 'Entrada registrada' : 'Reentrada registrada',
          r.equipamento.equipamento + ' · tombo ' +
          (r.equipamento.tomboNovo || r.equipamento.tomboAntigo) +
          ' — estoque e dashboard atualizados.');

        limparParaProximo();
      });
    });

    form.addEventListener('reset', function () {
      setTimeout(function () {
        container.querySelector('#en-data').value = U.hoje();
        repintarModelos = UI.ligarEquipamentoModelo(selEquip, selModelo);
        mostrarDescStatus();
        aviso.textContent = '';
        sincronizarQuantidade();
        container.querySelectorAll('.field').forEach(function (f) { f.classList.remove('has-error'); });
      }, 0);
    });

    container.addEventListener('click', function (e) {
      var acao = e.target.closest('[data-acao]');
      if (!acao) return;
      var qual = acao.getAttribute('data-acao');

      if (qual === 'importar') return SAGETI.importar.abrir();

      var lista = entradas();
      if (!lista.length) return UI.toast('warn', 'Nada a exportar', 'Nenhuma entrada registrada.');

      if (qual === 'excel') {
        var nomeArqEntrada = SAGETI.APP.nome + '_Entradas_' + U.carimbo() + '.xlsx';
        if (SAGETI.exportar.paraExcelColorido) {
          SAGETI.exportar.paraExcelColorido({
            nome: 'Entradas', titulo: SAGETI.APP.nome + ' — Entradas de Equipamentos',
            registros: lista, colunas: SAGETI.exportar.COLS_MOV, colunaStatus: 'statusResultante'
          }, nomeArqEntrada);
        } else {
          SAGETI.exportar.paraExcel([{
            nome: 'Entradas', tituloRelatorio: SAGETI.APP.nome + ' — Entradas de Equipamentos',
            registros: lista, colunas: SAGETI.exportar.COLS_MOV
          }], nomeArqEntrada);
        }
      } else if (qual === 'pdf') {
        SAGETI.exportar.paraPDF({
          titulo: 'Entradas de Equipamentos',
          subtitulo: 'Todas as entradas registradas no laboratório',
          registros: lista, colunas: SAGETI.exportar.COLS_MOV
        }, SAGETI.APP.nome + '_Entradas_' + U.carimbo() + '.pdf');
      }
    });

    /** Repinta os selects quando as listas mudam (aqui ou em outra aba). */
    function repintarListas() {
      UI.repintarSelect(selEquip, L.get('equipamentos'), 'Selecione…');
      UI.repintarSelect(selStatus, L.statusDe('entrada'), 'Selecione…');
      UI.repintarSelect(container.querySelector('#en-ttr'), L.ttrDe('entrada'), 'Selecione…');
      UI.repintarSelect(container.querySelector('#en-predio'), L.get('predios'), 'Selecione…');
      UI.repintarSelect(container.querySelector('#en-setor'), L.get('setores'), 'Selecione…');
      if (repintarModelos) repintarModelos(true);
      mostrarDescStatus();
    }

    desenharRecentes(container);

    var cancelar = SAGETI.store.assinar(function (ev) {
      if (ev && ev.tipo === 'listas') return repintarListas();
      desenharRecentes(container);
    });

    return { destruir: cancelar };
  }

  SAGETI.pages = SAGETI.pages || {};
  SAGETI.pages.entrada = {
    titulo: 'Entrada de Equipamentos',
    subtitulo: 'Registro de chegada ao laboratório',
    montar: montar
  };

})(window.SAGETI);
