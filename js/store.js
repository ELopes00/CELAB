/* ==========================================================================
   SAGE-TI — Store: estado global, persistência (Firestore) e regras de negócio
   --------------------------------------------------------------------------
   Fonte única da verdade. Os dados moram no Firestore (coleções `equipamentos`
   e `movimentacoes`) — este módulo mantém `estado` como um espelho em memória,
   mantido fresco por listeners em tempo real (`onSnapshot`). Por isso toda
   função de LEITURA (listarEquipamentos, acharPorId, resumo…) continua
   síncrona: ela só lê o espelho, nunca fala com a rede diretamente.

   Toda função de ESCRITA (registrarEntrada, criarEquipamento…) devolve uma
   Promise: ela grava no Firestore e é o próprio listener em tempo real quem
   atualiza `estado` e dispara `emit()` — o mesmo caminho usado quando a
   mudança vem de outro navegador. Não existe mais `emit()` manual dentro das
   mutações: a tela sempre reage ao servidor, nunca a uma suposição local.

   PRESENÇA FÍSICA: cada equipamento carrega `noLaboratorio` (booleano). Quem
   define é a operação — entrada põe true, saída põe false, edição no estoque
   usa o padrão do status. A Dashboard lê esse campo e nunca precisa
   interpretar o texto do status, que é livre e editável pelo usuário.
   ========================================================================== */

