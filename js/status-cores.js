/* ==========================================================================
   SAGE-TI — Mapa de cores por status
   --------------------------------------------------------------------------
   O sistema de "tom" (SAGETI.STATUS_PADRAO / SAGETI.TONS, em config.js) agrupa
   os status em 6 famílias semânticas (good/warning/serious/critical/info/
   neutral) — é o que alimenta o donut da Dashboard, onde 17 fatias coloridas
   uma a uma virariam ruído. Este arquivo cobre o requisito complementar:
   uma cor DISTINTA por status individual, para badges de tabela e para a
   exportação em Excel, onde cada linha já carrega o rótulo do status ao lado
   da cor — a cor nunca é o único jeito de identificar a situação.

   As cores foram checadas com o validador de paleta categórica do design
   system (separação por daltonismo, faixa de luminosidade, contraste). Como
   são 17 rótulos — acima do teto de ~8 que o validador considera seguro para
   uma legenda só-de-cor — famílias próximas (ex.: os três status de defeito)
   ficam com tons vizinhos de propósito: a cor reforça o parentesco entre
   situações relacionadas, e o texto do rótulo é que garante a distinção.
   ========================================================================== */

window.SAGETI = window.SAGETI || {};

(function (SAGETI) {
  'use strict';

  /** claro = fundo claro (telas); escuro = fundo escuro (tema dark). */
  var CORES = {
    'Estoque':                  { claro: '#0ca30c', escuro: '#34cc3a' },
    'Entrada de Estoque':       { claro: '#1baf7a', escuro: '#44d8a3' },
    'Manutenção':                { claro: '#d68f00', escuro: '#f6b531' },
    'Defeito':                  { claro: '#d03b3b', escuro: '#d98383' },
    'Substituição Defeito':      { claro: '#b23a72', escuro: '#d06e9c' },
    'Devolucao Defeito':         { claro: '#9c4a3b', escuro: '#c47364' },
    'Leilão':                    { claro: '#ec835a', escuro: '#eba185' },
    'Devolução Eq. Obsoleto':    { claro: '#a05a1a', escuro: '#d38238' },
    'Devolução':                 { claro: '#2a78d6', escuro: '#75a4dc' },
    'Devolução Empréstimo':      { claro: '#163f66', escuro: '#3f86ca' },
    'Empréstimo':                { claro: '#4a3aa7', escuro: '#7668cb' },
    'Substituição':               { claro: '#6c5ce0', escuro: '#978de2' },
    'Disponibilizado':           { claro: '#64748b', escuro: '#919eb0' },
    'Solicitação':                { claro: '#0e9c9c', escuro: '#22c4c4' },
    'Subs. Equip. Defeito':      { claro: '#a6482f', escuro: '#c77560' },
    'Subs. Equip. Obsoleto':     { claro: '#b5860a', escuro: '#e9b428' },
    'Doação':                    { claro: '#1f8a5f', escuro: '#41c892' }
  };

  /** Tom de reserva para status fora do mapa (criados pelo usuário). */
  var COR_TOM_RESERVA = {
    good: '#0ca30c', warning: '#d68f00', serious: '#ec835a',
    critical: '#d03b3b', info: '#2a78d6', neutral: '#64748b'
  };

  function chaveNorm(status) {
    return SAGETI.util ? SAGETI.util.slug(status) : String(status || '').trim().toLowerCase();
  }

  // Índice por chave normalizada, para casar "Devolução" com "devolucao" etc.
  // Montado sob demanda (não no carregamento do script): normalizar depende
  // de SAGETI.util.slug, que só existe depois que js/ui.js carrega — e este
  // arquivo carrega antes, para que ui.js já possa usar SAGETI.statusCores.
  var INDICE = null;
  function indice() {
    if (!INDICE) {
      INDICE = {};
      Object.keys(CORES).forEach(function (k) { INDICE[chaveNorm(k)] = CORES[k]; });
    }
    return INDICE;
  }

  /** Cor de reserva quando o status não está no mapa fixo. */
  function corReserva(status) {
    var tom = 'neutral';
    if (SAGETI.listas && SAGETI.listas.statusMeta) tom = SAGETI.listas.statusMeta(status).tom || 'neutral';
    var hex = COR_TOM_RESERVA[tom] || COR_TOM_RESERVA.neutral;
    return { claro: hex, escuro: hex };
  }

  /** { claro, escuro } — os dois hex cadastrados (ou a cor de reserva pelo tom). */
  function par(status) {
    return indice()[chaveNorm(status)] || corReserva(status);
  }

  /** Hex único para o tema atual da tela. */
  function hex(status) {
    var p = par(status);
    var tema = (SAGETI.ui && SAGETI.ui.temaAtual) ? SAGETI.ui.temaAtual() : 'light';
    return tema === 'dark' ? p.escuro : p.claro;
  }

  /** #rrggbb -> "rr,gg,bb" (0-255). */
  function rgb(h) {
    h = String(h || '#000000').replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  /** Luminância relativa (WCAG) — decide se o texto sobre a cor deve ser preto ou branco. */
  function luminancia(h) {
    var c = rgb(h).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  /** Preto ou branco — o que render mais legível sobre o hex informado. */
  function corTextoSobre(h) {
    return luminancia(h) > 0.42 ? '#0b0b0b' : '#ffffff';
  }

  /**
   * Estilo inline para um badge de status — fundo suave na cor do status,
   * ponto sólido, texto sempre em --text-primary (mesma regra dos chips por
   * "tom" já existentes: contraste garantido em qualquer matiz, claro ou
   * escuro, sem precisar calcular luminância a cada troca de tema).
   */
  function estiloBadge(status) {
    var h = hex(status);
    return {
      dot: h,
      background: 'color-mix(in srgb, ' + h + ' 16%, var(--surface-1))',
      borderColor: 'color-mix(in srgb, ' + h + ' 38%, transparent)'
    };
  }

  /** Cor para preencher a célula "Status" na exportação em Excel (fundo sólido + fonte legível). */
  function paraExcelFill(status) {
    var h = par(status).claro; // impressão usa sempre a variante clara
    return { fundoARGB: 'FF' + h.replace('#', '').toUpperCase(), fonteARGB: 'FF' + corTextoSobre(h).replace('#', '').toUpperCase() };
  }

  SAGETI.statusCores = {
    lista: Object.keys(CORES),
    hex: hex,
    par: par,
    estiloBadge: estiloBadge,
    paraExcelFill: paraExcelFill
  };

})(window.SAGETI);
