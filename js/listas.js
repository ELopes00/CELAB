/* ==========================================================================
   SAGE-TI — Listas editáveis (Status, TTR, Setores, Técnicos, Modelos…)
   --------------------------------------------------------------------------
   Nenhuma lista de seleção é fixa no código. Tudo o que aparece em um <select>
   vem daqui, é gravado no navegador e pode ser criado, renomeado, reordenado
   ou removido pela interface (Configurações → Listas).

   Regras que este módulo garante:
     · rótulo é a chave — nada de duplicado (comparação sem acento/caixa);
     · renomear uma opção reescreve os registros que a usavam, para o
       histórico não ficar apontando para um rótulo que não existe mais;
     · excluir uma opção em uso é bloqueado, com a contagem de registros;
     · novas opções de fábrica entram em bases antigas sem apagar as
       customizações do usuário (merge por rótulo na inicialização).
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  var KEY = SAGETI.APP.listasKey;

  var listas = null;         // estado em memória
  var ouvintes = [];
  var canal = null;

  /* ---------- Comparação tolerante ----------------------------------------- */

  function chave(texto) {
    return String(texto == null ? '' : texto)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim().toLowerCase();
  }

  function normalizar(texto) {
    return String(texto == null ? '' : texto).replace(/\s+/g, ' ').trim();
  }

  /** Índice do rótulo numa lista de textos, ignorando acento e caixa. */
  function indiceTexto(lista, valor) {
    var k = chave(valor);
    for (var i = 0; i < lista.length; i++) {
      if (chave(lista[i]) === k) return i;
    }
    return -1;
  }

  function indiceStatus(lista, valor) {
    var k = chave(valor);
    for (var i = 0; i < lista.length; i++) {
      if (chave(lista[i].valor) === k) return i;
    }
    return -1;
  }

  /* ---------- Persistência -------------------------------------------------- */

  function gravar() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(listas));
    } catch (e) {
      console.warn('[SAGE-TI] Não foi possível gravar as listas:', e);
    }
  }

  function ler() {
    try {
      var bruto = window.localStorage.getItem(KEY);
      return bruto ? JSON.parse(bruto) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Incorpora opções de fábrica que ainda não existem na base do usuário,
   * preservando tudo o que ele já customizou. É isto que faz uma atualização
   * do sistema trazer status novos sem sobrescrever as listas em uso.
   */
  function mesclarPadroes(atual) {
    var padrao = SAGETI.listasPadrao();
    var novidades = 0;

    ['ttrEntrada', 'ttrSaida', 'equipamentos', 'modelos', 'predios', 'setores', 'tecnicos']
      .forEach(function (nome) {
        if (!Array.isArray(atual[nome])) { atual[nome] = padrao[nome].slice(); novidades += atual[nome].length; return; }
        padrao[nome].forEach(function (item) {
          if (indiceTexto(atual[nome], item) === -1) { atual[nome].push(item); novidades++; }
        });
      });

    if (!Array.isArray(atual.status)) atual.status = [];
    padrao.status.forEach(function (s) {
      var i = indiceStatus(atual.status, s.valor);
      if (i === -1) {
        atual.status.push(Object.assign({}, s, { contextos: s.contextos.slice() }));
        novidades++;
      } else {
        // Contextos de fábrica são acrescentados; o resto o usuário manda.
        var alvo = atual.status[i];
        if (!Array.isArray(alvo.contextos)) alvo.contextos = [];
        s.contextos.forEach(function (c) {
          if (alvo.contextos.indexOf(c) === -1) alvo.contextos.push(c);
        });
        if (!alvo.tom) alvo.tom = s.tom;
        if (typeof alvo.noLab !== 'boolean') alvo.noLab = s.noLab;
      }
    });

    if (!atual.modelosPorEquipamento || typeof atual.modelosPorEquipamento !== 'object') {
      atual.modelosPorEquipamento = padrao.modelosPorEquipamento;
    } else {
      Object.keys(padrao.modelosPorEquipamento).forEach(function (cat) {
        if (!Array.isArray(atual.modelosPorEquipamento[cat])) {
          atual.modelosPorEquipamento[cat] = padrao.modelosPorEquipamento[cat].slice();
        }
      });
    }

    return novidades;
  }

  function inicializar() {
    var salvo = ler();
    if (salvo) {
      listas = salvo;
      var novas = mesclarPadroes(listas);
      if (novas) gravar();
    } else {
      listas = SAGETI.listasPadrao();
      gravar();
    }
    iniciarRealtime();
    return listas;
  }

  /* ---------- Notificação e sincronização entre abas ------------------------ */

  function emitir(evento) {
    gravar();
    var det = evento || { tipo: 'listas' };
    ouvintes.forEach(function (fn) {
      try { fn(det, listas); } catch (e) { console.error(e); }
    });
    if (canal) {
      try { canal.postMessage({ tipo: 'listas', evento: det }); } catch (e) { /* ignora */ }
    }
    // Páginas que desenham selects reagem ao store; um sync mantém tudo junto.
    if (SAGETI.store && SAGETI.store.notificarListas) SAGETI.store.notificarListas(det);
  }

  function assinar(fn) {
    ouvintes.push(fn);
    return function () {
      var i = ouvintes.indexOf(fn);
      if (i > -1) ouvintes.splice(i, 1);
    };
  }

  function iniciarRealtime() {
    if (!('BroadcastChannel' in window)) return;
    try {
      canal = new BroadcastChannel(SAGETI.APP.channel + '-listas');
      canal.onmessage = function () {
        var salvo = ler();
        if (!salvo) return;
        listas = salvo;
        ouvintes.forEach(function (fn) {
          try { fn({ tipo: 'listas', externo: true }, listas); } catch (e) { console.error(e); }
        });
        if (SAGETI.store && SAGETI.store.notificarListas) {
          SAGETI.store.notificarListas({ tipo: 'listas', externo: true });
        }
      };
    } catch (e) { canal = null; }
  }

  /* ---------- Leitura ------------------------------------------------------- */

  /** Lista de textos (ou de objetos, no caso de 'status'). */
  function get(nome) {
    if (!listas) inicializar();
    var v = listas[nome];
    if (!v) return [];
    return Array.isArray(v) ? v.slice() : v;
  }

  /** Rótulos de status válidos para um contexto: 'entrada' | 'saida' | 'estoque'. */
  function statusDe(contexto) {
    return get('status')
      .filter(function (s) { return !contexto || (s.contextos || []).indexOf(contexto) > -1; })
      .map(function (s) { return s.valor; });
  }

  /** Todos os rótulos de status, para filtros. */
  function statusTodos() {
    return get('status').map(function (s) { return s.valor; });
  }

  /** Metadados de um status; devolve um neutro seguro se não existir. */
  function statusMeta(valor) {
    var i = indiceStatus(get('status'), valor);
    if (i === -1) {
      return { valor: valor || '—', tom: 'neutral', noLab: false, contextos: [], desc: '' };
    }
    return listas.status[i];
  }

  /** Rótulos cujo padrão é "permanece no laboratório". */
  function statusNoLab() {
    return get('status').filter(function (s) { return s.noLab; }).map(function (s) { return s.valor; });
  }

  /** TTR do contexto pedido. */
  function ttrDe(contexto) {
    return get(contexto === 'saida' ? 'ttrSaida' : 'ttrEntrada');
  }

  /** Modelos sugeridos para a categoria + o restante em "outros". */
  function modelosDe(equipamento) {
    var todos = get('modelos');
    var mapa = (listas && listas.modelosPorEquipamento) || {};
    var sugeridos = (mapa[equipamento] || []).filter(function (m) {
      return indiceTexto(todos, m) > -1;
    });
    var resto = todos.filter(function (m) { return indiceTexto(sugeridos, m) === -1; });
    return { sugeridos: sugeridos, outros: resto };
  }

  /** Categoria registrada para um modelo (ou '' se não houver). */
  function equipamentoDoModelo(modelo) {
    var mapa = (listas && listas.modelosPorEquipamento) || {};
    var achado = '';
    Object.keys(mapa).some(function (cat) {
      if (indiceTexto(mapa[cat] || [], modelo) > -1) { achado = cat; return true; }
      return false;
    });
    return achado;
  }

  /* ---------- Onde cada lista é usada nos registros ------------------------- */

  /* Campos do equipamento e da movimentação que guardam valores de cada lista.
     Alimenta a contagem de uso e a reescrita ao renomear. */
  var USO = {
    status:       { eq: ['status'],                         mov: ['statusAnterior', 'statusResultante'] },
    equipamentos: { eq: ['equipamento'],                    mov: ['equipamento'] },
    modelos:      { eq: ['modelo'],                         mov: ['modelo'] },
    predios:      { eq: ['predioOrigem', 'predioDestino'],  mov: ['predio'] },
    setores:      { eq: ['setorOrigem', 'setorDestino'],    mov: ['setor'] },
    tecnicos:     { eq: ['tecnico'],                        mov: ['tecnico'] },
    ttrEntrada:   { eq: ['ttr'],                            mov: ['ttr'] },
    ttrSaida:     { eq: ['ttr'],                            mov: ['ttr'] }
  };

  /** Quantos registros usam este valor. */
  function contarUso(nome, valor) {
    var campos = USO[nome];
    if (!campos || !SAGETI.store) return { equipamentos: 0, movimentacoes: 0, total: 0 };
    var k = chave(valor);

    var eqs = SAGETI.store.listarEquipamentos().filter(function (e) {
      return campos.eq.some(function (c) { return chave(e[c]) === k; });
    }).length;

    var movs = SAGETI.store.listarMovimentacoes().filter(function (m) {
      return campos.mov.some(function (c) { return chave(m[c]) === k; });
    }).length;

    return { equipamentos: eqs, movimentacoes: movs, total: eqs + movs };
  }

  /** Reescreve o valor antigo pelo novo em todos os registros. */
  function reescreverUso(nome, de, para) {
    var campos = USO[nome];
    if (!campos || !SAGETI.store) return 0;
    var k = chave(de);
    var n = 0;

    SAGETI.store.listarEquipamentos().forEach(function (e) {
      campos.eq.forEach(function (c) {
        if (chave(e[c]) === k) { SAGETI.store._setCampoEquipamento(e.id, c, para); n++; }
      });
    });
    SAGETI.store.listarMovimentacoes().forEach(function (m) {
      campos.mov.forEach(function (c) {
        if (chave(m[c]) === k) { SAGETI.store._setCampoMovimentacao(m.id, c, para); n++; }
      });
    });
    return n;
  }

  /* ---------- Escrita: listas de texto -------------------------------------- */

  function adicionar(nome, valor, extra) {
    if (nome === 'status') return adicionarStatus(valor, extra);

    var v = normalizar(valor);
    if (!v) return { ok: false, erro: 'Informe um nome.' };
    if (!listas) inicializar();
    if (!Array.isArray(listas[nome])) return { ok: false, erro: 'Lista desconhecida: ' + nome + '.' };
    if (indiceTexto(listas[nome], v) > -1) {
      return { ok: false, erro: '"' + v + '" já está na lista.' };
    }

    listas[nome].push(v);
    listas[nome].sort(function (a, b) { return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }); });

    if (nome === 'modelos' && extra && extra.equipamento) {
      vincularModelo(v, extra.equipamento);
    }
    emitir({ tipo: 'lista:add', lista: nome, valor: v });
    return { ok: true, valor: v };
  }

  function renomear(nome, de, para) {
    if (nome === 'status') return renomearStatus(de, para);

    var novo = normalizar(para);
    if (!novo) return { ok: false, erro: 'Informe um nome.' };
    if (!listas) inicializar();

    var i = indiceTexto(listas[nome], de);
    if (i === -1) return { ok: false, erro: 'Opção não encontrada.' };

    var colisao = indiceTexto(listas[nome], novo);
    if (colisao > -1 && colisao !== i) {
      return { ok: false, erro: '"' + novo + '" já está na lista.' };
    }

    var antigo = listas[nome][i];
    listas[nome][i] = novo;
    listas[nome].sort(function (a, b) { return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }); });

    if (nome === 'modelos') {
      Object.keys(listas.modelosPorEquipamento || {}).forEach(function (cat) {
        var j = indiceTexto(listas.modelosPorEquipamento[cat], antigo);
        if (j > -1) listas.modelosPorEquipamento[cat][j] = novo;
      });
    }
    if (nome === 'equipamentos' && listas.modelosPorEquipamento &&
        listas.modelosPorEquipamento[antigo]) {
      listas.modelosPorEquipamento[novo] = listas.modelosPorEquipamento[antigo];
      delete listas.modelosPorEquipamento[antigo];
    }

    // Mantém os registros coerentes com o novo rótulo.
    var afetados = reescreverUso(nome, antigo, novo);
    emitir({ tipo: 'lista:rename', lista: nome, de: antigo, para: novo, afetados: afetados });
    return { ok: true, valor: novo, afetados: afetados };
  }

  function excluir(nome, valor, opcoes) {
    if (nome === 'status') return excluirStatus(valor, opcoes);
    if (!listas) inicializar();

    var i = indiceTexto(listas[nome], valor);
    if (i === -1) return { ok: false, erro: 'Opção não encontrada.' };

    var uso = contarUso(nome, listas[nome][i]);
    if (uso.total > 0 && !(opcoes && opcoes.forcar)) {
      return {
        ok: false, emUso: true, uso: uso,
        erro: '"' + listas[nome][i] + '" está em uso: ' + uso.equipamentos +
              ' equipamento(s) e ' + uso.movimentacoes + ' movimentação(ões).'
      };
    }

    var removido = listas[nome].splice(i, 1)[0];

    if (nome === 'modelos') {
      Object.keys(listas.modelosPorEquipamento || {}).forEach(function (cat) {
        var j = indiceTexto(listas.modelosPorEquipamento[cat], removido);
        if (j > -1) listas.modelosPorEquipamento[cat].splice(j, 1);
      });
    }
    if (nome === 'equipamentos' && listas.modelosPorEquipamento) {
      delete listas.modelosPorEquipamento[removido];
    }

    emitir({ tipo: 'lista:del', lista: nome, valor: removido });
    return { ok: true, valor: removido };
  }

  /* ---------- Escrita: status ------------------------------------------------ */

  function adicionarStatus(valor, extra) {
    var v = normalizar(valor);
    if (!v) return { ok: false, erro: 'Informe um nome.' };
    if (!listas) inicializar();
    if (indiceStatus(listas.status, v) > -1) {
      return { ok: false, erro: 'O status "' + v + '" já existe.' };
    }

    var ctx = (extra && extra.contextos) || ['entrada'];
    if (!ctx.length) return { ok: false, erro: 'Escolha ao menos um formulário onde o status aparece.' };

    listas.status.push({
      valor: v,
      tom: (extra && extra.tom) || 'neutral',
      noLab: extra && typeof extra.noLab === 'boolean' ? extra.noLab : true,
      contextos: ctx.slice(),
      desc: (extra && normalizar(extra.desc)) || ''
    });

    emitir({ tipo: 'lista:add', lista: 'status', valor: v });
    return { ok: true, valor: v };
  }

  /** Atualiza rótulo e/ou metadados de um status. */
  function atualizarStatus(de, mudancas) {
    if (!listas) inicializar();
    var i = indiceStatus(listas.status, de);
    if (i === -1) return { ok: false, erro: 'Status não encontrado.' };

    var alvo = listas.status[i];
    var antigo = alvo.valor;
    var afetados = 0;

    if (mudancas.valor != null) {
      var novo = normalizar(mudancas.valor);
      if (!novo) return { ok: false, erro: 'Informe um nome.' };
      var colisao = indiceStatus(listas.status, novo);
      if (colisao > -1 && colisao !== i) {
        return { ok: false, erro: 'O status "' + novo + '" já existe.' };
      }
      if (chave(novo) !== chave(antigo)) {
        alvo.valor = novo;
        afetados = reescreverUso('status', antigo, novo);
      } else {
        alvo.valor = novo; // só mudou acento ou caixa
      }
    }

    if (mudancas.tom) alvo.tom = mudancas.tom;
    if (typeof mudancas.noLab === 'boolean') alvo.noLab = mudancas.noLab;
    if (mudancas.desc != null) alvo.desc = normalizar(mudancas.desc);
    if (Array.isArray(mudancas.contextos)) {
      if (!mudancas.contextos.length) {
        return { ok: false, erro: 'Escolha ao menos um formulário onde o status aparece.' };
      }
      alvo.contextos = mudancas.contextos.slice();
    }

    emitir({ tipo: 'lista:update', lista: 'status', valor: alvo.valor, afetados: afetados });
    return { ok: true, valor: alvo.valor, afetados: afetados };
  }

  function renomearStatus(de, para) {
    return atualizarStatus(de, { valor: para });
  }

  function excluirStatus(valor, opcoes) {
    if (!listas) inicializar();
    var i = indiceStatus(listas.status, valor);
    if (i === -1) return { ok: false, erro: 'Status não encontrado.' };

    var uso = contarUso('status', listas.status[i].valor);
    if (uso.total > 0 && !(opcoes && opcoes.forcar)) {
      return {
        ok: false, emUso: true, uso: uso,
        erro: 'O status "' + listas.status[i].valor + '" está em uso: ' +
              uso.equipamentos + ' equipamento(s) e ' + uso.movimentacoes + ' movimentação(ões).'
      };
    }
    if (listas.status.length <= 1) {
      return { ok: false, erro: 'É preciso manter ao menos um status.' };
    }

    var removido = listas.status.splice(i, 1)[0];
    emitir({ tipo: 'lista:del', lista: 'status', valor: removido.valor });
    return { ok: true, valor: removido.valor };
  }

  /* ---------- Modelos × categoria -------------------------------------------- */

  function vincularModelo(modelo, equipamento) {
    if (!listas) inicializar();
    if (!listas.modelosPorEquipamento) listas.modelosPorEquipamento = {};

    // Um modelo pertence a uma categoria só: retira das outras.
    Object.keys(listas.modelosPorEquipamento).forEach(function (cat) {
      var j = indiceTexto(listas.modelosPorEquipamento[cat], modelo);
      if (j > -1) listas.modelosPorEquipamento[cat].splice(j, 1);
    });

    if (equipamento) {
      if (!Array.isArray(listas.modelosPorEquipamento[equipamento])) {
        listas.modelosPorEquipamento[equipamento] = [];
      }
      if (indiceTexto(listas.modelosPorEquipamento[equipamento], modelo) === -1) {
        listas.modelosPorEquipamento[equipamento].push(modelo);
      }
    }
    emitir({ tipo: 'lista:vinculo', lista: 'modelos', valor: modelo, equipamento: equipamento });
    return { ok: true };
  }

  /* ---------- Garantia de existência (usada pela importação) ----------------- */

  /**
   * Devolve o rótulo canônico da lista para `valor`, criando a opção se ela
   * não existir e `criar` for true. Sem isso, uma planilha com um setor novo
   * geraria um registro apontando para uma opção inexistente.
   */
  function garantir(nome, valor, criar) {
    var v = normalizar(valor);
    if (!v) return { valor: '', criado: false };
    if (!listas) inicializar();

    if (nome === 'status') {
      var i = indiceStatus(listas.status, v);
      if (i > -1) return { valor: listas.status[i].valor, criado: false };
      if (!criar) return { valor: '', criado: false };
      adicionarStatus(v, { tom: 'neutral', noLab: true, contextos: ['entrada', 'estoque', 'saida'] });
      return { valor: v, criado: true };
    }

    var lista = listas[nome];
    if (!Array.isArray(lista)) return { valor: '', criado: false };
    var j = indiceTexto(lista, v);
    if (j > -1) return { valor: lista[j], criado: false };
    if (!criar) return { valor: '', criado: false };

    lista.push(v);
    lista.sort(function (a, b) { return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }); });
    return { valor: v, criado: true };
  }

  /** Confirma as criações feitas por `garantir` em lote. */
  function confirmarGarantias() {
    emitir({ tipo: 'lista:lote' });
  }

  /* ---------- Manutenção ----------------------------------------------------- */

  function restaurarPadrao(nome) {
    if (!listas) inicializar();
    var padrao = SAGETI.listasPadrao();

    if (!nome) {
      listas = padrao;
      emitir({ tipo: 'lista:reset' });
      return { ok: true, lista: 'todas' };
    }
    if (padrao[nome] === undefined) return { ok: false, erro: 'Lista desconhecida.' };

    listas[nome] = padrao[nome];
    if (nome === 'modelos' || nome === 'equipamentos') {
      listas.modelosPorEquipamento = padrao.modelosPorEquipamento;
    }
    emitir({ tipo: 'lista:reset', lista: nome });
    return { ok: true, lista: nome };
  }

  function exportarJSON() {
    if (!listas) inicializar();
    return JSON.stringify({
      app: SAGETI.APP.nome, versao: SAGETI.APP.versao,
      exportadoEm: new Date().toISOString(), listas: listas
    }, null, 2);
  }

  function importarJSON(texto) {
    var dados;
    try { dados = JSON.parse(texto); } catch (e) { return { ok: false, erro: 'Arquivo JSON inválido.' }; }
    var alvo = dados.listas || dados;
    if (!alvo || (!alvo.status && !alvo.setores)) {
      return { ok: false, erro: 'O arquivo não contém listas do SAGE-TI.' };
    }
    listas = alvo;
    mesclarPadroes(listas);
    emitir({ tipo: 'lista:import' });
    return { ok: true };
  }

  /** Contagem de itens por lista, para o painel de configurações. */
  function resumo() {
    if (!listas) inicializar();
    return SAGETI.CATALOGO_LISTAS.map(function (c) {
      return { chave: c.chave, rotulo: c.rotulo, tipo: c.tipo, total: (listas[c.chave] || []).length };
    });
  }

  SAGETI.listas = {
    inicializar: inicializar,
    assinar: assinar,
    get: get,

    statusDe: statusDe,
    statusTodos: statusTodos,
    statusMeta: statusMeta,
    statusNoLab: statusNoLab,
    ttrDe: ttrDe,
    modelosDe: modelosDe,
    equipamentoDoModelo: equipamentoDoModelo,

    adicionar: adicionar,
    renomear: renomear,
    excluir: excluir,
    atualizarStatus: atualizarStatus,
    vincularModelo: vincularModelo,

    garantir: garantir,
    confirmarGarantias: confirmarGarantias,
    contarUso: contarUso,

    restaurarPadrao: restaurarPadrao,
    exportarJSON: exportarJSON,
    importarJSON: importarJSON,
    resumo: resumo,

    _chave: chave
  };

  /* ---------- Compatibilidade -----------------------------------------------
     Acessos antigos (SAGETI.EQUIPAMENTOS, SAGETI.statusMeta…) continuam
     funcionando, agora lendo das listas dinâmicas.
     ---------------------------------------------------------------------- */

  function definirLeitura(nome, fn) {
    Object.defineProperty(SAGETI, nome, { get: fn, configurable: true });
  }

  definirLeitura('EQUIPAMENTOS', function () { return get('equipamentos'); });
  definirLeitura('MODELOS',      function () { return get('modelos'); });
  definirLeitura('PREDIOS',      function () { return get('predios'); });
  definirLeitura('SETORES',      function () { return get('setores'); });
  definirLeitura('TECNICOS',     function () { return get('tecnicos'); });
  definirLeitura('STATUS',       function () { return get('status'); });
  definirLeitura('STATUS_TODOS', function () { return statusTodos(); });
  definirLeitura('STATUS_NO_LAB', function () { return statusNoLab(); });
  definirLeitura('STATUS_ENTRADA', function () { return statusDe('entrada'); });
  definirLeitura('STATUS_SAIDA',   function () { return statusDe('saida'); });
  definirLeitura('STATUS_ESTOQUE', function () { return statusDe('estoque'); });
  definirLeitura('TTR',            function () { return ttrDe('entrada'); });
  definirLeitura('MODELOS_POR_EQUIPAMENTO', function () {
    return (listas && listas.modelosPorEquipamento) || {};
  });

  SAGETI.statusMeta = statusMeta;
  SAGETI.modelosDe = modelosDe;

  SAGETI.TIPOS_MOV = [
    { valor: 'ENTRADA',  rotulo: 'Entrada',   chip: 'entrada' },
    { valor: 'SAIDA',    rotulo: 'Saída',     chip: 'saida' },
    { valor: 'CADASTRO', rotulo: 'Cadastro',  chip: 'ajuste' },
    { valor: 'AJUSTE',   rotulo: 'Alteração', chip: 'ajuste' },
    { valor: 'EXCLUSAO', rotulo: 'Exclusão',  chip: 'ajuste' },
    { valor: 'IMPORTACAO', rotulo: 'Importação', chip: 'ajuste' }
  ];

  SAGETI.tipoMovMeta = function (valor) {
    return SAGETI.TIPOS_MOV.find(function (t) { return t.valor === valor; }) ||
      { valor: valor, rotulo: valor, chip: 'ajuste' };
  };

})(window.SAGETI);
