/* ==========================================================================
   SAGE-TI — Utilitários, ícones e componentes de interface
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  /* ---------- Util ---------------------------------------------------------- */

  var util = {};

  util.esc = function (v) {
    if (v == null) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  /** "2026-07-31" -> "31/07/2026" (sem passar por Date, evita fuso). */
  util.dataBR = function (iso) {
    if (!iso) return '—';
    var s = String(iso).slice(0, 10).split('-');
    if (s.length !== 3) return iso;
    return s[2] + '/' + s[1] + '/' + s[0];
  };

  util.dataHoraBR = function (iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  util.hoje = function () { return new Date().toISOString().slice(0, 10); };

  util.numero = function (n) { return Number(n || 0).toLocaleString('pt-BR'); };

  /** Remove acentos e caixa, para busca tolerante. */
  util.slug = function (s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().trim();
  };

  util.debounce = function (fn, ms) {
    var t;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms || 220);
    };
  };

  util.baixarArquivo = function (conteudo, nomeArquivo, mime) {
    var blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  };

  /** Sufixo de data para nomes de arquivo exportado: 2026-07-31_1435 */
  util.carimbo = function () {
    var d = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      '_' + p(d.getHours()) + p(d.getMinutes());
  };

  util.ordenarPor = function (lista, campo, direcao) {
    var dir = direcao === 'desc' ? -1 : 1;
    return lista.slice().sort(function (a, b) {
      var va = a[campo], vb = b[campo];
      if (va == null) va = '';
      if (vb == null) vb = '';
      // números com zeros à esquerda (tombos) comparam melhor como texto
      var na = Number(va), nb = Number(vb);
      if (va !== '' && vb !== '' && !isNaN(na) && !isNaN(nb) && String(va).length === String(vb).length) {
        return (na - nb) * dir;
      }
      return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true, sensitivity: 'base' }) * dir;
    });
  };

  SAGETI.util = util;

  /* ---------- Ícones (Lucide, inline) --------------------------------------- */

  var P = 'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"';

  var ICONES = {
    dashboard: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM13 7h8V3h-8zM3 21h8v-4H3z"/>',
    caixa:     '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    entrada:   '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    saida:     '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
    relatorio: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h8"/><path d="M8 17h5"/>',
    download:  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    plus:      '<path d="M5 12h14"/><path d="M12 5v14"/>',
    editar:    '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
    lixeira:   '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    busca:     '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    filtro:    '<path d="M22 3H2l8 9.46V19l4 2v-8.54Z"/>',
    x:         '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check:     '<path d="M20 6 9 17l-5-5"/>',
    alerta:    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    info:      '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    sair:      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    menu:      '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    sol:       '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    lua:       '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9"/>',
    excel:     '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 13 6 6"/><path d="m15 13-6 6"/>',
    pdf:       '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M9 18h3"/>',
    tabela:    '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>',
    grafico:   '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    vazio:     '<path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>',
    olho:      '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    usuario:   '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    engrenagem:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2"/><circle cx="12" cy="12" r="3"/>',
    cadeado:   '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    limpar:    '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M9.5 11v6"/><path d="M14.5 11v6"/><path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14"/>',
    predio:    '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
    relogio:   '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    etiqueta:  '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    upload:    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    planilha:  '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/><path d="M15 21V9"/><path d="M3 15h18"/>',
    listas:    '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    voltar:    '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    salvar:    '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
    restaurar: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    camera:    '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/>',
    barcode:   '<path d="M3 5v14"/><path d="M7 5v14"/><path d="M11 5v14"/><path d="M14 5v14"/><path d="M18 5v14"/><path d="M21 5v14"/>'
  };

  /** Devolve o markup SVG de um ícone. */
  function icone(nome, tamanho) {
    var d = ICONES[nome];
    if (!d) return '';
    var s = tamanho || 24;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" ' + P +
      ' aria-hidden="true" focusable="false">' + d + '</svg>';
  }

  /* ---------- Toast ---------------------------------------------------------- */

  var TOAST_ICONE = { success: 'check', error: 'alerta', warn: 'alerta', info: 'info' };

  function toast(tipo, titulo, mensagem, duracaoMs) {
    var pilha = document.getElementById('toast-stack');
    if (!pilha) return;
    var el = document.createElement('div');
    el.className = 'toast toast--' + (tipo || 'info');
    el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    el.innerHTML =
      icone(TOAST_ICONE[tipo] || 'info', 18) +
      '<div style="min-width:0">' +
        '<div class="toast__title">' + util.esc(titulo) + '</div>' +
        (mensagem ? '<div class="toast__msg">' + util.esc(mensagem) + '</div>' : '') +
      '</div>' +
      '<button class="toast__close" type="button" aria-label="Fechar aviso">&times;</button>';
    pilha.appendChild(el);

    var timer = setTimeout(fechar, duracaoMs || (tipo === 'error' ? 7000 : 4200));
    function fechar() {
      clearTimeout(timer);
      el.style.opacity = '0';
      el.style.transition = 'opacity .15s';
      setTimeout(function () { el.remove(); }, 160);
    }
    el.querySelector('.toast__close').addEventListener('click', fechar);
  }

  /* ---------- Modal ---------------------------------------------------------- */

  var modalAberto = null;

  /**
   * Abre um modal.
   * @param {{titulo, subtitulo, corpo, largura, botoes:[{texto,classe,acao,fechar}]}} cfg
   * @returns {{fechar: Function, el: HTMLElement}}
   */
  function modal(cfg) {
    fecharModal();

    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    var caixa = document.createElement('div');
    caixa.className = 'modal' + (cfg.largura === 'sm' ? ' modal--sm' : '');
    caixa.setAttribute('role', 'dialog');
    caixa.setAttribute('aria-modal', 'true');
    caixa.setAttribute('aria-label', cfg.titulo || 'Janela');

    caixa.innerHTML =
      '<div class="modal__head">' +
        '<div style="min-width:0">' +
          '<div class="modal__title">' + util.esc(cfg.titulo || '') + '</div>' +
          (cfg.subtitulo ? '<div class="modal__sub">' + util.esc(cfg.subtitulo) + '</div>' : '') +
        '</div>' +
        '<div style="flex:1"></div>' +
        '<button class="icon-btn" type="button" data-fechar aria-label="Fechar">' + icone('x', 17) + '</button>' +
      '</div>' +
      '<div class="modal__body"></div>' +
      '<div class="modal__foot"></div>';

    var corpo = caixa.querySelector('.modal__body');
    if (typeof cfg.corpo === 'string') corpo.innerHTML = cfg.corpo;
    else if (cfg.corpo) corpo.appendChild(cfg.corpo);

    var rodape = caixa.querySelector('.modal__foot');
    (cfg.botoes || []).forEach(function (b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ' + (b.classe || 'btn--ghost');
      btn.innerHTML = (b.icone ? icone(b.icone, 16) : '') + '<span>' + util.esc(b.texto) + '</span>';
      btn.addEventListener('click', function () {
        var manter = b.acao ? b.acao(caixa) : undefined;
        if (b.fechar !== false && manter !== false) fecharModal();
      });
      rodape.appendChild(btn);
    });
    if (!rodape.children.length) rodape.remove();

    backdrop.appendChild(caixa);
    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';

    backdrop.addEventListener('mousedown', function (e) {
      if (e.target === backdrop) fecharModal();
    });
    caixa.querySelector('[data-fechar]').addEventListener('click', fecharModal);
    document.addEventListener('keydown', aoTeclar);

    function aoTeclar(e) { if (e.key === 'Escape') fecharModal(); }

    modalAberto = { backdrop: backdrop, aoTeclar: aoTeclar };

    var foco = caixa.querySelector('input, select, textarea, button:not([data-fechar])');
    if (foco) setTimeout(function () { foco.focus(); }, 40);

    return { fechar: fecharModal, el: caixa };
  }

  function fecharModal() {
    if (!modalAberto) return;
    document.removeEventListener('keydown', modalAberto.aoTeclar);
    modalAberto.backdrop.remove();
    modalAberto = null;
    document.body.style.overflow = '';
  }

  function confirmar(cfg) {
    return new Promise(function (resolve) {
      modal({
        titulo: cfg.titulo || 'Confirmar',
        largura: 'sm',
        corpo: '<p style="font-size:13.5px;color:var(--text-secondary);margin:0">' +
               util.esc(cfg.mensagem || 'Deseja continuar?') + '</p>',
        botoes: [
          { texto: cfg.cancelar || 'Cancelar', classe: 'btn--ghost', acao: function () { resolve(false); } },
          { texto: cfg.confirmar || 'Confirmar', classe: cfg.perigo ? 'btn--danger' : 'btn--primary',
            acao: function () { resolve(true); } }
        ]
      });
    });
  }

  /* ---------- Construtores de campo ------------------------------------------ */

  /** <option> list a partir de um array. */
  function opcoes(lista, selecionado, placeholder) {
    var html = placeholder !== false
      ? '<option value="">' + util.esc(placeholder || 'Selecione…') + '</option>'
      : '';
    lista.forEach(function (item) {
      var valor = typeof item === 'string' ? item : item.valor;
      var rotulo = typeof item === 'string' ? item : (item.rotulo || item.valor);
      html += '<option value="' + util.esc(valor) + '"' +
        (String(selecionado) === String(valor) ? ' selected' : '') + '>' +
        util.esc(rotulo) + '</option>';
    });
    return html;
  }

  /**
   * Como `opcoes`, mas garante que o valor atual apareça na lista mesmo que
   * ele não pertença mais a ela. Sem isto, editar um registro antigo cujo
   * status ou TTR foi renomeado/removido trocaria o valor silenciosamente.
   */
  function opcoesCom(lista, valorAtual, placeholder) {
    var l = (lista || []).slice();
    var v = String(valorAtual == null ? '' : valorAtual).trim();
    if (v) {
      var existe = l.some(function (item) {
        var alvo = typeof item === 'string' ? item : item.valor;
        return SAGETI.listas._chave(alvo) === SAGETI.listas._chave(v);
      });
      if (!existe) l.push({ valor: v, rotulo: v + '  (fora da lista atual)' });
    }
    return opcoes(l, valorAtual, placeholder);
  }

  /**
   * Campo <select> alimentado por uma lista editável, com botão de
   * gerenciamento ao lado. É o componente que cumpre o requisito de nenhum
   * dropdown ser fixo: o usuário abre o gerenciador sem sair do formulário.
   *
   * @param {{id, name, lista, valor, placeholder, obrigatorio, contexto,
   *          opcoesLista, semGerenciar}} cfg
   */
  function selectGerenciavel(cfg) {
    var lista = cfg.opcoesLista || SAGETI.listas.get(cfg.lista);
    var podeGerenciar = !cfg.semGerenciar && SAGETI.auth.permissao('podeGerenciarListas');

    var html = '<div class="field__linha">' +
      '<select class="select" id="' + cfg.id + '" name="' + (cfg.name || cfg.id) + '"' +
        (cfg.obrigatorio ? ' data-obrigatorio' : '') +
        ' data-lista="' + util.esc(cfg.lista || '') + '">' +
        opcoesCom(lista, cfg.valor, cfg.placeholder) +
      '</select>';

    if (podeGerenciar) {
      html += '<button type="button" class="field__gerenciar" ' +
        'data-gerenciar-lista="' + util.esc(cfg.lista) + '" ' +
        'data-alvo-campo="' + cfg.id + '" ' +
        'title="Gerenciar as opções desta lista" ' +
        'aria-label="Gerenciar opções">' + icone('engrenagem', 15) + '</button>';
    }
    return html + '</div>';
  }

  /**
   * Repinta um <select> criado por `selectGerenciavel` mantendo a seleção.
   * Chamado quando as listas mudam (evento 'listas' do store).
   */
  function repintarSelect(el, lista, placeholder) {
    if (!el) return;
    var atual = el.value;
    el.innerHTML = opcoesCom(lista, atual, placeholder);
    el.value = atual;
    // O valor pode ter sido excluído: cai para vazio em vez de mentir.
    if (el.value !== atual) el.value = '';
  }

  /**
   * Liga um par de selects Equipamento -> Modelo.
   * O select de modelo mostra os modelos da categoria em "Modelos de <cat>" e
   * o restante em "Outros modelos", para nada ficar inacessível.
   */
  function ligarEquipamentoModelo(selEquip, selModelo, modeloInicial) {
    function repintar(preservar) {
      var cat = selEquip.value;
      var atual = preservar ? selModelo.value : '';
      var grupos = SAGETI.listas.modelosDe(cat);
      var html = '<option value="">Selecione…</option>';

      if (cat && grupos.sugeridos.length) {
        html += '<optgroup label="Modelos de ' + util.esc(cat) + '">';
        grupos.sugeridos.forEach(function (m) {
          html += '<option value="' + util.esc(m) + '">' + util.esc(m) + '</option>';
        });
        html += '</optgroup><optgroup label="Outros modelos">';
        grupos.outros.forEach(function (m) {
          html += '<option value="' + util.esc(m) + '">' + util.esc(m) + '</option>';
        });
        html += '</optgroup>';
      } else {
        SAGETI.listas.get('modelos').forEach(function (m) {
          html += '<option value="' + util.esc(m) + '">' + util.esc(m) + '</option>';
        });
      }
      // Modelo gravado que saiu da lista continua visível, para a edição de um
      // registro antigo não trocar o valor sem avisar.
      if (atual && html.indexOf('value="' + util.esc(atual) + '"') === -1) {
        html += '<option value="' + util.esc(atual) + '">' + util.esc(atual) +
                '  (fora da lista atual)</option>';
      }
      selModelo.innerHTML = html;
      if (atual) selModelo.value = atual;
    }

    selEquip.addEventListener('change', function () { repintar(false); });
    repintar(false);
    if (modeloInicial) {
      if (!Array.prototype.some.call(selModelo.options, function (o) { return o.value === modeloInicial; })) {
        var extra = document.createElement('option');
        extra.value = modeloInicial;
        extra.textContent = modeloInicial + '  (fora da lista atual)';
        selModelo.appendChild(extra);
      }
      selModelo.value = modeloInicial;
    }
    // Permite redesenhar após uma mudança nas listas.
    return repintar;
  }

  /**
   * Chip de status pronto (cor + rótulo — nunca só a cor).
   * A cor de fundo/ponto vem do mapa fino por status (SAGETI.statusCores,
   * uma cor por rótulo); a classe chip--tom-* fica só como retaguarda,
   * para status fora do mapa antes do statusCores.js terminar de carregar.
   */
  function chipStatus(status) {
    if (!status || status === '—') return '<span class="muted">—</span>';
    var meta = SAGETI.listas.statusMeta(status);
    var estilo = SAGETI.statusCores ? SAGETI.statusCores.estiloBadge(status) : null;
    var style = estilo
      ? ' style="background:' + estilo.background + ';border-color:' + estilo.borderColor + '"'
      : '';
    var dotStyle = estilo ? ' style="background:' + estilo.dot + '"' : '';
    return '<span class="chip chip--tom-' + (meta.tom || 'neutral') + '"' + style +
      (meta.desc ? ' title="' + util.esc(meta.desc) + '"' : '') + '>' +
      '<span class="chip__dot"' + dotStyle + '></span>' + util.esc(meta.valor) + '</span>';
  }

  function chipTipoMov(tipo) {
    var meta = SAGETI.tipoMovMeta(tipo);
    return '<span class="chip chip--' + meta.chip + '">' +
      '<span class="chip__dot"></span>' + util.esc(meta.rotulo) + '</span>';
  }

  /** TTR: verde quando concluído, âmbar quando pendente. Lista é livre. */
  function tagTTR(ttr) {
    if (!ttr) return '<span class="muted">—</span>';
    var classe = 'tag';
    if (/realizad/i.test(ttr)) classe += ' tag--ok';
    else if (/pendente/i.test(ttr)) classe += ' tag--pending';
    return '<span class="' + classe + '">' + util.esc(ttr) + '</span>';
  }

  /* ---------- Estado vazio / paginação ---------------------------------------- */

  function estadoVazio(titulo, texto, acaoHTML) {
    return '<div class="table-empty">' + icone('vazio', 38) +
      '<div class="table-empty__title">' + util.esc(titulo) + '</div>' +
      (texto ? '<div>' + util.esc(texto) + '</div>' : '') +
      (acaoHTML || '') + '</div>';
  }

  /**
   * Renderiza um paginador simples.
   * @returns {string} HTML dos botões (delegue o clique via [data-pagina]).
   */
  function paginador(paginaAtual, totalPaginas) {
    if (totalPaginas <= 1) return '';
    var html = '<div class="pager">';
    html += '<button type="button" data-pagina="' + (paginaAtual - 1) + '"' +
      (paginaAtual === 1 ? ' disabled' : '') + ' aria-label="Página anterior">‹</button>';

    var paginas = [];
    for (var i = 1; i <= totalPaginas; i++) {
      if (i === 1 || i === totalPaginas || Math.abs(i - paginaAtual) <= 1) paginas.push(i);
      else if (paginas[paginas.length - 1] !== '…') paginas.push('…');
    }
    paginas.forEach(function (p) {
      if (p === '…') html += '<button type="button" disabled>…</button>';
      else html += '<button type="button" data-pagina="' + p + '"' +
        (p === paginaAtual ? ' class="is-active" aria-current="page"' : '') + '>' + p + '</button>';
    });

    html += '<button type="button" data-pagina="' + (paginaAtual + 1) + '"' +
      (paginaAtual === totalPaginas ? ' disabled' : '') + ' aria-label="Próxima página">›</button>';
    return html + '</div>';
  }

  /* ---------- Tema ------------------------------------------------------------ */

  function temaAtual() {
    try { return localStorage.getItem(SAGETI.APP.themeKey) || 'light'; }
    catch (e) { return 'light'; }
  }

  function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    try { localStorage.setItem(SAGETI.APP.themeKey, tema); } catch (e) { /* ignora */ }
    // Os gráficos leem cores do CSS: precisam ser repintados na troca.
    if (SAGETI.charts && SAGETI.charts.repintarTodos) SAGETI.charts.repintarTodos();
  }

  function alternarTema() {
    aplicarTema(temaAtual() === 'dark' ? 'light' : 'dark');
    return temaAtual();
  }

  /* ---------- Validação de formulário ------------------------------------------ */

  /**
   * Valida campos obrigatórios marcados com [data-obrigatorio].
   * @returns {boolean} true se tudo válido.
   */
  function validarForm(form) {
    var ok = true;
    form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('has-error'); });

    form.querySelectorAll('[data-obrigatorio]').forEach(function (campo) {
      if (!String(campo.value || '').trim()) {
        var wrap = campo.closest('.field');
        if (wrap) wrap.classList.add('has-error');
        if (ok) campo.focus();
        ok = false;
      }
    });
    return ok;
  }

  /** Marca um campo específico como inválido com mensagem. */
  function marcarErro(campo, mensagem) {
    var wrap = campo.closest('.field');
    if (!wrap) return;
    wrap.classList.add('has-error');
    var alvo = wrap.querySelector('.field__error');
    if (alvo && mensagem) alvo.textContent = mensagem;
    campo.focus();
  }

  /** Lê um <form> como objeto simples. */
  function dadosForm(form) {
    var out = {};
    new FormData(form).forEach(function (v, k) { out[k] = typeof v === 'string' ? v.trim() : v; });
    return out;
  }

  SAGETI.ui = {
    icone: icone,
    toast: toast,
    modal: modal,
    fecharModal: fecharModal,
    confirmar: confirmar,
    opcoes: opcoes,
    opcoesCom: opcoesCom,
    selectGerenciavel: selectGerenciavel,
    repintarSelect: repintarSelect,
    ligarEquipamentoModelo: ligarEquipamentoModelo,
    chipStatus: chipStatus,
    chipTipoMov: chipTipoMov,
    tagTTR: tagTTR,
    estadoVazio: estadoVazio,
    paginador: paginador,
    temaAtual: temaAtual,
    aplicarTema: aplicarTema,
    alternarTema: alternarTema,
    validarForm: validarForm,
    marcarErro: marcarErro,
    dadosForm: dadosForm
  };

})(window.SAGETI);
