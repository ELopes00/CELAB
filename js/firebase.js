/* ==========================================================================
   SAGE-TI — Inicialização do Firebase (Auth + Firestore)
   --------------------------------------------------------------------------
   SDK compat (via CDN, ver index.html) para manter o mesmo estilo de script
   clássico do resto do projeto — sem bundler, sem import/export ES.
   A apiKey abaixo NÃO é segredo: ela só identifica o projeto: quem pode ler
   e escrever de fato é decidido pelas regras em firestore.rules.

   MODO EMULADOR: se `window.SAGETI_USE_EMULATOR` estiver setado (true) ANTES
   deste script carregar, liga no Firestore/Auth emulators locais em vez do
   projeto de produção — usado só por tests/autoteste.html, nunca pelo
   index.html publicado. Assim os testes nunca tocam dados reais.
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
  var auth = firebase.auth();
  var db = firebase.firestore();

  if (window.SAGETI_USE_EMULATOR) {
    auth.useEmulator('http://localhost:9099', { disableWarnings: true });
    db.useEmulator('localhost', 8090);
  }

  SAGETI.fb = { app: app, auth: auth, db: db };

})(window.SAGETI);
