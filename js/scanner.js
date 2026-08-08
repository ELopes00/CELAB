/* ==========================================================================
   SAGE-TI — Scanner de código de barras (tombo/patrimônio)
   --------------------------------------------------------------------------
   Usa @zxing/browser (CDN, global ZXingBrowser — carregado em index.html).
   Abre a câmera do dispositivo em um modal e devolve o texto lido; quem
   chamou decide o que fazer com ele (normalmente preencher um campo de
   tombo). Câmera exige contexto seguro (https ou localhost) — em outro
   caso o navegador nem oferece getUserMedia, e avisamos em vez de falhar
   calado.
   ========================================================================== */

window.SAGETI = window.SAGETI || {};

(function (SAGETI) {
  'use strict';

  function temSuporte() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
      typeof window.ZXingBrowser !== 'undefined';
  }

  function contextoSeguro() {
    return window.isSecureContext !== false; // undefined em navegadores antigos: assume ok
  }

  /**
   * Abre a câmera em um modal e lê um código de barras/QR.
   * @param {(codigo:string)=>void} aoLer chamado uma vez, com o texto decodificado
   * @param {{titulo?:string}} [opcoes]
   */
  function abrir(aoLer, opcoes) {
    var UI = SAGETI.ui;
    opcoes = opcoes || {};

    if (!temSuporte()) {
      return UI.toast('warn', 'Câmera indisponível',
        contextoSeguro()
          ? 'A biblioteca de leitura não carregou (sem internet?). Digite o tombo manualmente.'
          : 'A leitura por câmera exige HTTPS (ou localhost). Sirva o SAGE-TI por um endereço seguro para usar o scanner.');
    }

    var video = document.createElement('video');
    video.setAttribute('playsinline', 'true'); // essencial no iOS, senão abre em tela cheia nativa
    video.style.cssText = 'width:100%;border-radius:var(--radius);background:#000;aspect-ratio:4/3;object-fit:cover';

    var status = document.createElement('div');
    status.style.cssText = 'font-size:12px;color:var(--text-muted);margin-top:10px;text-align:center';
    status.textContent = 'Aponte a câmera para o código de barras do tombo…';

    var corpo = document.createElement('div');
    corpo.appendChild(video);
    corpo.appendChild(status);

    var controls = null;
    var lido = false;

    var ref = UI.modal({
      titulo: opcoes.titulo || 'Ler código de barras',
      subtitulo: 'Câmera do dispositivo',
      largura: 'sm',
      corpo: corpo,
      botoes: [{ texto: 'Cancelar', classe: 'btn--ghost', acao: function () { encerrar(); } }]
    });

    function encerrar() {
      if (controls) { try { controls.stop(); } catch (e) { /* já parado */ } controls = null; }
    }

    // Fecha a câmera também se o modal for fechado pelo X, Esc ou clique fora.
    var backdrop = ref.el.closest('.modal-backdrop');
    if (backdrop) {
      var obs = new MutationObserver(function () {
        if (!document.body.contains(backdrop)) { encerrar(); obs.disconnect(); }
      });
      obs.observe(document.body, { childList: true });
    }

    var reader = new window.ZXingBrowser.BrowserMultiFormatReader();

    reader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' } } },
      video,
      function (resultado, erro) {
        if (lido) return;
        if (resultado) {
          lido = true;
          status.textContent = 'Código lido: ' + resultado.getText();
          if (navigator.vibrate) navigator.vibrate(80);
          setTimeout(function () {
            encerrar();
            UI.fecharModal();
            aoLer(resultado.getText());
          }, 220);
        }
        // erro por "nada encontrado neste frame" é esperado a cada tentativa — ignora.
      }
    ).then(function (c) { controls = c; })
      .catch(function (e) {
        status.textContent = 'Não foi possível abrir a câmera.';
        UI.toast('error', 'Câmera bloqueada',
          e && e.name === 'NotAllowedError'
            ? 'Permita o acesso à câmera nas configurações do navegador para usar o scanner.'
            : 'Verifique se o dispositivo tem câmera disponível e tente novamente.');
      });
  }

  /**
   * Botão pronto para abrir o scanner e preencher um <input> pelo id.
   * Uso: container.insertAdjacentHTML('beforeend', SAGETI.scanner.botaoHTML('sa-tombo-novo'))
   * e então SAGETI.scanner.ligarBotoes(container).
   */
  function botaoHTML(alvoId, titulo) {
    return '<button type="button" class="icon-btn" data-scanner-alvo="' + alvoId + '" ' +
      'title="' + (titulo || 'Ler código de barras') + '" aria-label="Ler código de barras pela câmera">' +
      SAGETI.ui.icone('barcode', 16) + '</button>';
  }

  /** Liga (por delegação) todos os botões [data-scanner-alvo] dentro de um container. */
  function ligarBotoes(container) {
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-scanner-alvo]');
      if (!btn) return;
      var alvo = document.getElementById(btn.getAttribute('data-scanner-alvo'));
      if (!alvo) return;
      abrir(function (codigo) {
        alvo.value = codigo;
        alvo.dispatchEvent(new Event('input', { bubbles: true }));
        alvo.dispatchEvent(new Event('change', { bubbles: true }));
        // alguns campos só reagem no blur (ex.: localizar equipamento pelo tombo
        // na Entrada) — dispara o ciclo blur+focus para cobrir os dois casos.
        alvo.focus();
        alvo.blur();
        alvo.focus();
      });
    });
  }

  SAGETI.scanner = { abrir: abrir, botaoHTML: botaoHTML, ligarBotoes: ligarBotoes, temSuporte: temSuporte };

})(window.SAGETI);
