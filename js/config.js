/* ==========================================================================
   SAGE-TI — Configuração e listas PADRÃO
   --------------------------------------------------------------------------
   IMPORTANTE: o que está aqui é o *padrão de fábrica*. Em tempo de execução
   as listas vivem em SAGETI.listas (persistidas e editáveis pela interface).
   Sempre leia via SAGETI.listas.get('setores'), nunca deste arquivo.

   Este arquivo é a fonte para:
     · a primeira carga do sistema;
     · o botão "Restaurar padrão" do gerenciador de listas;
     · a incorporação de novas opções de fábrica em bases já existentes.
   ========================================================================== */

window.SAGETI = window.SAGETI || {};

(function (SAGETI) {
  'use strict';

  SAGETI.APP = {
    nome: 'SAGE-TI',
    descricao: 'Sistema de Ativos e Gestão de Estoque de Tecnologia da Informação',
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

  SAGETI.STATUS_PADRAO = [
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

  SAGETI.TTR_ENTRADA_PADRAO = [
    'Realizada', 'Pendente', 'Retornou', 'Não consta no GRP', 'Garantia'
  ];

  SAGETI.TTR_SAIDA_PADRAO = [
    'Realizada', 'Pendente', 'Retornou', 'Empréstimo', 'Nao consta no GRP'
  ];

  /* ======================================================================
     3. TÉCNICOS RESPONSÁVEIS
     ====================================================================== */

  // Array de técnicos
  SAGETI.TECNICOS_PADRAO = [
    
    'Keittony Rodrigo',
    'Axl Henrique',
    'Breno Simão',
    'Ricardo Marques',
    'Fernando Nascimento',
    'Rafael Soares',
    'Adriel Carvalho',
    'James Viana',
    'Lucas Fernandes',
    'Hellen Crys',
    'Bruno Benedetto',
    'Eduardo Felipe',
    'Jonas Sousa',
    'Fabio Lima',
    'Ezequiel Castro'
  ];

  /* ======================================================================
     4. EQUIPAMENTOS
     ====================================================================== */

  SAGETI.EQUIPAMENTOS_PADRAO = [
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

  SAGETI.MODELOS_PADRAO = [
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
  SAGETI.MODELOS_POR_EQUIPAMENTO_PADRAO = {
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
  SAGETI.PREDIOS_PADRAO = [
    'Sede Administrativa',
    'Forum Civel',
    'Palácio',
    'Forum Criminal',
    'Conj. Desembargadores',
    'CA - Comarca de Alto Alegre',
    'CB - Comarca de Bonfim',
    'CC - Comarca de Caracarai',
    'CP - Comarca de Pacaraima',
    'CM - Comarca de Mucajai',
    'CS - Comarca de Sao Luiz do Anaua',
    'CRO - Comarca de Rorainopolis',
    'Vara Infancia e Juventude',
    'Casa da Mulher Brasileira',
    'PA - Amajari',
    'PA - Iracema',
    'PA - Normandia',
    'PA - Triagem PETRIG',
    'PA - Uiramutã',
    'PA - Wamiri',
    'NCTC - Nucleo de Conciliacao do Terminal do Centro',
    'PAMC',
    'NUPAC',
    'VISITA TÉCNICA COMARCA',
    'TC - Terminal Caimbe',
    'CPM - Cadeia Publica Masculina',
    'AG - Arquivo Geral',
    'CA - Casa Alferes',
    'CPF - Cadeia Publica Feminina',
    'CSE',
    'Fórum da Cidadania',
    'PAC - Posto Avancado de Caroebe'
  ];

  /* ======================================================================
     7. SETORES / UNIDADES — vale para Entrada e Saída
     ====================================================================== */

  //Array de departamentos
  SAGETI.SETORES_PADRAO = [
    'Setor de Auditoria Interna-SAI',
    '1CIR - 1ª Vara Cível Residual',
    '1CRR - 1ª Vara Cível Residual',
    '1JVD - 1º Juizado de Violência Doméstica',
    '1VCJ - 1ª Vara Criminal do Júri',
    '1VCRR - 1ª Vara Criminal Residual',
    '1VF - 1ª Vara de Família',
    '1VFP - 1ª Vara da Fazenda Pública',
    '1VTJ - 1ª Vara do Tribunal de Júri e da Justiça Militar',
    '1º Juizado Especial Cível',
    '2CIR - 2ª Vara Cível Residual',
    '2CIR-SEC - SECRETARIA DA 2ª VARA CIVEL',
    '2VF - 2ª Vara de Família',
    '2VFP - 2ª Vara da Fazenda Pública',
    '2VTJ - 2ª Vara Tribunal Júri Justiça Militar',
    '2ª Vara Cível',
    '2° Vara Criminal',
    '3 Juizado de Violência Doméstica',
    '3CIR - 3ª Vara Cível Residual',
    '3ª Vara Criminal',
    '4CIR - 4ª Vara Cível Residual',
    '5CIR - 5ª Vara Cível Residual',
    '6CIR - 6ª Vara Cível Residual',
    'Almoxarifado manuntenção predial',
    'Assessoria Jurídica da Presidência',
    'BIBLIOTECA - Biblioteca',
    'CA - Comarca de Alto Alegre',
    'CART/VJI - Vara Justiça Itinerante',
    'CB - Comarca de Bonfim',
    'CC - Comarca de Caracarai',
    'CC - Comarca de Caracaraí',
    'CCiv - CCr -Câmara Cível e Criminal',
    'CEJUSC-SEG - Centro Judiciário de Solução de Conflitos e Cidadania do Segundo Grau',
    'CEJUSCS - Centros Judiciários de Soluções de Conflitos',
    'CEMAN - Central de Mandados',
    'CEMSVDF - Coordenadoria Estadual da Mulher em Situação de Violência Doméstica e Familiar',
    'CERIMONIAL - Assessoria de Cerimonial',
    'CGJ - Corregedoria-Geral de Justiça',
    'CIJ - Coordenadoria da Infância e Juventude',
    'CM - Comarca de Mucajaí',
    'CMC-RR - Centro de Memória e Cultura',
    'CP - Comarca de Pacaraima',
    'CPLJ - Comissão Permanente de Legislação e Jurisprudência',
    'CPM - Cadeia Pública Masculina',
    'CRO - Comarca de Rorainópolis',
    'CS - Comarca de São Luiz do Anauá',
    'Casa da Mulher Brasileira',
    'Conj. Desembargadores - Casa 08',
    'Conselho Penitenciário',
    'Contadoria do Fórum Cível',
    'Coordenadoria Do Juizado De Violência Doméstica',
    'DFC - Diretoria do Fórum Criminal',
    'DFCI - Diretoria do Fórum Cível',
    'DG1G - Diretoria de Gestão do 1º Grau',
    'Distribuição e Atermação',
    'EIP/VIJ - Vara da Infância e Juventude',
    'EJURR - Escola do Poder Judiciário',
    'EMP - Equipe Multiprofissional',
    'Field Service N2/SUBCS - Sub. de Central de Serviços',
    'G2VCI - Gabinete da 2ª Vara Cível',
    'G3JE - Gabinete do 3º Juizado',
    'GAB - Comarca de Caracaraí',
    'GAB/1VF - 2ª Vara de Família',
    'GAB/VJI - Vara da Justiça Itinerante',
    'GABJA - Gabinete do Juiz Auxiliar',
    'GABMIL - Gabinete Militar',
    'GAP - Gabinete Des. Almiro Padilha',
    'GCS - Gabinete Des. Cristóvão Suter',
    'GEB - Gabinete Desª. Elaine Bianchi',
    'GEL - Gabinete do Des. Erick Linhares',
    'GJN - Gabinete Des. Jésus Nascimento',
    'GLC - Gabinete Des. Leonardo Cupello',
    'GMAC - Gabinete Des. Mauro Campello',
    'GMF - Grupo de Monit. e Fiscalização',
    'GMOC - Gabinete Des. Mozarildo Cavalcante',
    'GRO - Gabinete Des. Ricardo Oliveira',
    'GTV - Gabinete Desª. Tânia Vasconcelos',
    'Gabinete Des. Ricardo Oliveira',
    'Gabinete dos Juízes Substitutos do Fórum Criminal',
    'Gabinete dos juízes substitutos do Fórum cível',
    'INOVAJURR - Laboratório de Inovação',
    'JECRIM - Juizado Especial Criminal',
    'JESPCR - Juizado Especial Criminal',
    'JESPFAZ - Juizado Especial da Fazenda Pública',
    'JVD - Juizados de Violência Doméstica',
    'Justiça Comunitária Sala 314',
    'NATJUS – Núcleo de Apoio Técnico ao Poder Judiciário',
    'NGD - Núcleo de Gerenciamento de Demandas',
    'NPI – Núcleo de Projetos e Inovação',
    'NUCRI - Núcleo Comunicação e de Relações Institucionais',
    'NUGEPNAC - Núcleo de Gerenciamento de Precedentes de Ações Coletivas',
    'NUJAD - Núcleo Jurídico Administrativo',
    'NUPAC - Núcleo Plantão Judicial e Audiências de Custódia',
    'NUPEMEC - Núcleo Permanente de Métodos Consensuais de Solução de Conflitos',
    'NUPREC - Núcleo de Precatórios',
    'Núcleo de Justiça 4.0',
    'OAB',
    'OUVG - Ouvidoria-Geral',
    'PACT - Posto Avançado do Cantá',
    'PAMC - Penitenciária Agrícola de Monte Cristo',
    'PR – Presidência',
    'Protocolo Administrativo',
    'Recepção do Fórum Cível',
    'SAA - Setor de Atividades de Apoio',
    'SAD - Setor de Análise de Dados',
    'SADA - Setor de Atendimento',
    'SAF - Subsecretaria de Acompanhamento Funcional',
    'SAINC - Setor de Acessibilidade e Inclusão',
    'SALC - Subsecretaria de Aquisições',
    'SARG - Setor de Arquivo Geral',
    'SCGJ - Secretaria da Corregedoria Geral de Justiça',
    'SCONV - Setor de Convênios e Congêneres',
    'SCR - Secretaria das Câmaras Reunidas',
    'SDAD - Setor Dados Apoio Decisão',
    'SDCRIM - Setor de Distribuição Criminal',
    'SDEP - Setor de Distribuição de Execução Penal',
    'SEC/2VF - 2ª Vara de Família',
    'SEC/VJI - Vara Justiça Itinerante',
    'SG - Secretaria Geral',
    'SGA - Secretaria de Gestão Administrativa',
    'SGCTI - Subsecretaria de Gestão de Contratos de TIC',
    'SGE - Secretaria de Gestão Estratégica',
    'SGM - Secretaria de Gestão de Magistrados',
    'SGP - Secretaria de Gestão de Pessoas',
    'SIL - Secretaria de Infraestrutura e Logística',
    'SINFRA - Subsecretaria de Infraestrutura',
    'SJRI - Secretaria Judicial Remota do Interior',
    'SL - Setor de Logística',
    'SME - Setor de Movimentação Processual e Execução',
    'SMP - Setor de Manutenção Predial',
    'SOF - Secretaria de Orçamento e Finanças',
    'SPA - Setor de Prot. Administrativo',
    'SPAPCIVEL - Setor de Primeiro Atendimento e Protocolo Cível',
    'SPAPCRIM - Setor de Primeiro Atendimento e Protocolo Criminal',
    'SQV - Setor de Qualidade de Vida',
    'SSA - Setor de Sistemas Administrativos',
    'SSJ - Setor de Sistemas Judiciais',
    'SST- Setor de Serviços Terceirizados',
    'STI - Secretaria de Tecnologia da Informação',
    'STP - Secretaria do Tribunal Pleno',
    'STSSP - Sala de Togas da Sala de Sessões do Pleno',
    'SUBA - Subsecretaria de Arrecadação',
    'SUBADP - Subsecretaria de Análise de Despesas com Pessoal',
    'SUBALC - Subsecretaria de Aquisição, Licitação e Compras',
    'SUBC - Subsecretaria de Contabilidade',
    'SUBCIBER - Subsecretária de de Cibersegurança',
    'SUBCON - Subsecretaria de Contratos',
    'SUBCOT - Subsecretaria de Contratos de Terceirizados',
    'SUBCS - Subsecretaria de Central de Serviços',
    'SUBF - Subsecretaria de Finanças',
    'SUBGEP - Subsecretaria de Gestão Estratégica de Pessoas',
    'SUBGFT - Sub. Gestão de Força de Trabalho',
    'SUBINF - Subsecretaria de Infraestrutura de TIC',
    'SUBO - Sub. de Orçamento',
    'SUBP - Subsecretaria de Patrimônio',
    'SUBPTIC - Sub. Projetos de TIC',
    'SUBSI - Subsecretaria de Sistemas',
    'SUJVD - Secretaria Unificada dos Juizados de Violência Doméstica',
    'SUVC - Secretaria Unificada das Varas Criminais',
    'SUVIJ - Secretaria Unificada das Varas da Infância e Juventude',
    'Secretaria Unificada dos Nucleos de Justiça 4.0',
    'Secretaria da 6° Vara Civil',
    'Segundo Juizado Especial Cível',
    'Service Desk/SUBCS - Sub. de Central de Serviços',
    'Setor Interprofissional das Varas da Infancia e Juventude',
    'Subsecretaria De Gestão Documental',
    'TP - Tribunal Pleno',
    'TUR - Turma Recursal',
    'UJR - Unidade de Justiça Restaurativa',
    'VCV - Vara de Crimes Contra Vulneráveis',
    'VE - Vara de Entorpecentes e Organizações Criminosas',
    'VEF - Vara de Execução Fiscal',
    'VEP - Vara de Execução Penal',
    'VEPEMA - Vara de Penas e Medidas Alternativas',
    'VPR - Vice-Presidência'
  ];

  /* ======================================================================
     8. Metadados das listas — dirigem o gerenciador de opções
     ====================================================================== */

  SAGETI.TONS = [
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
  SAGETI.CATALOGO_LISTAS = [
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
  SAGETI.listasPadrao = function () {
    return {
      status: SAGETI.STATUS_PADRAO.map(function (s) { return Object.assign({}, s, { contextos: s.contextos.slice() }); }),
      ttrEntrada: SAGETI.TTR_ENTRADA_PADRAO.slice(),
      ttrSaida: SAGETI.TTR_SAIDA_PADRAO.slice(),
      equipamentos: SAGETI.EQUIPAMENTOS_PADRAO.slice(),
      modelos: SAGETI.MODELOS_PADRAO.slice(),
      predios: SAGETI.PREDIOS_PADRAO.slice(),
      setores: SAGETI.SETORES_PADRAO.slice(),
      tecnicos: SAGETI.TECNICOS_PADRAO.slice(),
      modelosPorEquipamento: JSON.parse(JSON.stringify(SAGETI.MODELOS_POR_EQUIPAMENTO_PADRAO))
    };
  };

  /* ======================================================================
     9. Perfis de acesso
     ====================================================================== */

  SAGETI.PERFIS = {
    admin:   { rotulo: 'Administrador', podeExcluir: true,  podeEditar: true,  podeGerenciarListas: true, podeImportar: true },
    tecnico: { rotulo: 'Técnico',       podeExcluir: false, podeEditar: true,  podeGerenciarListas: true, podeImportar: true },
    leitura: { rotulo: 'Consulta',      podeExcluir: false, podeEditar: false, podeGerenciarListas: false, podeImportar: false }
  };

})(window.SAGETI);
