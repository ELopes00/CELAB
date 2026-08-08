/* ==========================================================================
   SAGE-TI — Inicialização do Firebase (Auth + Firestore)
   --------------------------------------------------------------------------
   SDK compat (via CDN, ver index.html) para manter o mesmo estilo de script
   clássico do resto do projeto — sem bundler, sem import/export ES.
   A apiKey abaixo NÃO é segredo: ela só identifica o projeto: quem pode ler
   e escrever de fato é decidido pelas regras em firestore.rules.
   ========================================================================== */

window.SAGETI = window.SAGETI || {};

(function (SAGETI) {
  'use strict';

  var config = {
    apiKey: 'AIzaSyD20BmJ2xDeHp9JbFPrT2eV15ChlVE1AOQ',
    authDomain: 'sagi-ti.firebaseapp.com',
    projectId: 'sagi-ti',
    storageBucket: 'sagi-ti.firebasestorage.app',
    messagingSenderId: '849395678661',
    appId: '1:849395678661:web:7210268d2b22fd8e071fac'
  };

  var app = firebase.initializeApp(config);

  SAGETI.fb = {
    app: app,
    auth: firebase.auth(),
    db: firebase.firestore()
  };

})(window.SAGETI);
