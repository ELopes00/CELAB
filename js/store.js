/* ==========================================================================
   SAGE-TI — Store: estado global, persistência e regras de negócio
   --------------------------------------------------------------------------
   Fonte única da verdade. Toda mutação passa por aqui e dispara `emit()`,
   que notifica (a) os assinantes desta aba e (b) as outras abas abertas via
   BroadcastChannel — é isso que faz Dashboard, Estoque e Relatórios se
   atualizarem no mesmo instante em que uma entrada ou saída é salva.

   PRESENÇA FÍSICA: cada equipamento carrega `noLaboratorio` (booleano). Quem
   define é a operação — entrada põe true, saída põe false, edição no estoque
   usa o padrão do status. A Dashboard lê esse campo e nunca precisa
   interpretar o texto do status, que é livre e editável pelo usuário.
   ========================================================================== */

(function (SAGETI) {
  'use strict';

  var KEY = SAGETI.APP.storageKey;

  /* ---------- Utilitários -------------------------------------------------- */

  function uid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function agora() { return new Date().toISOString(); }
  function hoje() { return new Date().toISOString().slice(0, 10); }

  function norm(v) { return String(v == null ? '' : v).trim(); }

  /** Chave de identidade do equipamento: tombo novo, senão tombo antigo. */
  function chaveTombo(reg) {
    var n = norm(reg.tomboNovo).toUpperCase();
    if (n) return 'N:' + n;
    var a = norm(reg.tomboAntigo).toUpperCase();
    if (a) return 'A:' + a;
    return '';
  }

  /** Presença física padrão de um status (usada só na edição pelo Estoque). */
  function noLabDoStatus(status) {
    var meta = SAGETI.listas.statusMeta(status);
    return meta ? !!meta.noLab : true;
  }

  /* ---------- Estado ------------------------------------------------------- */

  var estado = {
    equipamentos: [],
    movimentacoes: [],
    usuarios: [],
    meta: { criadoEm: null, versao: 2 }
  };

  var ouvintes = [];
  var canal = null;
  var salvarPendente = null;
  var origemLocal = uid();

  /* ---------- Persistência ------------------------------------------------- */

  function podeUsarLocalStorage() {
    try {
      var t = '__celab_test__';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return true;
    } catch (e) { return false; }
  }

  var temLS = podeUsarLocalStorage();
  var memoria = null;

  function ler() {
    if (!temLS) return memoria;
    try {
      var bruto = window.localStorage.getItem(KEY);
      return bruto ? JSON.parse(bruto) : null;
    } catch (e) {
      console.warn('[SAGE-TI] Falha ao ler o armazenamento local:', e);
      return null;
    }
  }

  function gravar() {
    var payload = JSON.stringify(estado);
    if (!temLS) { memoria = JSON.parse(payload); return; }
    try {
      window.localStorage.setItem(KEY, payload);
    } catch (e) {
      console.error('[SAGE-TI] Falha ao gravar (cota excedida?):', e);
      if (SAGETI.ui && SAGETI.ui.toast) {
        SAGETI.ui.toast('error', 'Falha ao salvar',
          'O navegador recusou a gravação local. Exporte os dados para não perdê-los.');
      }
    }
  }

  function agendarGravacao() {
    if (salvarPendente) clearTimeout(salvarPendente);
    salvarPendente = setTimeout(function () { salvarPendente = null; gravar(); }, 120);
  }

  /* ---------- Pub/sub + realtime entre abas -------------------------------- */

  function emit(evento) {
    agendarGravacao();
    var detalhe = evento || { tipo: 'sync' };
    ouvintes.forEach(function (fn) {
      try { fn(detalhe, estado); } catch (e) { console.error('[SAGE-TI] Erro em ouvinte:', e); }
    });
    if (canal) {
      try { canal.postMessage({ origem: origemLocal, evento: detalhe }); } catch (e) { /* ignora */ }
    }
  }

  function assinar(fn) {
    ouvintes.push(fn);
    return function cancelar() {
      var i = ouvintes.indexOf(fn);
      if (i > -1) ouvintes.splice(i, 1);
    };
  }

  /** Mudança nas listas: as páginas precisam redesenhar seus selects. */
  function notificarListas(evento) {
    ouvintes.forEach(function (fn) {
      try { fn(Object.assign({ tipo: 'listas' }, evento), estado); } catch (e) { console.error(e); }
    });
  }

  function recarregarDeFora(evento) {
    var dados = ler();
    if (dados) {
      estado.equipamentos = dados.equipamentos || [];
      estado.movimentacoes = dados.movimentacoes || [];
      estado.usuarios = dados.usuarios || [];
      estado.meta = dados.meta || estado.meta;
    }
    ouvintes.forEach(function (fn) {
      try { fn(evento || { tipo: 'sync', externo: true }, estado); } catch (e) { console.error(e); }
    });
  }

  function iniciarRealtime() {
    if ('BroadcastChannel' in window) {
      try {
        canal = new BroadcastChannel(SAGETI.APP.channel);
        canal.onmessage = function (msg) {
          var d = msg.data || {};
          if (d.origem === origemLocal) return;
          recarregarDeFora(Object.assign({ externo: true }, d.evento));
        };
      } catch (e) { canal = null; }
    }
    window.addEventListener('storage', function (e) {
      if (e.key !== KEY) return;
      recarregarDeFora({ tipo: 'sync', externo: true });
    });
  }

  /* ---------- Migração ----------------------------------------------------- */

  /**
   * Ajusta registros gravados por versões anteriores:
   *   · `noLaboratorio` deduzido do status;
   *   · campos novos (`tecnico`) criados vazios.
   */
  function migrar() {
    var mudou = 0;
    estado.equipamentos.forEach(function (e) {
      if (typeof e.noLaboratorio !== 'boolean') {
        // Regra antiga: "Disponibilizado" era o único status fora do laboratório.
        e.noLaboratorio = e.status !== 'Disponibilizado';
        mudou++;
      }
      if (e.tecnico === undefined) { e.tecnico = ''; mudou++; }
      if (e.motivo === undefined) { e.motivo = ''; mudou++; }
    });
    estado.movimentacoes.forEach(function (m) {
      if (m.tecnico === undefined) { m.tecnico = ''; mudou++; }
    });
    // Rebranding CELAB -> SAGE-TI: corrige o nome do admin gravado por uma
    // carga anterior à mudança. Só troca o valor de fábrica antigo — se o
    // admin já renomeou a própria conta, o nome escolhido é preservado.
    estado.usuarios.forEach(function (u) {
      if (u.nome === 'Administrador CELAB') { u.nome = 'Administrador SAGE-TI'; mudou++; }
    });
    if (mudou) { estado.meta.versao = 2; gravar(); }
    return mudou;
  }

  /* ---------- Seed inicial ------------------------------------------------- */

  // Variável de credencial

  function usuariosPadrao() {
    var cred = SAGETI.CREDENCIAIS;
    return [
      { id: uid(), usuario: cred.admin.usuario,   senha: cred.admin.senha,   
        nome: 'Administrador SAGE-TI',    perfil: 'admin',   criadoEm: agora() },
      { id: uid(), usuario: cred.tecnico.usuario, senha: cred.tecnico.senha, 
        nome: 'Técnico de Laboratório', perfil: 'tecnico', criadoEm: agora() }
    ];
  }

  function seedDemo() {
    var base = new Date();
    function diasAtras(n) {
      return new Date(base.getTime() - n * 86400000).toISOString().slice(0, 10);
    }
    var demo = [
      { cat: 'Monitor',    mod: 'LG 24BL550J-B',           tn: '045112', ta: '11233', st: 'Entrada de Estoque',   pr: 'Sede Administrativa', se: 'STI - Secretaria de Tecnologia da Informação', dias: 12 },
      { cat: 'Monitor',    mod: 'HP P22A G4',              tn: '045118', ta: '',      st: 'Estoque',              pr: 'Forum Civel',         se: '1CIR - 1ª Vara Cível Residual', dias: 10 },
      { cat: 'Monitor',    mod: 'Positivo 22MP55PY',       tn: '045230', ta: '10877', st: 'Devolucao Defeito',    pr: 'Palácio',             se: 'PR – Presidência', dias: 9 },
      { cat: 'Computador', mod: 'Lenovo ThinkCentre M75q', tn: '046001', ta: '',      st: 'Estoque',              pr: 'Sede Administrativa', se: 'SUBSI - Subsecretaria de Sistemas', dias: 8 },
      { cat: 'Computador', mod: 'Positivo Master 820',     tn: '046010', ta: '09912', st: 'Manutenção',           pr: 'Forum Criminal',      se: '2° Vara Criminal', dias: 7 },
      { cat: 'Computador', mod: 'Positivo Minipro 810',    tn: '046022', ta: '',      st: 'Manutenção',           pr: 'CB - Comarca de Bonfim', se: 'CB - Comarca de Bonfim', dias: 6 },
      { cat: 'Impressora', mod: 'HP Pro M404DW',           tn: '047300', ta: '08820', st: 'Devolução',            pr: 'Forum Civel',         se: 'SPAPCIVEL - Setor de Primeiro Atendimento e Protocolo Cível', dias: 6 },
      { cat: 'Impressora', mod: 'OKI 5112',                tn: '047311', ta: '',      st: 'Leilão',               pr: 'AG - Arquivo Geral',  se: 'SARG - Setor de Arquivo Geral', dias: 5 },
      { cat: 'Nobreak',    mod: 'Ragtech Easy Way 1200',   tn: '048500', ta: '07741', st: 'Estoque',              pr: 'Sede Administrativa', se: 'SUBINF - Subsecretaria de Infraestrutura de TIC', dias: 5 },
      { cat: 'Nobreak',    mod: 'Ragtech Easy Way 1200',   tn: '048501', ta: '',      st: 'Defeito',              pr: 'NUPAC',               se: 'NUPAC - Núcleo Plantão Judicial e Audiências de Custódia', dias: 4 },
      { cat: 'Notebook',   mod: 'Positivo N6440',          tn: '049100', ta: '',      st: 'Devolução Empréstimo', pr: 'Vara Infancia e Juventude', se: 'SUVIJ - Secretaria Unificada das Varas da Infância e Juventude', dias: 4 },
      { cat: 'Scanner',    mod: 'Kodak ScanMate i1150',    tn: '050220', ta: '06630', st: 'Estoque',              pr: 'Forum Civel',         se: 'SDCRIM - Setor de Distribuição Criminal', dias: 3 },
      { cat: 'Scanner',    mod: 'Avision AD345G',          tn: '050231', ta: '',      st: 'Manutenção',           pr: 'CC - Comarca de Caracarai', se: 'CC - Comarca de Caracaraí', dias: 3 },
      { cat: 'Headset',    mod: 'Logitech',                tn: '051010', ta: '',      st: 'Estoque',              pr: 'NCTC - Nucleo de Conciliacao do Terminal do Centro', se: 'CEJUSCS - Centros Judiciários de Soluções de Conflitos', dias: 2 },
      { cat: 'Webcam',     mod: 'Logitech C925e',          tn: '051500', ta: '',      st: 'Estoque',              pr: 'Casa da Mulher Brasileira', se: 'Casa da Mulher Brasileira', dias: 2 },
      { cat: 'HDMI',       mod: 'HDMI - 10M',              tn: '052001', ta: '',      st: 'Estoque',              pr: 'Conj. Desembargadores', se: 'TP - Tribunal Pleno', dias: 2 },
      { cat: 'Projetor Multimidia', mod: 'EPSON POWERLITE X29', tn: '053000', ta: '05512', st: 'Devolução Eq. Obsoleto', pr: 'Palácio', se: 'EJURR - Escola do Poder Judiciário', dias: 1 },
      { cat: 'Eq. Video Conf.', mod: 'GoPresence Teams 10x', tn: '054000', ta: '',    st: 'Estoque',              pr: 'Sede Administrativa', se: 'SG - Secretaria Geral', dias: 1 }
    ];

    var ttr = SAGETI.listas.ttrDe('entrada');
    demo.forEach(function (d, i) {
      registrarEntrada({
        dataEntrada: diasAtras(d.dias),
        chamado: 'CH-' + (10450 + i),
        tomboNovo: d.tn,
        tomboAntigo: d.ta,
        equipamento: d.cat,
        modelo: d.mod,
        servicoSolicitado: 'Recolhimento para avaliação técnica e conferência de patrimônio.',
        status: d.st,
        predioOrigem: d.pr,
        setorOrigem: d.se,
        ttr: ttr[i % 3 === 0 ? 1 : 0]
      }, { silencioso: true, usuario: 'sistema' });
    });

    var ttrS = SAGETI.listas.ttrDe('saida');
    var tecnicos = SAGETI.listas.get('tecnicos');

    registrarSaida({
      dataSaida: diasAtras(1), chamado: 'CH-10480',
      tomboNovo: '045118', tomboAntigo: '',
      equipamento: 'Monitor', modelo: 'HP P22A G4',
      servicoSolicitado: 'Substituição de monitor com defeito na unidade.',
      status: 'Subs. Equip. Defeito',
      predioDestino: 'Forum Criminal', setorDestino: '1VCJ - 1ª Vara Criminal do Júri',
      ttr: ttrS[0], tecnico: tecnicos[0]
    }, { silencioso: true, usuario: 'sistema' });

    registrarSaida({
      dataSaida: diasAtras(0), chamado: 'CH-10488',
      tomboNovo: '051010', tomboAntigo: '',
      equipamento: 'Headset', modelo: 'Logitech',
      servicoSolicitado: 'Atendimento a solicitação de novo posto de trabalho.',
      status: 'Solicitação',
      predioDestino: 'PA - Iracema', setorDestino: 'SADA - Setor de Atendimento',
      ttr: ttrS[1], tecnico: tecnicos[1]
    }, { silencioso: true, usuario: 'sistema' });
  }

  function inicializar(opcoes) {
    // As listas precisam existir antes de qualquer regra que consulte status.
    SAGETI.listas.inicializar();

    var dados = ler();
    if (dados && dados.equipamentos) {
      estado.equipamentos = dados.equipamentos;
      estado.movimentacoes = dados.movimentacoes || [];
      estado.usuarios = (dados.usuarios && dados.usuarios.length) ? dados.usuarios : usuariosPadrao();
      estado.meta = dados.meta || { criadoEm: agora(), versao: 2 };
      migrar();
    } else {
      estado.usuarios = usuariosPadrao();
      estado.meta = { criadoEm: agora(), versao: 2 };
      if (!opcoes || opcoes.seed !== false) seedDemo();
      gravar();
    }
    iniciarRealtime();
  }

  /* ---------- Histórico ---------------------------------------------------- */

  function registrarMovimentacao(mov) {
    var registro = Object.assign({
      id: uid(),
      registradoEm: agora(),
      usuario: (SAGETI.auth && SAGETI.auth.usuarioAtual() && SAGETI.auth.usuarioAtual().usuario) || 'sistema',
      tecnico: ''
    }, mov);
    estado.movimentacoes.unshift(registro);
    return registro;
  }

  /* ---------- Equipamentos (estoque) --------------------------------------- */

  function listarEquipamentos() { return estado.equipamentos.slice(); }

  function acharPorTombo(reg) {
    var c = chaveTombo(reg);
    if (!c) return null;
    return estado.equipamentos.find(function (e) { return chaveTombo(e) === c; }) || null;
  }

  function acharPorId(id) {
    return estado.equipamentos.find(function (e) { return e.id === id; }) || null;
  }

  /** Usado pelo módulo de listas ao renomear uma opção. */
  function _setCampoEquipamento(id, campo, valor) {
    var e = acharPorId(id);
    if (!e) return false;
    e[campo] = valor;
    e.atualizadoEm = agora();
    agendarGravacao();
    return true;
  }

  function _setCampoMovimentacao(id, campo, valor) {
    var m = estado.movimentacoes.find(function (x) { return x.id === id; });
    if (!m) return false;
    m[campo] = valor;
    agendarGravacao();
    return true;
  }

  /** Molde de um equipamento novo. */
  function novoEquipamento(dados) {
    return {
      id: uid(),
      equipamento: norm(dados.equipamento),
      modelo: norm(dados.modelo),
      tomboNovo: norm(dados.tomboNovo),
      tomboAntigo: norm(dados.tomboAntigo),
      status: dados.status || 'Estoque',
      noLaboratorio: true,
      chamado: norm(dados.chamado),
      servicoSolicitado: norm(dados.servicoSolicitado),
      ttr: dados.ttr || '',
      tecnico: norm(dados.tecnico),
      dataEntrada: dados.dataEntrada || hoje(),
      predioOrigem: norm(dados.predioOrigem),
      setorOrigem: norm(dados.setorOrigem),
      dataSaida: '',
      predioDestino: '',
      setorDestino: '',
      criadoEm: agora(),
      atualizadoEm: agora()
    };
  }

  function criarEquipamento(dados, opcoes) {
    opcoes = opcoes || {};
    var duplicado = acharPorTombo(dados);
    if (duplicado) {
      return {
        ok: false,
        erro: 'Já existe um equipamento com o tombo ' + (dados.tomboNovo || dados.tomboAntigo) + '.',
        equipamento: duplicado
      };
    }

    var eq = novoEquipamento(dados);
    // Cadastro direto: a presença física vem do padrão do status escolhido.
    eq.noLaboratorio = noLabDoStatus(eq.status);
    if (!eq.noLaboratorio) {
      eq.dataSaida = dados.dataSaida || '';
      eq.predioDestino = norm(dados.predioDestino);
      eq.setorDestino = norm(dados.setorDestino);
    }

    estado.equipamentos.push(eq);
    registrarMovimentacao({
      tipo: 'CADASTRO', data: eq.dataEntrada, equipamentoId: eq.id,
      equipamento: eq.equipamento, modelo: eq.modelo,
      tomboNovo: eq.tomboNovo, tomboAntigo: eq.tomboAntigo,
      chamado: eq.chamado, servicoSolicitado: eq.servicoSolicitado,
      statusResultante: eq.status, predio: eq.predioOrigem, setor: eq.setorOrigem,
      ttr: eq.ttr, tecnico: eq.tecnico,
      observacao: 'Cadastro direto no estoque do laboratório.'
    });

    if (!opcoes.silencioso) emit({ tipo: 'equipamento:criado', id: eq.id });
    return { ok: true, equipamento: eq };
  }

  function atualizarEquipamento(id, mudancas, opcoes) {
    opcoes = opcoes || {};
    var eq = acharPorId(id);
    if (!eq) return { ok: false, erro: 'Equipamento não encontrado.' };

    var alvo = {
      tomboNovo: mudancas.tomboNovo != null ? mudancas.tomboNovo : eq.tomboNovo,
      tomboAntigo: mudancas.tomboAntigo != null ? mudancas.tomboAntigo : eq.tomboAntigo
    };
    var chaveAlvo = chaveTombo(alvo);
    var colisao = chaveAlvo && estado.equipamentos.find(function (o) {
      return o.id !== id && chaveTombo(o) === chaveAlvo;
    });
    if (colisao) return { ok: false, erro: 'O tombo informado já pertence a outro equipamento.' };

    var statusAnterior = eq.status;
    Object.keys(mudancas).forEach(function (k) {
      if (mudancas[k] !== undefined) {
        eq[k] = typeof mudancas[k] === 'string' ? norm(mudancas[k]) : mudancas[k];
      }
    });

    // Edição pelo Estoque: o status escolhido determina a presença física.
    if (mudancas.status !== undefined && mudancas.noLaboratorio === undefined) {
      eq.noLaboratorio = noLabDoStatus(eq.status);
    }
    eq.atualizadoEm = agora();

    registrarMovimentacao({
      tipo: 'AJUSTE', data: hoje(), equipamentoId: eq.id,
      equipamento: eq.equipamento, modelo: eq.modelo,
      tomboNovo: eq.tomboNovo, tomboAntigo: eq.tomboAntigo,
      chamado: eq.chamado, servicoSolicitado: eq.servicoSolicitado,
      statusAnterior: statusAnterior, statusResultante: eq.status,
      predio: eq.predioOrigem, setor: eq.setorOrigem,
      ttr: eq.ttr, tecnico: eq.tecnico,
      observacao: statusAnterior !== eq.status
        ? 'Status alterado de "' + statusAnterior + '" para "' + eq.status + '".'
        : 'Dados do equipamento atualizados.'
    });

    if (!opcoes.silencioso) emit({ tipo: 'equipamento:atualizado', id: eq.id });
    return { ok: true, equipamento: eq };
  }

  function excluirEquipamento(id, opcoes) {
    opcoes = opcoes || {};
    // Reforço de RBAC no próprio store: o botão de excluir já some da tela
    // para o perfil Técnico, mas sem esta checagem aqui a exclusão ainda
    // seria alcançável direto pelo console do navegador.
    if (!opcoes.silencioso && SAGETI.auth && !SAGETI.auth.permissao('podeExcluir')) {
      return { ok: false, erro: 'Seu perfil não tem permissão para excluir equipamentos.' };
    }
    var i = estado.equipamentos.findIndex(function (e) { return e.id === id; });
    if (i === -1) return { ok: false, erro: 'Equipamento não encontrado.' };
    var eq = estado.equipamentos[i];
    estado.equipamentos.splice(i, 1);

    registrarMovimentacao({
      tipo: 'EXCLUSAO', data: hoje(), equipamentoId: eq.id,
      equipamento: eq.equipamento, modelo: eq.modelo,
      tomboNovo: eq.tomboNovo, tomboAntigo: eq.tomboAntigo,
      chamado: eq.chamado, statusAnterior: eq.status, statusResultante: '—',
      predio: eq.predioOrigem, setor: eq.setorOrigem, ttr: eq.ttr, tecnico: eq.tecnico,
      observacao: 'Equipamento removido do estoque do laboratório.'
    });

    if (!opcoes.silencioso) emit({ tipo: 'equipamento:excluido', id: id });
    return { ok: true, equipamento: eq };
  }

  /* ---------- Entrada ------------------------------------------------------ */

  function registrarEntrada(dados, opcoes) {
    opcoes = opcoes || {};
    var existente = acharPorTombo(dados);
    var criado = false;
    var eq, statusAnterior = '';

    if (existente) {
      eq = existente;
      statusAnterior = eq.status;
      eq.equipamento = norm(dados.equipamento) || eq.equipamento;
      eq.modelo = norm(dados.modelo) || eq.modelo;
      eq.tomboNovo = norm(dados.tomboNovo) || eq.tomboNovo;
      eq.tomboAntigo = norm(dados.tomboAntigo) || eq.tomboAntigo;
      eq.status = dados.status || 'Estoque';
      eq.chamado = norm(dados.chamado);
      eq.servicoSolicitado = norm(dados.servicoSolicitado);
      eq.ttr = dados.ttr || '';
      if (dados.tecnico !== undefined) eq.tecnico = norm(dados.tecnico);
      eq.dataEntrada = dados.dataEntrada || hoje();
      eq.predioOrigem = norm(dados.predioOrigem);
      eq.setorOrigem = norm(dados.setorOrigem);
      // Voltou ao laboratório: os dados da saída anterior deixam de valer.
      eq.dataSaida = '';
      eq.predioDestino = '';
      eq.setorDestino = '';
      eq.atualizadoEm = agora();
    } else {
      criado = true;
      eq = novoEquipamento(dados);
      estado.equipamentos.push(eq);
    }

    // Entrada = o equipamento está no laboratório. Independe do rótulo.
    eq.noLaboratorio = true;

    var mov = registrarMovimentacao({
      tipo: 'ENTRADA', data: eq.dataEntrada, equipamentoId: eq.id,
      equipamento: eq.equipamento, modelo: eq.modelo,
      tomboNovo: eq.tomboNovo, tomboAntigo: eq.tomboAntigo,
      chamado: eq.chamado, servicoSolicitado: eq.servicoSolicitado,
      statusAnterior: criado ? '' : statusAnterior, statusResultante: eq.status,
      predio: eq.predioOrigem, setor: eq.setorOrigem,
      ttr: eq.ttr, tecnico: eq.tecnico,
      observacao: criado
        ? 'Entrada de equipamento novo no laboratório.'
        : 'Reentrada — registro de estoque atualizado.'
    });

    if (opcoes.usuario) mov.usuario = opcoes.usuario;
    if (!opcoes.silencioso) emit({ tipo: 'entrada', id: eq.id, movimentacaoId: mov.id });
    return { ok: true, equipamento: eq, criado: criado, movimentacao: mov };
  }

  /* ---------- Saída -------------------------------------------------------- */

  function registrarSaida(dados, opcoes) {
    opcoes = opcoes || {};
    var eq = acharPorTombo(dados);

    if (!eq) {
      return {
        ok: false,
        erro: 'Nenhum equipamento com esse tombo está cadastrado no laboratório. ' +
              'Registre a entrada antes da saída.'
      };
    }
    if (!eq.noLaboratorio) {
      return {
        ok: false,
        erro: 'Este equipamento já saiu do laboratório em ' +
          (eq.dataSaida ? SAGETI.util.dataBR(eq.dataSaida) : 'data anterior') +
          ' para ' + (eq.predioDestino || 'destino não informado') +
          ' (status "' + eq.status + '").'
      };
    }

    var statusAnterior = eq.status;
    eq.equipamento = norm(dados.equipamento) || eq.equipamento;
    eq.modelo = norm(dados.modelo) || eq.modelo;
    eq.status = dados.status || 'Disponibilizado';
    eq.dataSaida = dados.dataSaida || hoje();
    eq.chamado = norm(dados.chamado) || eq.chamado;
    eq.servicoSolicitado = norm(dados.servicoSolicitado) || eq.servicoSolicitado;
    eq.predioDestino = norm(dados.predioDestino);
    eq.setorDestino = norm(dados.setorDestino);
    eq.ttr = dados.ttr || eq.ttr;
    if (dados.tecnico !== undefined) eq.tecnico = norm(dados.tecnico);
    // Saída = o equipamento deixou o laboratório. Independe do rótulo.
    eq.noLaboratorio = false;
    eq.atualizadoEm = agora();

    var mov = registrarMovimentacao({
      tipo: 'SAIDA', data: eq.dataSaida, equipamentoId: eq.id,
      equipamento: eq.equipamento, modelo: eq.modelo,
      tomboNovo: eq.tomboNovo, tomboAntigo: eq.tomboAntigo,
      chamado: eq.chamado, servicoSolicitado: eq.servicoSolicitado,
      statusAnterior: statusAnterior, statusResultante: eq.status,
      predio: eq.predioDestino, setor: eq.setorDestino,
      ttr: eq.ttr, tecnico: eq.tecnico,
      observacao: 'Saída do laboratório para ' + (eq.predioDestino || 'destino não informado') + '.'
    });

    if (opcoes.usuario) mov.usuario = opcoes.usuario;
    if (!opcoes.silencioso) emit({ tipo: 'saida', id: eq.id, movimentacaoId: mov.id });
    return { ok: true, equipamento: eq, movimentacao: mov };
  }

  /* ---------- Importação em massa ------------------------------------------
     Recebe linhas já normalizadas (ver js/importar.js) e cria os registros.
     Devolve o relatório completo, incluindo o motivo de cada linha recusada.
     ---------------------------------------------------------------------- */

  function importarLinhas(linhas, opcoes) {
    opcoes = opcoes || {};
    var criarOpcoes = opcoes.criarOpcoes !== false;   // cadastra valores novos nas listas
    var atualizarExistentes = !!opcoes.atualizarExistentes;
    var simular = !!opcoes.simular;                   // pré-visualização

    var rel = {
      total: linhas.length,
      criados: 0, atualizados: 0, ignorados: 0, recusados: 0,
      opcoesCriadas: [],
      itens: []
    };

    // Detecta tombos repetidos dentro do próprio arquivo.
    var vistosNoArquivo = {};
    var snapshot = simular ? {} : null;
    if (simular) {
      estado.equipamentos.forEach(function (e) { snapshot[chaveTombo(e)] = true; });
    }

    linhas.forEach(function (linha) {
      var registro = { linha: linha._linha, tombo: linha.tomboNovo || linha.tomboAntigo };

      // 1. linha em branco
      var temConteudo = ['equipamento', 'modelo', 'tomboNovo', 'tomboAntigo', 'chamado']
        .some(function (c) { return norm(linha[c]); });
      if (!temConteudo) {
        registro.resultado = 'ignorado';
        registro.motivo = 'Linha em branco.';
        rel.ignorados++; rel.itens.push(registro);
        return;
      }

      // 2. sem tombo não há identidade
      var c = chaveTombo(linha);
      if (!c) {
        registro.resultado = 'recusado';
        registro.motivo = 'Sem tombo novo nem tombo antigo.';
        rel.recusados++; rel.itens.push(registro);
        return;
      }

      // 3. duplicado dentro do arquivo
      if (vistosNoArquivo[c]) {
        registro.resultado = 'recusado';
        registro.motivo = 'Tombo repetido na linha ' + vistosNoArquivo[c] + ' do arquivo.';
        rel.recusados++; rel.itens.push(registro);
        return;
      }
      vistosNoArquivo[c] = linha._linha;

      // 4. já existe no sistema
      var existe = simular ? !!snapshot[c] : !!acharPorTombo(linha);
      if (existe && !atualizarExistentes) {
        registro.resultado = 'ignorado';
        registro.motivo = 'Tombo já cadastrado no sistema.';
        rel.ignorados++; rel.itens.push(registro);
        return;
      }

      // 5. resolve os valores contra as listas
      var resolvido = {};
      var pares = [
        ['equipamento', 'equipamentos'], ['modelo', 'modelos'],
        ['predioOrigem', 'predios'], ['setorOrigem', 'setores'],
        ['predioDestino', 'predios'], ['setorDestino', 'setores'],
        ['tecnico', 'tecnicos'], ['status', 'status']
      ];
      pares.forEach(function (par) {
        var bruto = norm(linha[par[0]]);
        if (!bruto) { resolvido[par[0]] = ''; return; }
        var r = SAGETI.listas.garantir(par[1], bruto, criarOpcoes && !simular);
        if (r.criado) rel.opcoesCriadas.push(par[1] + ': ' + r.valor);
        // Valor fora da lista e sem permissão de criar: mantém o texto original,
        // para não perder dado do inventário por causa de cadastro.
        resolvido[par[0]] = r.valor || bruto;
      });

      // TTR pertence à lista do contexto correspondente.
      var ttrBruto = norm(linha.ttr);
      if (ttrBruto) {
        var listaTtr = linha.dataSaida ? 'ttrSaida' : 'ttrEntrada';
        var rt = SAGETI.listas.garantir(listaTtr, ttrBruto, criarOpcoes && !simular);
        if (rt.criado) rel.opcoesCriadas.push(listaTtr + ': ' + rt.valor);
        resolvido.ttr = rt.valor || ttrBruto;
      } else {
        resolvido.ttr = '';
      }

      var payload = {
        equipamento: resolvido.equipamento,
        modelo: resolvido.modelo,
        tomboNovo: norm(linha.tomboNovo),
        tomboAntigo: norm(linha.tomboAntigo),
        status: resolvido.status || 'Estoque',
        chamado: norm(linha.chamado),
        servicoSolicitado: norm(linha.servicoSolicitado),
        ttr: resolvido.ttr,
        tecnico: resolvido.tecnico,
        dataEntrada: linha.dataEntrada || hoje(),
        predioOrigem: resolvido.predioOrigem,
        setorOrigem: resolvido.setorOrigem,
        dataSaida: linha.dataSaida || '',
        predioDestino: resolvido.predioDestino,
        setorDestino: resolvido.setorDestino
      };

      if (simular) {
        registro.resultado = existe ? 'atualizado' : 'criado';
        registro.motivo = existe ? 'Atualizará o registro existente.' : 'Novo equipamento.';
        if (existe) rel.atualizados++; else rel.criados++;
        snapshot[c] = true;
        rel.itens.push(registro);
        return;
      }

      // 6. grava
      if (existe) {
        var atual = acharPorTombo(linha);
        var mudancas = {};
        Object.keys(payload).forEach(function (k) {
          if (payload[k] !== '' && payload[k] != null) mudancas[k] = payload[k];
        });
        var ra = atualizarEquipamento(atual.id, mudancas, { silencioso: true });
        if (!ra.ok) {
          registro.resultado = 'recusado'; registro.motivo = ra.erro;
          rel.recusados++; rel.itens.push(registro);
          return;
        }
        registro.resultado = 'atualizado';
        rel.atualizados++;
      } else {
        var rc = criarEquipamento(payload, { silencioso: true });
        if (!rc.ok) {
          registro.resultado = 'recusado'; registro.motivo = rc.erro;
          rel.recusados++; rel.itens.push(registro);
          return;
        }
        // Se a planilha traz data de saída, o item nasce já expedido.
        if (payload.dataSaida) {
          rc.equipamento.noLaboratorio = noLabDoStatus(payload.status);
          rc.equipamento.dataSaida = payload.dataSaida;
          rc.equipamento.predioDestino = payload.predioDestino;
          rc.equipamento.setorDestino = payload.setorDestino;
        }
        registro.resultado = 'criado';
        rel.criados++;
      }
      rel.itens.push(registro);
    });

    if (!simular) {
      rel.opcoesCriadas = rel.opcoesCriadas.filter(function (v, i, a) { return a.indexOf(v) === i; });
      if (rel.opcoesCriadas.length) SAGETI.listas.confirmarGarantias();

      registrarMovimentacao({
        tipo: 'IMPORTACAO', data: hoje(),
        equipamento: '—', modelo: '—',
        statusResultante: '—',
        observacao: 'Importação de planilha: ' + rel.criados + ' criado(s), ' +
          rel.atualizados + ' atualizado(s), ' + rel.ignorados + ' ignorado(s), ' +
          rel.recusados + ' recusado(s).'
      });
      emit({ tipo: 'importacao', relatorio: rel });
    }

    return rel;
  }

  /* ---------- Consultas derivadas (alimentam a Dashboard) ------------------ */

  function estoqueLaboratorio() {
    return estado.equipamentos.filter(function (e) { return e.noLaboratorio; });
  }

  function resumo() {
    var todos = estado.equipamentos;
    var noLab = estoqueLaboratorio();

    var contagem = {};
    SAGETI.listas.statusTodos().forEach(function (s) { contagem[s] = 0; });
    todos.forEach(function (e) {
      if (contagem[e.status] === undefined) contagem[e.status] = 0;
      contagem[e.status]++;
    });

    /* Agrupamento por TOM, não por rótulo: as listas são editáveis, então a
       Dashboard mede a saúde do estoque pelo tom de cada status. */
    var porTom = { good: 0, warning: 0, serious: 0, critical: 0, info: 0, neutral: 0 };
    noLab.forEach(function (e) {
      var t = SAGETI.listas.statusMeta(e.status).tom || 'neutral';
      if (porTom[t] === undefined) porTom[t] = 0;
      porTom[t]++;
    });

    function agrupar(campo, fonte) {
      var mapa = {};
      (fonte || noLab).forEach(function (e) {
        var k = e[campo] || 'Não informado';
        mapa[k] = (mapa[k] || 0) + 1;
      });
      return mapa;
    }

    return {
      totalCadastrado: todos.length,
      totalNoLab: noLab.length,
      totalFora: todos.length - noLab.length,
      porStatus: contagem,
      porTom: porTom,
      porTipo: agrupar('equipamento'),
      porModelo: agrupar('modelo'),
      porPredio: agrupar('predioOrigem'),
      porSetor: agrupar('setorOrigem'),
      porTecnico: agrupar('tecnico', todos.filter(function (e) { return e.tecnico; })),
      ttrPendente: noLab.filter(function (e) {
        return /pendente/i.test(e.ttr || '');
      }).length
    };
  }

  function serieMovimentacoes(dias) {
    dias = dias || 30;
    var hojeD = new Date();
    hojeD.setHours(0, 0, 0, 0);
    var labels = [], mapa = {};
    for (var i = dias - 1; i >= 0; i--) {
      var iso = new Date(hojeD.getTime() - i * 86400000).toISOString().slice(0, 10);
      labels.push(iso);
      mapa[iso] = { entradas: 0, saidas: 0 };
    }
    estado.movimentacoes.forEach(function (m) {
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

  function listarMovimentacoes() { return estado.movimentacoes.slice(); }

  /* ---------- Manutenção de dados ------------------------------------------ */

  function exportarJSON() {
    return JSON.stringify({
      app: SAGETI.APP.nome,
      versao: SAGETI.APP.versao,
      exportadoEm: agora(),
      equipamentos: estado.equipamentos,
      movimentacoes: estado.movimentacoes,
      listas: JSON.parse(SAGETI.listas.exportarJSON()).listas
    }, null, 2);
  }

  function importarJSON(texto) {
    var dados;
    try { dados = JSON.parse(texto); } catch (e) { return { ok: false, erro: 'Arquivo JSON inválido.' }; }
    if (!dados || !Array.isArray(dados.equipamentos)) {
      return { ok: false, erro: 'O arquivo não contém uma lista de equipamentos.' };
    }
    // Restaura as listas antes dos registros, para os status resolverem.
    if (dados.listas) SAGETI.listas.importarJSON(JSON.stringify({ listas: dados.listas }));
    estado.equipamentos = dados.equipamentos;
    estado.movimentacoes = Array.isArray(dados.movimentacoes) ? dados.movimentacoes : [];
    migrar();
    emit({ tipo: 'import' });
    return { ok: true, total: estado.equipamentos.length };
  }

  function limparTudo() {
    estado.equipamentos = [];
    estado.movimentacoes = [];
    emit({ tipo: 'reset' });
  }

  /* ---------- API pública -------------------------------------------------- */

  SAGETI.store = {
    inicializar: inicializar,
    assinar: assinar,
    notificarListas: notificarListas,
    estado: estado,

    listarEquipamentos: listarEquipamentos,
    estoqueLaboratorio: estoqueLaboratorio,
    acharPorId: acharPorId,
    acharPorTombo: acharPorTombo,
    criarEquipamento: criarEquipamento,
    atualizarEquipamento: atualizarEquipamento,
    excluirEquipamento: excluirEquipamento,

    registrarEntrada: registrarEntrada,
    registrarSaida: registrarSaida,
    importarLinhas: importarLinhas,

    listarMovimentacoes: listarMovimentacoes,
    resumo: resumo,
    serieMovimentacoes: serieMovimentacoes,

    exportarJSON: exportarJSON,
    importarJSON: importarJSON,
    limparTudo: limparTudo,

    _setCampoEquipamento: _setCampoEquipamento,
    _setCampoMovimentacao: _setCampoMovimentacao,
    _uid: uid,
    _agora: agora,
    _hoje: hoje
  };

  /* ---------- Autenticação -------------------------------------------------- */

  var sessao = null;

  function carregarSessao() {
    try {
      var bruto = window.sessionStorage.getItem(SAGETI.APP.sessionKey) ||
                  window.localStorage.getItem(SAGETI.APP.sessionKey);
      sessao = bruto ? JSON.parse(bruto) : null;
    } catch (e) { sessao = null; }
    return sessao;
  }

  SAGETI.auth = {
    entrar: function (usuario, senha, lembrar) {
      var u = estado.usuarios.find(function (x) {
        return x.usuario.toLowerCase() === norm(usuario).toLowerCase() && x.senha === senha;
      });
      if (!u) return { ok: false, erro: 'Usuário ou senha inválidos.' };
      sessao = { id: u.id, usuario: u.usuario, nome: u.nome, perfil: u.perfil, entrouEm: agora() };
      var payload = JSON.stringify(sessao);
      try {
        if (lembrar) window.localStorage.setItem(SAGETI.APP.sessionKey, payload);
        else window.sessionStorage.setItem(SAGETI.APP.sessionKey, payload);
      } catch (e) { /* sessão só em memória */ }
      return { ok: true, usuario: sessao };
    },
    sair: function () {
      sessao = null;
      try {
        window.sessionStorage.removeItem(SAGETI.APP.sessionKey);
        window.localStorage.removeItem(SAGETI.APP.sessionKey);
      } catch (e) { /* ignora */ }
    },
    usuarioAtual: function () { return sessao || carregarSessao(); },
    autenticado: function () { return !!(sessao || carregarSessao()); },
    permissao: function (chave) {
      var u = SAGETI.auth.usuarioAtual();
      if (!u) return false;
      var p = SAGETI.PERFIS[u.perfil] || SAGETI.PERFIS.leitura;
      return !!p[chave];
    }
  };

})(window.SAGETI);