(function (SAGETI) {
  'use strict';

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

  /* ---------- Estado (espelho local do Firestore) --------------------------- */

  var estado = {
    equipamentos: [],
    movimentacoes: [],
    meta: { criadoEm: null, versao: 2 }
  };

  function colEquip() { return SAGETI.fb.db.collection('equipamentos'); }
  function colMov() { return SAGETI.fb.db.collection('movimentacoes'); }
  function colUsuarios() { return SAGETI.fb.db.collection('usuarios'); }
  function colAuditoria() { return SAGETI.fb.db.collection('auditoria'); }

  /* ---------- Auditoria (append-only) ---------------------------------------
     Trilha de "quem mudou o quê", separada de `movimentacoes` (que é o
     histórico operacional de equipamento). As Rules do Firestore bloqueiam
     update/delete desta coleção para todo mundo, inclusive admin — a
     imutabilidade é garantida no servidor, não só aqui.
     -------------------------------------------------------------------- */

  // Nunca gravar nada que pareça senha/token, mesmo por engano do chamador.
  var PADRAO_SENSIVEL = /senha|password|token/i;

  function registrarAuditoria(acao, entidade, entidadeId, descricao) {
    var usuarioAtual = SAGETI.auth && SAGETI.auth.usuarioAtual();
    var texto = String(descricao || '').slice(0, 500);
    if (PADRAO_SENSIVEL.test(texto)) texto = '[registro omitido — continha termo sensível]';

    return colAuditoria().add({
      acao: String(acao || '').slice(0, 60),
      entidade: String(entidade || '').slice(0, 40),
      entidadeId: String(entidadeId || ''),
      descricao: texto,
      usuario: (usuarioAtual && usuarioAtual.usuario) || 'sistema',
      registradoEm: agora()
    }).catch(function (erro) {
      // Auditoria nunca deve travar a operação principal — só registra o
      // problema no console para investigação.
      console.error('[SAGE-TI] Falha ao gravar auditoria:', erro);
    });
  }

  /* ---------- Pub/sub -------------------------------------------------------- */

  var ouvintes = [];

  function emit(evento) {
    var detalhe = evento || { tipo: 'sync' };
    ouvintes.forEach(function (fn) {
      try { fn(detalhe, estado); } catch (e) { console.error('[SAGE-TI] Erro em ouvinte:', e); }
    });
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

  /* ---------- Listeners em tempo real (equipamentos / movimentações) -------- */

  var pararEquip = null, pararMov = null;

  /** Liga os listeners do Firestore — só depois de autenticado (regras exigem). */
  function ligarListenersDados() {
    desligarListenersDados();

    pararEquip = colEquip().onSnapshot(function (snap) {
      estado.equipamentos = snap.docs.map(function (d) {
        return Object.assign({ id: d.id }, d.data());
      });
      emit({ tipo: 'sync' });
    }, function (erro) {
      console.error('[SAGE-TI] Falha ao sincronizar equipamentos:', erro);
    });

    pararMov = colMov().orderBy('registradoEm', 'desc').onSnapshot(function (snap) {
      estado.movimentacoes = snap.docs.map(function (d) {
        return Object.assign({ id: d.id }, d.data());
      });
      emit({ tipo: 'sync' });
    }, function (erro) {
      console.error('[SAGE-TI] Falha ao sincronizar movimentações:', erro);
    });
  }

  function desligarListenersDados() {
    if (pararEquip) { pararEquip(); pararEquip = null; }
    if (pararMov) { pararMov(); pararMov = null; }
    estado.equipamentos = [];
    estado.movimentacoes = [];
  }

  /* ---------- Histórico ---------------------------------------------------- */

  /** Grava uma movimentação no Firestore. Devolve uma Promise<registro>. */
  function registrarMovimentacao(mov) {
    var usuarioAtual = (SAGETI.auth && SAGETI.auth.usuarioAtual());
    var registro = Object.assign({ registradoEm: agora(), tecnico: '' }, mov);
    // Nunca deixa `usuario` como undefined: o Firestore rejeita o documento
    // inteiro se qualquer campo vier undefined (diferente de omitir a chave).
    // `mov.usuario` normalmente nem existe (opcoes.usuario não informado).
    registro.usuario = mov.usuario || (usuarioAtual && usuarioAtual.usuario) || 'sistema';
    return colMov().add(registro).then(function (ref) {
      registro.id = ref.id;
      return registro;
    });
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

  /** Usado pelo módulo de listas ao renomear uma opção em cascata (fire-and-forget). */
  function _setCampoEquipamento(id, campo, valor) {
    var e = acharPorId(id);
    if (!e) return false;
    var patch = {};
    patch[campo] = valor;
    patch.atualizadoEm = agora();
    colEquip().doc(id).update(patch).catch(function (erro) {
      console.error('[SAGE-TI] Falha ao atualizar equipamento em cascata:', erro);
    });
    return true;
  }

  function _setCampoMovimentacao(id, campo, valor) {
    var patch = {};
    patch[campo] = valor;
    colMov().doc(id).update(patch).catch(function (erro) {
      console.error('[SAGE-TI] Falha ao atualizar movimentação em cascata:', erro);
    });
    return true;
  }

  /** Molde de um equipamento novo (sem `id` — quem grava decide a chave). */
  function novoEquipamento(dados) {
    return {
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
      return Promise.resolve({
        ok: false,
        erro: 'Já existe um equipamento com o tombo ' + (dados.tomboNovo || dados.tomboAntigo) + '.',
        equipamento: duplicado
      });
    }

    var eq = novoEquipamento(dados);
    // Cadastro direto: a presença física vem do padrão do status escolhido.
    eq.noLaboratorio = noLabDoStatus(eq.status);
    if (!eq.noLaboratorio) {
      eq.dataSaida = dados.dataSaida || '';
      eq.predioDestino = norm(dados.predioDestino);
      eq.setorDestino = norm(dados.setorDestino);
    }

    return colEquip().add(eq).then(function (ref) {
      eq.id = ref.id;
      return registrarMovimentacao({
        tipo: 'CADASTRO', data: eq.dataEntrada, equipamentoId: eq.id,
        equipamento: eq.equipamento, modelo: eq.modelo,
        tomboNovo: eq.tomboNovo, tomboAntigo: eq.tomboAntigo,
        chamado: eq.chamado, servicoSolicitado: eq.servicoSolicitado,
        statusResultante: eq.status, predio: eq.predioOrigem, setor: eq.setorOrigem,
        ttr: eq.ttr, tecnico: eq.tecnico, usuario: opcoes.usuario,
        observacao: 'Cadastro direto no estoque do laboratório.'
      });
    }).then(function () {
      return { ok: true, equipamento: eq };
    }).catch(function (erro) {
      return { ok: false, erro: 'Falha ao gravar no Firestore: ' + erro.message };
    });
  }

  function atualizarEquipamento(id, mudancas, opcoes) {
    opcoes = opcoes || {};
    var eq = acharPorId(id);
    if (!eq) return Promise.resolve({ ok: false, erro: 'Equipamento não encontrado.' });

    var alvo = {
      tomboNovo: mudancas.tomboNovo != null ? mudancas.tomboNovo : eq.tomboNovo,
      tomboAntigo: mudancas.tomboAntigo != null ? mudancas.tomboAntigo : eq.tomboAntigo
    };
    var chaveAlvo = chaveTombo(alvo);
    var colisao = chaveAlvo && estado.equipamentos.find(function (o) {
      return o.id !== id && chaveTombo(o) === chaveAlvo;
    });
    if (colisao) return Promise.resolve({ ok: false, erro: 'O tombo informado já pertence a outro equipamento.' });

    var statusAnterior = eq.status;
    var patch = {};
    Object.keys(mudancas).forEach(function (k) {
      if (mudancas[k] !== undefined) {
        patch[k] = typeof mudancas[k] === 'string' ? norm(mudancas[k]) : mudancas[k];
      }
    });

    // Edição pelo Estoque: o status escolhido determina a presença física.
    if (mudancas.status !== undefined && mudancas.noLaboratorio === undefined) {
      patch.noLaboratorio = noLabDoStatus(patch.status);
    }
    patch.atualizadoEm = agora();

    var eqAtualizado = Object.assign({}, eq, patch);

    return colEquip().doc(id).update(patch).then(function () {
      if (statusAnterior !== eqAtualizado.status) {
        registrarAuditoria('AJUSTE_STATUS', 'equipamentos', id,
          'Status do equipamento ' + (eqAtualizado.tomboNovo || eqAtualizado.tomboAntigo || id) +
          ' (' + eqAtualizado.equipamento + ') mudou de "' + statusAnterior +
          '" para "' + eqAtualizado.status + '".');
      }
      return registrarMovimentacao({
        tipo: 'AJUSTE', data: hoje(), equipamentoId: eqAtualizado.id,
        equipamento: eqAtualizado.equipamento, modelo: eqAtualizado.modelo,
        tomboNovo: eqAtualizado.tomboNovo, tomboAntigo: eqAtualizado.tomboAntigo,
        chamado: eqAtualizado.chamado, servicoSolicitado: eqAtualizado.servicoSolicitado,
        statusAnterior: statusAnterior, statusResultante: eqAtualizado.status,
        predio: eqAtualizado.predioOrigem, setor: eqAtualizado.setorOrigem,
        ttr: eqAtualizado.ttr, tecnico: eqAtualizado.tecnico, usuario: opcoes.usuario,
        observacao: statusAnterior !== eqAtualizado.status
          ? 'Status alterado de "' + statusAnterior + '" para "' + eqAtualizado.status + '".'
          : 'Dados do equipamento atualizados.'
      });
    }).then(function () {
      return { ok: true, equipamento: eqAtualizado };
    }).catch(function (erro) {
      return { ok: false, erro: 'Falha ao gravar no Firestore: ' + erro.message };
    });
  }

  function excluirEquipamento(id, opcoes) {
    opcoes = opcoes || {};
    // Reforço de RBAC no próprio store: o botão de excluir já some da tela
    // para o perfil Técnico, mas sem esta checagem aqui a exclusão ainda
    // seria alcançável direto pelo console do navegador. As regras do
    // Firestore também bloqueiam (defesa em profundidade, não só aqui).
    if (SAGETI.auth && !SAGETI.auth.permissao('podeExcluir')) {
      return Promise.resolve({ ok: false, erro: 'Seu perfil não tem permissão para excluir equipamentos.' });
    }
    var eq = acharPorId(id);
    if (!eq) return Promise.resolve({ ok: false, erro: 'Equipamento não encontrado.' });

    return colEquip().doc(id).delete().then(function () {
      registrarAuditoria('EXCLUSAO_EQUIPAMENTO', 'equipamentos', id,
        'Equipamento ' + (eq.tomboNovo || eq.tomboAntigo || id) + ' (' + eq.equipamento +
        ' — ' + eq.modelo + ') excluído do estoque.');
      return registrarMovimentacao({
        tipo: 'EXCLUSAO', data: hoje(), equipamentoId: eq.id,
        equipamento: eq.equipamento, modelo: eq.modelo,
        tomboNovo: eq.tomboNovo, tomboAntigo: eq.tomboAntigo,
        chamado: eq.chamado, statusAnterior: eq.status, statusResultante: '—',
        predio: eq.predioOrigem, setor: eq.setorOrigem, ttr: eq.ttr, tecnico: eq.tecnico,
        observacao: 'Equipamento removido do estoque do laboratório.'
      });
    }).then(function () {
      return { ok: true, equipamento: eq };
    }).catch(function (erro) {
      return { ok: false, erro: 'Falha ao excluir no Firestore: ' + erro.message };
    });
  }

  /* ---------- Chamadas para as Cloud Functions -------------------------------
     Duas operações que o SDK do cliente não pode fazer com segurança
     sozinho (excluir conta de Auth de verdade; inserir um lote atômico
     com teto de negócio) — exigem o plano Blaze, então ficam condicionadas
     a SAGETI.APP.cloudFunctionsHabilitadas no chamador. Toda validação
     real está na função — a checagem de `permissao()` aqui é só UX,
     igual ao padrão já usado em `excluirEquipamento`.
     -------------------------------------------------------------------- */

  function listarUsuarios() {
    // Rules: só admin consegue listar a coleção inteira (ver firestore.rules);
    // um técnico forçando isto pelo console recebe permission-denied.
    return colUsuarios().get().then(function (snap) {
      return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    });
  }

  function excluirUsuario(uid) {
    if (!SAGETI.auth.permissao('podeExcluir')) {
      return Promise.resolve({ ok: false, erro: 'Seu perfil não tem permissão para excluir usuários.' });
    }
    var fn = SAGETI.fb.functions.httpsCallable('excluirUsuario');
    return fn({ uid: uid })
      .then(function () { return { ok: true }; })
      .catch(function (erro) {
        // 'permission-denied' aqui é decidido no servidor, não pelo botão escondido.
        return { ok: false, erro: erro.message || 'Falha ao excluir usuário.' };
      });
  }

  function adicionarPerifericosEmLote(dados) {
    if (!SAGETI.auth.permissao('podeEditar')) {
      return Promise.resolve({ ok: false, erro: 'Seu perfil não pode cadastrar equipamentos.' });
    }
    var fn = SAGETI.fb.functions.httpsCallable('adicionarPerifericosEmLote');
    return fn(dados)
      .then(function (res) { return { ok: true, criados: res.data.criados }; })
      .catch(function (erro) {
        return { ok: false, erro: erro.message || 'Falha ao adicionar em lote.' };
      });
  }

  /** Alternativa 100% cliente a `adicionarPerifericosEmLote`: usada quando as
      Cloud Functions não estão habilitadas (plano Spark) — mesmo padrão da
      seção "Gestão de usuários" logo abaixo. Sem tombo, `criarEquipamento`
      nunca encontra duplicata (ver `chaveTombo`), então basta repetir a
      chamada em sequência, uma vez por unidade — cada item ganha seu próprio
      registro de CADASTRO no histórico, igual ao cadastro individual. */
  function adicionarPerifericosEmLoteCliente(dados) {
    if (!SAGETI.auth.permissao('podeEditar')) {
      return Promise.resolve({ ok: false, erro: 'Seu perfil não pode cadastrar equipamentos.' });
    }
    var quantidade = Math.max(1, Math.min(500, parseInt(dados.quantidade, 10) || 0));
    if (!quantidade) return Promise.resolve({ ok: false, erro: 'Informe uma quantidade válida.' });

    var base = Object.assign({}, dados);
    delete base.quantidade;

    var restantes = quantidade;
    var criados = 0;
    var erro = null;
    function proximo() {
      if (restantes <= 0) return Promise.resolve();
      restantes--;
      return criarEquipamento(base).then(function (r) {
        if (!r.ok) { erro = r.erro; return; }
        criados++;
        return proximo();
      });
    }
    return proximo().then(function () {
      if (!criados) return { ok: false, erro: erro || 'Nenhum item foi criado.' };
      return { ok: true, criados: criados, erro: criados < quantidade ? erro : null };
    });
  }

  /* ---------- Gestão de usuários (100% cliente — funciona no plano gratuito) -
     `criarUsuario` e a exclusão real de conta (`excluirUsuario`, acima)
     parecem simétricas mas não são: criar uma conta de Auth É permitido a
     qualquer cliente (é o autocadastro padrão do Firebase Auth), então dá
     pra fazer sem Admin SDK — só precisa de uma instância AUXILIAR do
     Firebase App pra a chamada não trocar a sessão de quem está logado
     (criar usuário autentica automaticamente como o usuário novo). Já
     apagar a conta de OUTRA pessoa exige Admin SDK de verdade — sem Blaze,
     o máximo é apagar o documento de perfil (`revogarAcessoUsuario`), que
     derruba a permissão na hora mas não a conta de login em si.
     -------------------------------------------------------------------- */

  function mensagemErroCriacao(e) {
    var codigo = e && e.code;
    if (codigo === 'auth/email-already-in-use') return 'Já existe um usuário com esse nome.';
    if (codigo === 'auth/weak-password') return 'Senha fraca demais — use ao menos 6 caracteres.';
    if (codigo === 'auth/invalid-email') return 'Nome de usuário inválido.';
    return 'Não foi possível criar o usuário: ' + ((e && e.message) || 'erro desconhecido.');
  }

  function criarUsuario(dados) {
    if (!SAGETI.auth.permissao('podeExcluir')) {
      return Promise.resolve({ ok: false, erro: 'Seu perfil não tem permissão para criar usuários.' });
    }
    var usuario = norm(dados.usuario).toLowerCase();
    var nome = norm(dados.nome) || usuario;
    var senha = String(dados.senha || '');
    var perfil = SAGETI.PERFIS[dados.perfil] ? dados.perfil : 'leitura';
    if (!usuario) return Promise.resolve({ ok: false, erro: 'Informe o nome de usuário.' });

    // App auxiliar: cria a conta sem derrubar a sessão do admin no app
    // principal. A escrita do doc usa `colUsuarios()` do app PRINCIPAL —
    // é a sessão do admin (não a do usuário recém-criado) que as Rules
    // exigem pra permitir `create` em /usuarios.
    var appAux = firebase.initializeApp(SAGETI.fb.config, 'sage-ti-criar-' + Date.now());
    var authAux = appAux.auth();
    // O app auxiliar não herda o useEmulator() do app principal (cada
    // instância liga no emulador por conta própria) — sem isto, em modo de
    // teste a conta seria criada na produção de verdade, não no emulador.
    if (window.SAGETI_USE_EMULATOR) authAux.useEmulator('http://localhost:9099', { disableWarnings: true });

    return authAux.createUserWithEmailAndPassword(emailDoUsuario(usuario), senha)
      .then(function (cred) {
        var uid = cred.user.uid;
        return colUsuarios().doc(uid).set({ usuario: usuario, nome: nome, perfil: perfil })
          .then(function () {
            registrarAuditoria('CRIACAO_USUARIO', 'usuarios', uid,
              'Usuário "' + usuario + '" criado com perfil "' + perfil + '".');
            return { ok: true, uid: uid };
          });
      })
      .catch(function (e) {
        return { ok: false, erro: mensagemErroCriacao(e) };
      })
      .then(function (resultado) {
        // Sempre descarta a instância auxiliar, mesmo se algo falhou no meio.
        return appAux.auth().signOut().catch(function () {}).then(function () {
          return appAux.delete().catch(function () {});
        }).then(function () { return resultado; });
      });
  }

  function atualizarPerfilUsuario(uid, perfil) {
    if (!SAGETI.auth.permissao('podeExcluir')) {
      return Promise.resolve({ ok: false, erro: 'Seu perfil não tem permissão para alterar perfis.' });
    }
    var meuUid = (SAGETI.auth.usuarioAtual() || {}).uid;
    if (uid === meuUid) {
      return Promise.resolve({ ok: false, erro: 'Você não pode alterar o próprio perfil.' });
    }
    if (!SAGETI.PERFIS[perfil]) {
      return Promise.resolve({ ok: false, erro: 'Perfil inválido.' });
    }
    return colUsuarios().doc(uid).update({ perfil: perfil })
      .then(function () {
        registrarAuditoria('ALTERACAO_PERFIL', 'usuarios', uid, 'Perfil alterado para "' + perfil + '".');
        return { ok: true };
      })
      .catch(function (erro) {
        return { ok: false, erro: erro.message || 'Falha ao alterar o perfil.' };
      });
  }

  function revogarAcessoUsuario(uid) {
    if (!SAGETI.auth.permissao('podeExcluir')) {
      return Promise.resolve({ ok: false, erro: 'Seu perfil não tem permissão para revogar acesso.' });
    }
    var meuUid = (SAGETI.auth.usuarioAtual() || {}).uid;
    if (uid === meuUid) {
      return Promise.resolve({ ok: false, erro: 'Você não pode revogar o próprio acesso.' });
    }
    return colUsuarios().doc(uid).delete()
      .then(function () {
        registrarAuditoria('REVOGACAO_ACESSO', 'usuarios', uid,
          'Acesso revogado — perfil removido (a conta de login continua existindo).');
        return { ok: true };
      })
      .catch(function (erro) {
        return { ok: false, erro: erro.message || 'Falha ao revogar acesso.' };
      });
  }

  function mensagemErroSenha(e) {
    var codigo = e && e.code;
    if (codigo === 'auth/wrong-password' || codigo === 'auth/invalid-credential' ||
        codigo === 'auth/invalid-login-credentials') return 'Senha atual incorreta.';
    if (codigo === 'auth/weak-password') return 'Senha nova fraca demais — use ao menos 6 caracteres.';
    if (codigo === 'auth/requires-recent-login') return 'Sessão antiga — saia e entre de novo antes de trocar a senha.';
    return 'Não foi possível trocar a senha: ' + ((e && e.message) || 'erro desconhecido.');
  }

  /** Qualquer usuário autenticado troca a própria senha — sem guard de perfil. */
  function alterarMinhaSenha(senhaAtual, novaSenha) {
    var user = SAGETI.fb.auth.currentUser;
    if (!user) return Promise.resolve({ ok: false, erro: 'Sessão não encontrada — faça login novamente.' });

    var cred = firebase.auth.EmailAuthProvider.credential(user.email, senhaAtual);
    return user.reauthenticateWithCredential(cred)
      .then(function () { return user.updatePassword(novaSenha); })
      .then(function () {
        registrarAuditoria('ALTERACAO_SENHA', 'usuarios', user.uid, 'Senha alterada pelo próprio usuário.');
        return { ok: true };
      })
      .catch(function (e) {
        return { ok: false, erro: mensagemErroSenha(e) };
      });
  }

  /* ---------- Entrada ------------------------------------------------------ */

  function registrarEntrada(dados, opcoes) {
    opcoes = opcoes || {};
    var existente = acharPorTombo(dados);
    var criado = !existente;
    var statusAnterior = existente ? existente.status : '';

    var eq = existente ? Object.assign({}, existente) : novoEquipamento(dados);
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
    // Entrada = o equipamento está no laboratório. Independe do rótulo.
    eq.noLaboratorio = true;

    var gravarEq = criado
      ? colEquip().add(eq).then(function (ref) { eq.id = ref.id; })
      : colEquip().doc(eq.id).set(eq);

    return gravarEq.then(function () {
      return registrarMovimentacao({
        tipo: 'ENTRADA', data: eq.dataEntrada, equipamentoId: eq.id,
        equipamento: eq.equipamento, modelo: eq.modelo,
        tomboNovo: eq.tomboNovo, tomboAntigo: eq.tomboAntigo,
        chamado: eq.chamado, servicoSolicitado: eq.servicoSolicitado,
        statusAnterior: criado ? '' : statusAnterior, statusResultante: eq.status,
        predio: eq.predioOrigem, setor: eq.setorOrigem,
        ttr: eq.ttr, tecnico: eq.tecnico, usuario: opcoes.usuario,
        observacao: criado
          ? 'Entrada de equipamento novo no laboratório.'
          : 'Reentrada — registro de estoque atualizado.'
      });
    }).then(function (mov) {
      return { ok: true, equipamento: eq, criado: criado, movimentacao: mov };
    }).catch(function (erro) {
      return { ok: false, erro: 'Falha ao gravar no Firestore: ' + erro.message };
    });
  }

  /* ---------- Saída -------------------------------------------------------- */

  function registrarSaida(dados, opcoes) {
    opcoes = opcoes || {};
    var atual = acharPorTombo(dados);

    if (!atual) {
      return Promise.resolve({
        ok: false,
        erro: 'Nenhum equipamento com esse tombo está cadastrado no laboratório. ' +
              'Registre a entrada antes da saída.'
      });
    }
    if (!atual.noLaboratorio) {
      return Promise.resolve({
        ok: false,
        erro: 'Este equipamento já saiu do laboratório em ' +
          (atual.dataSaida ? SAGETI.util.dataBR(atual.dataSaida) : 'data anterior') +
          ' para ' + (atual.predioDestino || 'destino não informado') +
          ' (status "' + atual.status + '").'
      });
    }

    var eq = Object.assign({}, atual);
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

    return colEquip().doc(eq.id).set(eq).then(function () {
      return registrarMovimentacao({
        tipo: 'SAIDA', data: eq.dataSaida, equipamentoId: eq.id,
        equipamento: eq.equipamento, modelo: eq.modelo,
        tomboNovo: eq.tomboNovo, tomboAntigo: eq.tomboAntigo,
        chamado: eq.chamado, servicoSolicitado: eq.servicoSolicitado,
        statusAnterior: statusAnterior, statusResultante: eq.status,
        predio: eq.predioDestino, setor: eq.setorDestino,
        ttr: eq.ttr, tecnico: eq.tecnico, usuario: opcoes.usuario,
        observacao: 'Saída do laboratório para ' + (eq.predioDestino || 'destino não informado') + '.'
      });
    }).then(function (mov) {
      return { ok: true, equipamento: eq, movimentacao: mov };
    }).catch(function (erro) {
      return { ok: false, erro: 'Falha ao gravar no Firestore: ' + erro.message };
    });
  }

  /* ---------- Importação em massa ------------------------------------------
     Recebe linhas já normalizadas (ver js/importar.js) e cria os registros.
     Devolve uma Promise com o relatório completo (motivo de cada linha
     recusada incluso). No modo `simular` nada é gravado — só lê o espelho
     local, então esse caminho continua efetivamente síncrono (embrulhado
     numa Promise só para a API ter um único formato de retorno).
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

    /** Processa uma linha; devolve uma Promise (resolve mesmo quando recusada). */
    function processarLinha(linha) {
      var registro = { linha: linha._linha, tombo: linha.tomboNovo || linha.tomboAntigo };

      // 1. linha em branco
      var temConteudo = ['equipamento', 'modelo', 'tomboNovo', 'tomboAntigo', 'chamado']
        .some(function (c) { return norm(linha[c]); });
      if (!temConteudo) {
        registro.resultado = 'ignorado';
        registro.motivo = 'Linha em branco.';
        rel.ignorados++; rel.itens.push(registro);
        return Promise.resolve();
      }

      // 2. sem tombo não há identidade
      var c = chaveTombo(linha);
      if (!c) {
        registro.resultado = 'recusado';
        registro.motivo = 'Sem tombo novo nem tombo antigo.';
        rel.recusados++; rel.itens.push(registro);
        return Promise.resolve();
      }

      // 3. duplicado dentro do arquivo
      if (vistosNoArquivo[c]) {
        registro.resultado = 'recusado';
        registro.motivo = 'Tombo repetido na linha ' + vistosNoArquivo[c] + ' do arquivo.';
        rel.recusados++; rel.itens.push(registro);
        return Promise.resolve();
      }
      vistosNoArquivo[c] = linha._linha;

      // 4. já existe no sistema
      var existe = simular ? !!snapshot[c] : !!acharPorTombo(linha);
      if (existe && !atualizarExistentes) {
        registro.resultado = 'ignorado';
        registro.motivo = 'Tombo já cadastrado no sistema.';
        rel.ignorados++; rel.itens.push(registro);
        return Promise.resolve();
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
        return Promise.resolve();
      }

      // 6. grava
      if (existe) {
        var atual = acharPorTombo(linha);
        var mudancas = {};
        Object.keys(payload).forEach(function (k) {
          if (payload[k] !== '' && payload[k] != null) mudancas[k] = payload[k];
        });
        return atualizarEquipamento(atual.id, mudancas, { silencioso: true }).then(function (ra) {
          if (!ra.ok) {
            registro.resultado = 'recusado'; registro.motivo = ra.erro;
            rel.recusados++; rel.itens.push(registro);
            return;
          }
          registro.resultado = 'atualizado';
          rel.atualizados++;
          rel.itens.push(registro);
        });
      }

      return criarEquipamento(payload, { silencioso: true }).then(function (rc) {
        if (!rc.ok) {
          registro.resultado = 'recusado'; registro.motivo = rc.erro;
          rel.recusados++; rel.itens.push(registro);
          return;
        }
        // Se a planilha traz data de saída, o item nasce já expedido.
        if (payload.dataSaida) {
          var patch = {
            noLaboratorio: noLabDoStatus(payload.status),
            dataSaida: payload.dataSaida,
            predioDestino: payload.predioDestino,
            setorDestino: payload.setorDestino
          };
          return colEquip().doc(rc.equipamento.id).update(patch).then(function () {
            registro.resultado = 'criado';
            rel.criados++;
            rel.itens.push(registro);
          });
        }
        registro.resultado = 'criado';
        rel.criados++;
        rel.itens.push(registro);
      });
    }

    // Processa em sequência (não em paralelo): evita sobrecarregar o
    // Firestore num import grande e mantém a detecção de duplicado
    // consistente linha a linha, igual ao comportamento anterior.
    var cadeia = linhas.reduce(function (promessa, linha) {
      return promessa.then(function () { return processarLinha(linha); });
    }, Promise.resolve());

    return cadeia.then(function () {
      if (simular) return rel;

      rel.opcoesCriadas = rel.opcoesCriadas.filter(function (v, i, a) { return a.indexOf(v) === i; });
      if (rel.opcoesCriadas.length) SAGETI.listas.confirmarGarantias();

      return registrarMovimentacao({
        tipo: 'IMPORTACAO', data: hoje(),
        equipamento: '—', modelo: '—',
        statusResultante: '—',
        observacao: 'Importação de planilha: ' + rel.criados + ' criado(s), ' +
          rel.atualizados + ' atualizado(s), ' + rel.ignorados + ' ignorado(s), ' +
          rel.recusados + ' recusado(s).'
      }).then(function () { return rel; });
    });
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

  /** Lê a auditoria sob demanda (não é espelhada em tempo real — tela de baixo tráfego). */
  function listarAuditoria(limite) {
    return colAuditoria().orderBy('registradoEm', 'desc').limit(limite || 200).get()
      .then(function (snap) {
        return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      });
  }

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

  /** Normaliza registros de um backup mais antigo (campos que não existiam). */
  function normalizarRegistro(e) {
    if (typeof e.noLaboratorio !== 'boolean') {
      e.noLaboratorio = e.status !== 'Disponibilizado';
    }
    if (e.tecnico === undefined) e.tecnico = '';
    if (e.motivo === undefined) e.motivo = '';
    return e;
  }

  /** Apaga todos os documentos de uma coleção (a base é pequena — um lote basta). */
  function excluirColecao(ref) {
    return ref.get().then(function (snap) {
      if (snap.empty) return;
      var lote = SAGETI.fb.db.batch();
      snap.docs.forEach(function (d) { lote.delete(d.ref); });
      return lote.commit();
    });
  }

  /** Restaura um backup (JSON de exportarJSON): substitui tudo no Firestore. */
  function importarJSON(texto) {
    var dados;
    try { dados = JSON.parse(texto); } catch (e) { return Promise.resolve({ ok: false, erro: 'Arquivo JSON inválido.' }); }
    if (!dados || !Array.isArray(dados.equipamentos)) {
      return Promise.resolve({ ok: false, erro: 'O arquivo não contém uma lista de equipamentos.' });
    }
    // Restaura as listas antes dos registros, para os status resolverem.
    if (dados.listas) SAGETI.listas.importarJSON(JSON.stringify({ listas: dados.listas }));

    var equipamentos = dados.equipamentos.map(normalizarRegistro);
    var movimentacoes = Array.isArray(dados.movimentacoes) ? dados.movimentacoes : [];

    return excluirColecao(colEquip()).then(function () {
      return excluirColecao(colMov());
    }).then(function () {
      var lote = SAGETI.fb.db.batch();
      equipamentos.forEach(function (e) {
        var id = e.id || uid();
        var copia = Object.assign({}, e); delete copia.id;
        lote.set(colEquip().doc(id), copia);
      });
      movimentacoes.forEach(function (m) {
        var id = m.id || uid();
        var copia = Object.assign({}, m); delete copia.id;
        lote.set(colMov().doc(id), copia);
      });
      return lote.commit();
    }).then(function () {
      return { ok: true, total: equipamentos.length };
    }).catch(function (erro) {
      return { ok: false, erro: 'Falha ao restaurar no Firestore: ' + erro.message };
    });
  }

  function limparTudo() {
    return excluirColecao(colEquip()).then(function () {
      return excluirColecao(colMov());
    });
  }

  function inicializar() {
    // As listas continuam no navegador — precisam existir antes de qualquer
    // regra que consulte status, independente do Firestore já ter respondido.
    SAGETI.listas.inicializar();
    SAGETI.auth._iniciar();
    // Liga/desliga os listeners de dados junto com o estado de login: as
    // regras do Firestore exigem autenticação para ler equipamentos/movimentações.
    SAGETI.auth.aoMudar(function (usuario) {
      if (usuario) ligarListenersDados();
      else desligarListenersDados();
    });
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

    registrarAuditoria: registrarAuditoria,
    listarAuditoria: listarAuditoria,

    listarUsuarios: listarUsuarios,
    excluirUsuario: excluirUsuario,
    adicionarPerifericosEmLote: adicionarPerifericosEmLote,
    adicionarPerifericosEmLoteCliente: adicionarPerifericosEmLoteCliente,
    criarUsuario: criarUsuario,
    atualizarPerfilUsuario: atualizarPerfilUsuario,
    revogarAcessoUsuario: revogarAcessoUsuario,
    alterarMinhaSenha: alterarMinhaSenha,

    exportarJSON: exportarJSON,
    importarJSON: importarJSON,
    limparTudo: limparTudo,

    _setCampoEquipamento: _setCampoEquipamento,
    _setCampoMovimentacao: _setCampoMovimentacao,
    _uid: uid,
    _agora: agora,
    _hoje: hoje
  };

  /* ---------- Autenticação (Firebase Authentication) ------------------------ */

  var sessao = null;           // { uid, usuario, nome, perfil, entrouEm } — cache síncrono
  var ouvintesAuth = [];
  var authIniciado = false;

  /** "admin" -> "admin@sagi-ti.local" — só uma convenção para caber no Auth por e-mail/senha. */
  function emailDoUsuario(usuario) {
    return norm(usuario).toLowerCase() + '@' + SAGETI.APP.authDominio;
  }

  function usuarioDoEmail(email) {
    return String(email || '').split('@')[0];
  }

  /** Busca o perfil (nome/perfil) do usuário autenticado e monta a sessão. */
  function carregarPerfil(user) {
    return colUsuarios().doc(user.uid).get().then(function (doc) {
      var d = doc.exists ? doc.data() : {};
      sessao = {
        uid: user.uid,
        usuario: d.usuario || usuarioDoEmail(user.email),
        nome: d.nome || usuarioDoEmail(user.email),
        perfil: d.perfil || 'leitura',
        entrouEm: agora()
      };
      return sessao;
    });
  }

  function notificarAuth() {
    ouvintesAuth.forEach(function (fn) {
      try { fn(sessao); } catch (e) { console.error('[SAGE-TI] Erro em ouvinte de autenticação:', e); }
    });
  }

  function mensagemErroAuth(e) {
    var codigo = e && e.code;
    if (codigo === 'auth/wrong-password' || codigo === 'auth/user-not-found' ||
        codigo === 'auth/invalid-credential' || codigo === 'auth/invalid-login-credentials') {
      return 'Usuário ou senha inválidos.';
    }
    if (codigo === 'auth/too-many-requests') return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
    if (codigo === 'auth/network-request-failed') return 'Sem conexão com o servidor. Verifique sua internet.';
    return 'Não foi possível entrar: ' + ((e && e.message) || 'erro desconhecido.');
  }

  SAGETI.auth = {
    /** Liga o listener de estado de autenticação — chamado uma vez, no boot. */
    _iniciar: function () {
      if (authIniciado) return;
      authIniciado = true;
      SAGETI.fb.auth.onAuthStateChanged(function (user) {
        if (!user) { sessao = null; notificarAuth(); return; }
        carregarPerfil(user).then(notificarAuth).catch(function (e) {
          console.error('[SAGE-TI] Falha ao carregar perfil do usuário:', e);
          sessao = null;
          notificarAuth();
        });
      });
    },

    /** Chama `fn(usuarioOuNull)` a cada mudança de login — inclusive a inicial. */
    aoMudar: function (fn) {
      ouvintesAuth.push(fn);
      return function () {
        var i = ouvintesAuth.indexOf(fn);
        if (i > -1) ouvintesAuth.splice(i, 1);
      };
    },

    entrar: function (usuario, senha, lembrar) {
      var persistencia = lembrar
        ? firebase.auth.Auth.Persistence.LOCAL
        : firebase.auth.Auth.Persistence.SESSION;
      return SAGETI.fb.auth.setPersistence(persistencia).then(function () {
        return SAGETI.fb.auth.signInWithEmailAndPassword(emailDoUsuario(usuario), senha);
      }).then(function (cred) {
        return carregarPerfil(cred.user);
      }).then(function (s) {
        return { ok: true, usuario: s };
      }).catch(function (e) {
        return { ok: false, erro: mensagemErroAuth(e) };
      });
    },

    sair: function () {
      return SAGETI.fb.auth.signOut();
    },

    usuarioAtual: function () { return sessao; },
    autenticado: function () { return !!sessao; },
    permissao: function (chave) {
      if (!sessao) return false;
      var p = SAGETI.PERFIS[sessao.perfil] || SAGETI.PERFIS.leitura;
      return !!p[chave];
    }
  };

})(window.SAGETI);
