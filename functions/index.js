/* ==========================================================================
   SAGE-TI — Cloud Functions (Admin SDK)
   --------------------------------------------------------------------------
   Único lugar do projeto que usa o Admin SDK — que bypassa completamente as
   Firestore Rules. Por isso toda validação de negócio (perfil, tamanho,
   faixa de valores) tem que estar aqui dentro; as Rules não protegem estas
   chamadas.

   Duas funções, as únicas operações que o app precisa mas que o SDK do
   cliente (js/store.js) não consegue fazer com segurança sozinho:
     · excluirUsuario                — remove a conta de Auth de verdade,
       não só o documento em /usuarios.
     · adicionarPerifericosEmLote    — grava N equipamentos numa única
       transação atômica, com teto de negócio (não só o teto técnico de
       500 do WriteBatch).
   ========================================================================== */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

initializeApp();
const db = getFirestore();

const MAX_LOTE = 500; // mesmo teto do WriteBatch do Firestore — não é coincidência

/** Nunca confia no `perfil` que o cliente possa mandar — relê sempre do Firestore. */
async function perfilDoChamador(uid) {
  const doc = await db.collection('usuarios').doc(uid).get();
  return doc.exists ? doc.data().perfil : null;
}

function exigirAutenticado(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Faça login novamente.');
  return request.auth;
}

async function registrarAuditoria(acao, entidade, entidadeId, descricao, usuario) {
  await db.collection('auditoria').add({
    acao, entidade, entidadeId: entidadeId || '',
    descricao: String(descricao || '').slice(0, 500),
    usuario: usuario || 'sistema',
    registradoEm: FieldValue.serverTimestamp()
  });
}

/* ---------- excluirUsuario -------------------------------------------------
   Só admin. Remove o login (Admin SDK) e o documento de perfil. Sem isso,
   apagar só o doc do Firestore deixa a pessoa logando (cai pra perfil
   "leitura" por padrão, mas a conta continua ativa) — não é uma exclusão
   real.
   -------------------------------------------------------------------- */
exports.excluirUsuario = onCall(async (request) => {
  const chamador = exigirAutenticado(request);

  const perfilChamador = await perfilDoChamador(chamador.uid);
  if (perfilChamador !== 'admin') {
    throw new HttpsError('permission-denied', 'Apenas administradores podem excluir usuários.');
  }

  const alvoUid = request.data && request.data.uid;
  if (typeof alvoUid !== 'string' || !alvoUid) {
    throw new HttpsError('invalid-argument', 'uid do usuário-alvo é obrigatório.');
  }
  if (alvoUid === chamador.uid) {
    throw new HttpsError('failed-precondition', 'Você não pode excluir a própria conta.');
  }

  const alvoDoc = await db.collection('usuarios').doc(alvoUid).get();
  const alvoNome = alvoDoc.exists ? (alvoDoc.data().usuario || alvoUid) : alvoUid;

  await getAuth().deleteUser(alvoUid);
  await db.collection('usuarios').doc(alvoUid).delete();

  await registrarAuditoria('EXCLUSAO_USUARIO', 'usuarios', alvoUid,
    'Usuário "' + alvoNome + '" excluído.', chamador.token.email || chamador.uid);

  return { ok: true };
});

/* ---------- adicionarPerifericosEmLote -------------------------------------
   Admin ou técnico. O teto de 1..500 é decidido AQUI, antes de tocar o
   banco — é isso que impede um "999999" de virar um ataque de exaustão de
   recursos (o WriteBatch do Firestore já limita a 500 operações por
   transação, mas nada impediria alguém de disparar 2000 lotes em
   sequência sem este teto de negócio).
   -------------------------------------------------------------------- */
exports.adicionarPerifericosEmLote = onCall(async (request) => {
  const chamador = exigirAutenticado(request);

  const perfil = await perfilDoChamador(chamador.uid);
  if (perfil !== 'admin' && perfil !== 'tecnico') {
    throw new HttpsError('permission-denied', 'Seu perfil não pode cadastrar equipamentos.');
  }

  const dados = request.data || {};
  const equipamento = typeof dados.equipamento === 'string' ? dados.equipamento.trim() : '';
  const modelo = typeof dados.modelo === 'string' ? dados.modelo.trim() : '';
  const qtd = Number(dados.quantidade);

  if (!equipamento || equipamento.length > 80) {
    throw new HttpsError('invalid-argument', 'Categoria do equipamento inválida.');
  }
  if (!modelo || modelo.length > 80) {
    throw new HttpsError('invalid-argument', 'Modelo inválido.');
  }
  if (!Number.isInteger(qtd) || qtd < 1 || qtd > MAX_LOTE) {
    throw new HttpsError('invalid-argument', 'Quantidade deve ser um inteiro entre 1 e ' + MAX_LOTE + '.');
  }

  const agora = new Date().toISOString();
  const hoje = agora.slice(0, 10);
  const lote = db.batch();
  const colecao = db.collection('equipamentos');

  for (let i = 0; i < qtd; i++) {
    const ref = colecao.doc();
    lote.set(ref, {
      equipamento, modelo,
      tomboNovo: '', tomboAntigo: '',
      status: 'Estoque', noLaboratorio: true,
      chamado: '', servicoSolicitado: '', ttr: '', tecnico: '',
      dataEntrada: hoje, predioOrigem: '', setorOrigem: '',
      dataSaida: '', predioDestino: '', setorDestino: '',
      criadoEm: agora, atualizadoEm: agora
    });
  }

  await lote.commit();

  await registrarAuditoria('LOTE_PERIFERICOS', 'equipamentos', '',
    qtd + ' unidade(s) de "' + modelo + '" (' + equipamento + ') adicionadas em lote.',
    chamador.token.email || chamador.uid);

  return { ok: true, criados: qtd };
});
