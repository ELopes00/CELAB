/* ==========================================================================
   CELAB — Configuração e listas PADRÃO
   --------------------------------------------------------------------------
   IMPORTANTE: o que está aqui é o *padrão de fábrica*. Em tempo de execução
   as listas vivem em CELAB.listas (persistidas e editáveis pela interface).
   Sempre leia via CELAB.listas.get('setores'), nunca deste arquivo.

   Este arquivo é a fonte para:
     · a primeira carga do sistema;
     · o botão "Restaurar padrão" do gerenciador de listas;
     · a incorporação de novas opções de fábrica em bases já existentes.
   ========================================================================== */

window.CELAB = window.CELAB || {};

(function (CELAB) {
  'use strict';

  CELAB.APP = {
    nome: 'CELAB',
    descricao: 'Controle de Estoque de Laboratório',
    versao: '2.0.0',
    storageKey: 'celab.db.v1',
    listasKey: 'celab.listas.v1',
    sessionKey: 'celab.session.v1',
    themeKey: 'celab.theme',
    channel: 'celab-realtime'
  };

  /* ======================================================================
     1. STATUS
     ----------------------------------------------------------------------
     Cada status declara:
       valor     rótulo exibido e gravado (é a chave — único na lista)
       tom       cor semântica: good | warning | serious | critical | neutral | info
       noLab     presença física PADRÃO: true = permanece no laboratório.
                 Vale quando o status é escolhido na aba Estoque.
       contextos onde a opção aparece: 'entrada', 'saida', 'estoque'

     Quem manda na presença física é a OPERAÇÃO, não o rótulo:
       · registrar entrada  → o item está no laboratório, sempre;
       · registrar saída    → o item saiu, sempre;
       · editar no estoque  → aí sim vale o `noLab` do status escolhido.
     Foi preciso ser assim porque rótulos como "Substituição" e "Manutenção"
     existem nos dois contextos com sentidos opostos — na entrada o item
     chega, na saída o mesmo rótulo significa que ele foi embora. O campo
     `noLaboratorio` de cada equipamento guarda o resultado, então a Dashboard
     nunca depende de interpretar o texto do status.
     ====================================================================== */

  CELAB.STATUS_PADRAO = [
    /* --- situações de guarda (aba Estoque) ------------------------------- */
    { valor: 'Estoque',         tom: 'good',     noLab: true,  contextos: ['entrada', 'estoque'], desc: 'Disponível para uso' },
    { valor: 'Manutenção',      tom: 'warning',  noLab: true,  contextos: ['entrada', 'estoque', 'saida'], desc: 'Em reparo' },
    { valor: 'Defeito',         tom: 'critical', noLab: true,  contextos: ['entrada', 'estoque'], desc: 'Com defeito, aguardando destino' },
    { valor: 'Leilão',          tom: 'serious',  noLab: true,  contextos: ['entrada', 'estoque'], desc: 'Baixado para leilão' },
    { valor: 'Disponibilizado', tom: 'neutral',  noLab: false, contextos: ['estoque', 'saida'],   desc: 'Expedido para a unidade destino' },

    /* --- motivos de ENTRADA ---------------------------------------------- */
    { valor: 'Entrada de Estoque',     tom: 'good',     noLab: true, contextos: ['entrada'], desc: 'Entrada para compor o estoque' },
    { valor: 'Devolução',              tom: 'info',     noLab: true, contextos: ['entrada'], desc: 'Devolução de equipamento pela unidade' },
    { valor: 'Devolução Empréstimo',   tom: 'info',     noLab: true, contextos: ['entrada'], desc: 'Retorno de equipamento emprestado' },
    { valor: 'Substituição Defeito',   tom: 'critical', noLab: true, contextos: ['entrada'], desc: 'Substituído por apresentar defeito' },
    { valor: 'Devolucao Defeito',      tom: 'critical', noLab: true, contextos: ['entrada'], desc: 'Devolvido com defeito' },
    { valor: 'Devolução Eq. Obsoleto', tom: 'serious',  noLab: true, contextos: ['entrada'], desc: 'Devolução de equipamento obsoleto' },

    /* --- rótulo comum aos dois lados ------------------------------------- */
    { valor: 'Substituição',           tom: 'info',     noLab: true, contextos: ['entrada', 'saida'], desc: 'Troca de equipamento' },

    /* --- motivos de SAÍDA ------------------------------------------------ */
    { valor: 'Solicitação',           tom: 'neutral', noLab: false, contextos: ['saida'], desc: 'Atendimento a solicitação da unidade' },
    { valor: 'Subs. Equip. Defeito',  tom: 'neutral', noLab: false, contextos: ['saida'], desc: 'Substituição de equipamento com defeito' },
    { valor: 'Subs. Equip. Obsoleto', tom: 'neutral', noLab: false, contextos: ['saida'], desc: 'Substituição de equipamento obsoleto' },
    { valor: 'Empréstimo',            tom: 'info',    noLab: false, contextos: ['saida'], desc: 'Cessão temporária à unidade' },
    { valor: 'Doação',                tom: 'neutral', noLab: false, contextos: ['saida'], desc: 'Doação a órgão ou entidade' }
  ];

  /* ======================================================================
     2. TTR — listas próprias por contexto
     ====================================================================== */

  CELAB.TTR_ENTRADA_PADRAO = [
    'Realizada', 'Pendente', 'Retornou', 'Não consta no GRP', 'Garantia'
  ];

  CELAB.TTR_SAIDA_PADRAO = [
    'Realizada', 'Pendente', 'Retornou', 'Empréstimo', 'Nao consta no GRP'
  ];

  /* ======================================================================
     3. TÉCNICOS RESPONSÁVEIS
     ====================================================================== */

  // Array de técnicos
  CELAB.TECNICOS_PADRAO = [];

  /* ======================================================================
     4. EQUIPAMENTOS
     ====================================================================== */

  CELAB.EQUIPAMENTOS_PADRAO = [
    'Computador',
    'Eq. Video Conf.',
    'Headset',
    'Impressora',
    'Monitor',
    'Nobreak',
    'Baterias Nobreak',
    'Notebook',
    'Webcam',
    'HDMI',
    'Scanner',
    'Tela de projeção',
    'Projetor Multimidia',
    'Microfone de Expansão'
  ];

  /* ======================================================================
     5. MODELOS
     ====================================================================== */

  CELAB.MODELOS_PADRAO = [
    'Ragtech Easy Way 1200',
    'Lenovo ThinkCentre M75q',
    'Positivo Minipro 810',
    'Positivo Master 820',
    'Avision AD345G',
    'HP Pro M404DW',
    'HP Pro 4003DW',
    'OKI 5112',
    'HP P22A G4',
    'Positivo 23MB35PH',
    'Positivo 22MP55PY',
    'LG E2241VP',
    'GoPresence Teams 10x',
    'Logitech',
    'Logitech C925e',
    'Agem',
    'HDMI - 5M',
    'HDMI - 10M',
    'HDMI - 15M',
    'HDMI - 20M',
    'HDMI - 25M',
    'HDMI - 30M',
    'DG-100',
    'EPSON POWERLITE X29',
    'Samsung Galaxy Tab A7',
    'Logitech V-U0037',
    'Positivo N6440',
    'Positivo Master MiniPro C8400',
    'Positivo 24BL550J',
    'NARDELLI',
    'Daten 20m35pd-m',
    'Dell p2014ht',
    'Itautec w1942pe',
    'LG 24BL550J-B',
    'LG 22MP55PY',
    'LG E2241PX',
    'HP Le2001w',
    'EPSON GT-S50',
    'Kodak ScanMate i1150',
    'Samsung ProXpress SL-M4070FR',
    'Filtro de Linha 8T Intelbras',
    'Filtro de Linha 5T Intelbras',
    'AOC e2023pwd',
    'Positivo E2241PX',
    'Canon DR-C130'
  ];

  /** Sugestão de categoria por modelo — editável no gerenciador de listas. */
  CELAB.MODELOS_POR_EQUIPAMENTO_PADRAO = {
    'Computador': [
      'Lenovo ThinkCentre M75q', 'Positivo Minipro 810',
      'Positivo Master 820', 'Positivo Master MiniPro C8400'
    ],
    'Eq. Video Conf.': ['GoPresence Teams 10x'],
    'Headset': ['Logitech', 'Agem'],
    'Impressora': [
      'HP Pro M404DW', 'HP Pro 4003DW', 'OKI 5112', 'Samsung ProXpress SL-M4070FR'
    ],
    'Monitor': [
      'HP P22A G4', 'Positivo 23MB35PH', 'Positivo 22MP55PY', 'Positivo 24BL550J',
      'Positivo E2241PX', 'LG E2241VP', 'LG E2241PX', 'LG 24BL550J-B',
      'LG 22MP55PY', 'HP Le2001w', 'Daten 20m35pd-m', 'Dell p2014ht',
      'Itautec w1942pe', 'AOC e2023pwd'
    ],
    'Nobreak': [
      'Ragtech Easy Way 1200', 'Filtro de Linha 8T Intelbras', 'Filtro de Linha 5T Intelbras'
    ],
    'Baterias Nobreak': ['Ragtech Easy Way 1200'],
    'Notebook': ['Positivo N6440', 'Samsung Galaxy Tab A7'],
    'Webcam': ['Logitech C925e', 'Logitech V-U0037'],
    'HDMI': [
      'HDMI - 5M', 'HDMI - 10M', 'HDMI - 15M',
      'HDMI - 20M', 'HDMI - 25M', 'HDMI - 30M'
    ],
    'Scanner': ['Avision AD345G', 'EPSON GT-S50', 'Kodak ScanMate i1150', 'Canon DR-C130'],
    'Tela de projeção': ['NARDELLI'],
    'Projetor Multimidia': ['EPSON POWERLITE X29'],
    'Microfone de Expansão': ['DG-100']
  };

  /* ======================================================================
     6. PRÉDIOS
     ====================================================================== */

  // Array de prédio
  CELAB.PREDIOS_PADRAO = [];

  /* ======================================================================
     7. SETORES / UNIDADES — vale para Entrada e Saída
     ====================================================================== */

  //Array de departamentos
  CELAB.SETORES_PADRAO = [];

  /* ======================================================================
     8. Metadados das listas — dirigem o gerenciador de opções
     ====================================================================== */

  CELAB.TONS = [
    { valor: 'good',     rotulo: 'Verde — situação normal' },
    { valor: 'warning',  rotulo: 'Âmbar — atenção' },
    { valor: 'serious',  rotulo: 'Laranja — grave' },
    { valor: 'critical', rotulo: 'Vermelho — crítico' },
    { valor: 'info',     rotulo: 'Azul — informativo' },
    { valor: 'neutral',  rotulo: 'Cinza — neutro' }
  ];

  /**
   * Catálogo das listas editáveis. `tipo: 'status'` ganha os campos extra
   * (permanece no laboratório / tom); as demais são listas de texto.
   */
  CELAB.CATALOGO_LISTAS = [
    { chave: 'status',      rotulo: 'Status',              tipo: 'status', icone: 'etiqueta',
      ajuda: 'Situações e motivos de movimentação. "Permanece no laboratório" define se o item conta no estoque.' },
    { chave: 'ttrEntrada',  rotulo: 'TTR — Entrada',       tipo: 'texto',  icone: 'check',
      ajuda: 'Opções de TTR oferecidas no formulário de entrada.' },
    { chave: 'ttrSaida',    rotulo: 'TTR — Saída',         tipo: 'texto',  icone: 'check',
      ajuda: 'Opções de TTR oferecidas no formulário de saída.' },
    { chave: 'equipamentos', rotulo: 'Equipamentos',       tipo: 'texto',  icone: 'caixa',
      ajuda: 'Categorias de equipamento.' },
    { chave: 'modelos',     rotulo: 'Modelos',             tipo: 'modelo', icone: 'etiqueta',
      ajuda: 'Modelos e a categoria a que pertencem.' },
    { chave: 'predios',     rotulo: 'Prédios',             tipo: 'texto',  icone: 'predio',
      ajuda: 'Prédios de origem e de destino.' },
    { chave: 'setores',     rotulo: 'Setores / Unidades',  tipo: 'texto',  icone: 'predio',
      ajuda: 'Setores e unidades, válidos para entrada e saída.' },
    { chave: 'tecnicos',    rotulo: 'Técnicos responsáveis', tipo: 'texto', icone: 'usuario',
      ajuda: 'Técnicos que podem ser indicados como responsáveis pela saída.' }
  ];

  /** Estado de fábrica completo, usado na primeira carga e no "restaurar". */
  CELAB.listasPadrao = function () {
    return {
      status: CELAB.STATUS_PADRAO.map(function (s) { return Object.assign({}, s, { contextos: s.contextos.slice() }); }),
      ttrEntrada: CELAB.TTR_ENTRADA_PADRAO.slice(),
      ttrSaida: CELAB.TTR_SAIDA_PADRAO.slice(),
      equipamentos: CELAB.EQUIPAMENTOS_PADRAO.slice(),
      modelos: CELAB.MODELOS_PADRAO.slice(),
      predios: CELAB.PREDIOS_PADRAO.slice(),
      setores: CELAB.SETORES_PADRAO.slice(),
      tecnicos: CELAB.TECNICOS_PADRAO.slice(),
      modelosPorEquipamento: JSON.parse(JSON.stringify(CELAB.MODELOS_POR_EQUIPAMENTO_PADRAO))
    };
  };

  /* ======================================================================
     9. Perfis de acesso
     ====================================================================== */

  CELAB.PERFIS = {
    admin:   { rotulo: 'Administrador', podeExcluir: true,  podeEditar: true,  podeGerenciarListas: true, podeImportar: true },
    tecnico: { rotulo: 'Técnico',       podeExcluir: false, podeEditar: true,  podeGerenciarListas: true, podeImportar: true },
    leitura: { rotulo: 'Consulta',      podeExcluir: false, podeEditar: false, podeGerenciarListas: false, podeImportar: false }
  };

})(window.CELAB);
