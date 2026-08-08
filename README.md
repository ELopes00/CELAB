# SAGE-TI — Sistema de Ativos e Gestão de Estoque de Tecnologia da Informação

Sistema web de controle de estoque para laboratório de manutenção de equipamentos de TI.
Registra entradas, saídas e alterações; mantém o inventário e a dashboard sincronizados
em tempo real, **entre todos os operadores** (Firebase/Firestore); exporta inventário e
relatórios em **XLSX** e **PDF**.

**Publicado em:** https://sagi-ti.web.app

---

## 1. Como usar

### Acessar

Abra https://sagi-ti.web.app — exige internet (fala com o Firebase; não funciona aberto
direto do disco nem totalmente offline). Para rodar localmente durante o desenvolvimento,
sirva a pasta por HTTP (`python servidor.py`, depois `http://localhost:8080`) — o
`index.html` aponta pro mesmo projeto Firebase de produção.

Credenciais:

| Usuário   | Senha        | Perfil                                |
|-----------|--------------|---------------------------------------|
| `admin`   | `root123`    | Administrador — edita e exclui        |
| `tecnico` | `tecnico123` | Técnico — edita, não exclui           |

Por baixo dos panos são contas do Firebase Authentication (`admin@sagi-ti.local` /
`tecnico@sagi-ti.local`) — a tela de login só pede o usuário e monta o e-mail sozinha.

> O sistema nasce com 18 equipamentos de exemplo para a dashboard não abrir vazia.
> Em **Dados e backup → Apagar todos os dados** você zera tudo — pro sistema inteiro,
> já que os dados agora são compartilhados — e começa do inventário real.

### Dados compartilhados, não por navegador

Diferente da versão anterior (que guardava tudo em `localStorage`), equipamentos e
movimentações agora vivem no **Firestore**: qualquer pessoa autenticada, em qualquer
computador, vê e edita o mesmo estoque, em tempo real (`onSnapshot`, sem precisar
recarregar a página). As regras de acesso ficam em [firestore.rules](firestore.rules).
As **listas editáveis** (status, setores, técnicos, modelos, TTR) continuam no
`localStorage` de cada navegador — ver Limitações conhecidas.

---

## 2. Telas

| Tela | O que faz |
|---|---|
| **Login** | Autenticação, com espaço reservado para a logo do sistema |
| **Dashboard** | Hero + 4 indicadores, 4 gráficos **interativos com drill-down**, filtro por modelo, atalhos e Exportar Geral |
| **Estoque Laboratório** | Tabela do inventário, cadastro direto, edição, exclusão, 9 filtros e ordenação |
| **Entrada de Equipamentos** | Formulário de chegada + últimas 20 entradas |
| **Saída de Equipamentos** | Formulário de envio com busca por tombo, técnico responsável + últimas 20 saídas |
| **Relatórios e Filtros** | Histórico completo com 13 filtros e exportação da fatia filtrada |
| **Configurações** | Gerenciador de todas as listas de seleção, importação de planilha e backup |

Atalhos: `Alt+1` … `Alt+6` alternam entre as abas. O botão 🌙/☀️ troca claro/escuro.

---

## 3. Regras de negócio

A **identidade de um equipamento é o tombo** — tombo novo, ou tombo antigo quando o novo
está vazio. É essa chave que costura entrada, estoque e saída.

**Entrada** (`store.registrarEntrada`)
- Tombo inédito → cria o equipamento no estoque.
- Tombo já cadastrado → **atualiza** o registro existente, não duplica. O formulário avisa
  antes de salvar.
- Reentrada de um item que havia saído → volta ao estoque e limpa os dados de destino.

**Saída** (`store.registrarSaida`)
- Exige um tombo existente. Saída de item não cadastrado é recusada com mensagem clara.
- O status vira **Disponibilizado** com prédio e setor de destino preenchidos.
- O registro **não é apagado** — sai do estoque físico, mas continua no inventário e no
  histórico. Rastreabilidade patrimonial exige saber onde cada tombo está.
- Saída repetida do mesmo item é recusada, informando data e destino da saída anterior.

**Presença física é da operação, não do rótulo do status**

Cada equipamento carrega o campo `noLaboratorio` (sim/não). Quem o define é a operação:

- registrar **entrada** → está no laboratório, sempre;
- registrar **saída** → saiu, sempre;
- **editar pelo Estoque** → aí sim vale o padrão do status escolhido.

Isso foi necessário porque rótulos como **"Substituição"** e **"Manutenção"** existem nos
dois formulários com sentidos opostos: na entrada o equipamento chega, na saída o mesmo
rótulo significa que ele foi embora. Como as listas são editáveis, deduzir presença a
partir do texto seria frágil — o campo resolve, e a Dashboard nunca interpreta rótulos.

**Cores por tom, não por rótulo**

Cada status tem um *tom* semântico, e é por ele que a Dashboard mede a saúde do estoque:

| Tom | Cor | Indicador |
|---|---|---|
| `good` | verde | Disponíveis em estoque |
| `info` | azul | Em triagem |
| `warning` | âmbar | Em manutenção |
| `serious` | laranja | Para leilão |
| `critical` | vermelho | Com defeito |
| `neutral` | cinza | Sem situação definida |

Assim um status criado por você já nasce com a cor certa no chip, entra no indicador
correspondente e aparece no donut — sem tocar em código. A soma dos seis tons sempre
fecha com o total no laboratório (há um teste automatizado travando essa igualdade).

**Histórico** — toda operação grava uma movimentação: `ENTRADA`, `SAIDA`, `CADASTRO`,
`AJUSTE` (com status anterior e novo), `EXCLUSAO` e `IMPORTACAO`. Nada se altera sem
deixar rastro.

---

## 3.0. Drill-down da Dashboard

Um único objeto `filtro` (`{ modelo, equipamento, tom, predio }`) governa a tela inteira.
Qualquer mudança recalcula os KPIs, os quatro gráficos e as tabelas-gêmeas a partir do
**mesmo recorte**.

Como filtrar:

- **Select "Filtrar por modelo"** no topo (mais Equipamento e Situação);
- **clique numa fatia do donut** → filtra por situação;
- **clique numa barra** de tipo ou de prédio → filtra por aquela categoria;
- clicar de novo no mesmo item, no chip `×`, em **Limpar tudo** ou na tecla **Esc** remove
  o filtro.

Duas decisões que fazem o cross-filtering se comportar bem:

- **Nenhum gráfico filtra a si mesmo.** Ao filtrar "Defeito", o donut continua mostrando
  todas as situações (senão viraria uma fatia só) enquanto as barras de tipo passam a
  contar apenas os itens com defeito. É o que `recorte('tom')` faz.
- **A seleção recua o resto.** A marca escolhida mantém a cor cheia; as demais vão a 22%
  de opacidade. O filtro fica visível no próprio gráfico, sem depender só dos chips.

O gráfico de tipos lista **todas as 14 categorias**, inclusive as zeradas: no drill-down,
"Tela de projeção: 0" é informação, não ruído.

Nenhum dropdown é fixo no código. Tudo o que aparece em um campo de seleção — Status,
TTR de entrada, TTR de saída, Equipamentos, Modelos, Prédios, Setores/Unidades e Técnicos
— vive em `js/listas.js`, é gravado no navegador e pode ser alterado pela interface.

Dois caminhos, o mesmo editor:

- **⚙ ao lado do campo** — gerencia a lista sem sair do formulário que está sendo
  preenchido. Ao fechar, o campo já está repintado com a novidade.
- **Configurações → Listas de seleção** — visão completa, com a contagem de opções e de
  usos de cada uma.

O que o editor garante:

| Situação | Comportamento |
|---|---|
| Nome repetido (mesmo com acento/caixa diferente) | bloqueado — "BRENO SIMAO" não entra se já existe "Breno Simão" |
| Renomear uma opção em uso | os registros que a usavam são **reescritos** para o novo nome, e o número de registros afetados é informado |
| Excluir uma opção em uso | bloqueado, com a contagem; o diálogo oferece *renomear* (seguro) ou *excluir mesmo assim* (o texto fica nos registros antigos) |
| Criar um status | pede o tom (cor), em quais formulários aparece e se o item permanece no laboratório |
| Atualização do sistema | novas opções de fábrica são incorporadas **sem apagar** as que você criou |
| Restaurar padrão | por lista ou global; os registros gravados não são alterados |

As listas entram no backup JSON e podem ser exportadas/importadas separadamente — útil
para replicar a configuração em outra máquina.

---

## 3.2. Importação de planilha

**Configurações → Importar planilha** (ou o botão na sidebar, na aba Entrada e na aba
Estoque). Aceita `.xlsx`, `.xls` e `.csv`, em três passos — **nada é gravado antes da
confirmação**:

1. **Arquivo** — arraste ou escolha. Escolha da aba e da linha do cabeçalho.
2. **Colunas** — o sistema reconhece os cabeçalhos por sinônimo (`PATRIMÔNIO`,
   `Marca/Modelo`, `Situação`, `Setor/Unidade`, `Técnico Responsável`… todos caem no campo
   certo, ignorando acento e caixa) e você ajusta o que estiver errado.
3. **Conferir** — simulação completa: quantos serão criados, quantos atualizados, quantos
   ignorados e quantos recusados, **com o motivo linha a linha**.

Validações aplicadas:

- **linha em branco** → ignorada;
- **sem tombo novo nem antigo** → recusada (o tombo é a identidade do equipamento);
- **tombo repetido dentro do arquivo** → recusada, apontando a linha do primeiro;
- **tombo já cadastrado** → ignorado por padrão; marque *Atualizar equipamentos cujo tombo
  já existe* para sobrescrever;
- **datas** em `31/07/2026`, `2026-07-31`, `31-07-26` ou serial do Excel → todas convertidas;
- **tombos com zero à esquerda** → `045112` continua `045112`, não vira `45112`.

Há também a opção de **cadastrar automaticamente valores novos nas listas**: um setor ou
modelo que apareça na planilha e ainda não exista é criado durante a importação, e o
sistema informa quantas opções entraram para você revisar depois.

Use **Baixar modelo** para obter a planilha com as 15 colunas esperadas e uma linha de
exemplo.

---

## 4. Arquitetura

```
CELAB/
├── index.html              ponto de entrada
├── servidor.py             servidor HTTP para a intranet (0.0.0.0:8080)
├── css/styles.css          design system completo (tokens, claro/escuro, responsivo)
├── js/
│   ├── config.js           PADRÃO DE FÁBRICA das listas: 14 equipamentos, 45 modelos,
│   │                       32 prédios, 175 setores, 15 técnicos, 17 status, TTR, perfis
│   ├── ui.js               utilitários, 39 ícones SVG, toast, modal, campos, validação
│   ├── listas.js           ★ listas editáveis: CRUD, uso, renomeação em cascata, merge
│   ├── store.js            ★ estado global, persistência, regras de negócio, realtime
│   ├── charts.js           camada Chart.js com a paleta validada
│   ├── export.js           XLSX (SheetJS) e PDF (jsPDF + autotable), com fallbacks
│   ├── gerenciador.js      editor de listas (modal pelo ⚙ e painel de Configurações)
│   ├── importar.js         importação de .xlsx/.csv em 3 passos, com simulação
│   ├── pages/              uma tela por arquivo (7 telas)
│   └── app.js              roteador, sidebar, barra superior, backup/restauração
└── tests/
    ├── autoteste.html      78 testes automatizados (abra no navegador)
    ├── preview.html        inspeção visual de qualquer rota
    └── shots/              capturas de referência
```

### Onde ler as listas no código

Sempre por `SAGETI.listas`, nunca de `config.js`:

```js
SAGETI.listas.get('setores')        // array de 175 setores
SAGETI.listas.statusDe('entrada')   // rótulos válidos no formulário de entrada
SAGETI.listas.statusDe('saida')     // idem, para a saída
SAGETI.listas.ttrDe('saida')        // TTR do contexto de saída
SAGETI.listas.statusMeta('Devolução')  // { tom, noLab, contextos, desc }
SAGETI.listas.modelosDe('Monitor')  // { sugeridos, outros } — nada fica inacessível
```

Os acessos antigos (`SAGETI.EQUIPAMENTOS`, `SAGETI.PREDIOS`, `SAGETI.statusMeta`…) continuam
funcionando: viraram *getters* que leem das listas dinâmicas.

Para montar um campo de seleção já com o botão de gerenciamento:

```js
UI.selectGerenciavel({ id: 'sa-tecnico', name: 'tecnico',
                       lista: 'tecnicos', obrigatorio: true })
```

### Estado global e tempo real

`store.js` é a única fonte da verdade. Toda mutação chama `emit()`, que faz três coisas:

1. agenda a gravação em `localStorage` (com debounce de 120 ms);
2. notifica os assinantes desta aba — `store.assinar(fn)`;
3. publica no `BroadcastChannel` para as demais abas abertas.

Cada página assina o store no `montar` e cancela no `destruir`. Por isso salvar uma
entrada repinta a dashboard, a tabela de estoque e o histórico no mesmo instante — sem
recarregar, sem *polling*.

```js
// padrão usado em todas as páginas
function montar(container) {
  container.innerHTML = esqueleto();
  desenhar(container);
  var cancelar = SAGETI.store.assinar(function () { desenhar(container); });
  return { destruir: cancelar };
}
```

### Por que scripts clássicos e não módulos ES

Módulos ES (`type="module"`) são bloqueados por CORS quando a página é aberta via
`file://`. Como o requisito era "abrir e usar", os arquivos usam o namespace global
`window.SAGETI` e a ordem de carregamento declarada no `index.html`.

### Dependências (CDN, com degradação)

| Biblioteca | Para quê | Se não carregar |
|---|---|---|
| Chart.js 4.4 | gráficos | cartão mostra a tabela equivalente |
| SheetJS 0.18 | XLSX | exporta CSV com BOM (abre no Excel) |
| jsPDF 2.5 + autotable | PDF | abre a janela de impressão → "Salvar como PDF" |

Nenhuma delas é necessária para cadastrar, movimentar ou consultar.

---

## 5. Decisões de visualização

As escolhas seguem uma regra: **a forma vem do trabalho que o leitor precisa fazer**, e a
cor vem depois.

- **Estoque por tipo** → barras horizontais, série única, uma cor. São até 14 categorias;
  uma pizza de 14 fatias seria ilegível, e colorir cada barra por valor duplicaria uma
  informação que o comprimento já dá.
- **Composição do estoque** → rosca de 4 fatias com a paleta de *status* (verde/âmbar/
  laranja/vermelho), reservada para estado. Parte-do-todo com ≤ 6 segmentos é o caso em
  que a rosca funciona.
- **Entradas × saídas** → duas linhas de 2px nos slots categóricos 1 e 2, com legenda
  sempre presente e valores no *tooltip*.
- **Prédios de origem** → barras, top 8 e o restante somado em "Outros" — nunca se
  resolve excesso de categorias inventando cores.
- **Todo gráfico tem uma tabela gêmea** (botão *Tabela* no cartão): nenhum valor depende
  de passar o mouse ou de distinguir cores.
- **Chips de status carregam cor + rótulo**, nunca cor sozinha.
- **Modo escuro é selecionado, não invertido**: cada slot tem um passo próprio para a
  superfície escura.

Paleta em uso (claro / escuro):

```
série 1 #2a78d6 / #3987e5      good     #0ca30c
série 2 #eb6834 / #d95926      warning  #fab219
superfície #fcfcfb / #1a1a19   serious  #ec835a
                                critical #d03b3b
```

---

## 6. Personalização

### Trocar a logo

Coloque o arquivo em `assets/logo.png` e substitua o conteúdo de dois pontos:

```html
<!-- js/pages/login.js — dentro de .logo-slot__box -->
<div class="logo-slot__box"><img src="assets/logo.png" alt="Logo"></div>

<!-- js/app.js — dentro de .sidebar__logo -->
<div class="sidebar__logo"><img src="assets/logo.png" alt=""></div>
```

### Alterar as listas

**Pela interface**, em Configurações → Listas de seleção, ou no ⚙ ao lado de cada campo.
Não é preciso editar código.

[js/config.js](js/config.js) guarda apenas o **padrão de fábrica** — o que vale na
primeira carga e no botão "Restaurar padrão". Mexer nele só faz sentido para mudar o que
uma instalação nova recebe.

O mapa `MODELOS_POR_EQUIPAMENTO_PADRAO` é uma *sugestão*: o select mostra "Modelos de
&lt;categoria&gt;" e, abaixo, "Outros modelos" com todo o resto — nenhum modelo fica
inacessível se a classificação divergir do inventário real.

### Mudar a cor da marca

Em [css/styles.css](css/styles.css), a variável `--brand` (e `--brand-hover`,
`--brand-active`, `--brand-wash`) nos dois blocos `:root`. As cores dos **gráficos** são
independentes e ficam nas variáveis `--series-*` e `--status-*`.

### Usuários

Contas reais do Firebase Authentication (e-mail/senha) — não existe mais senha em texto
puro em lugar nenhum do código. Para criar um usuário novo: cadastre-o em
console.firebase.google.com → Authentication (e-mail no formato `usuario@sagi-ti.local`,
já que é isso que a tela de login monta a partir do campo "Usuário"), e crie o documento
de perfil correspondente em `/usuarios/{uid}` no Firestore com os campos `usuario`,
`nome` e `perfil` (`admin` ou `tecnico`) — sem esse documento, o login funciona mas o
usuário fica sem nenhuma permissão (perfil "leitura" por padrão).

---

## 7. Testes

> **Desatualizado desde a migração ao Firestore.** `tests/autoteste.html` foi escrito
> para a era `localStorage` (API síncrona, sem rede) e ainda não foi reescrito para o
> `store.js` assíncrono atual — hoje ele não reflete o comportamento real do sistema.
> Mantido aqui como referência do que cobrir num novo suite; não confie no resultado
> até ele ser atualizado.

Abra [tests/autoteste.html](tests/autoteste.html) no navegador. São 78 verificações
cobrindo (cobertura da versão anterior, pré-Firestore):

- listas por contexto (status de entrada/saída/estoque, TTR de cada lado), ausência de
  rótulo duplicado e compatibilidade dos acessos antigos;
- **listas editáveis**: adicionar, bloqueio de duplicata sem acento/caixa, renomeação em
  cascata nos registros, bloqueio de exclusão em uso, exclusão forçada preservando o
  texto, criação de status com tom e presença física, merge de padrões de fábrica sobre
  base customizada, restaurar padrão;
- **presença física**: o mesmo rótulo ("Substituição") resultando em presenças opostas na
  entrada e na saída, migração de registros v1, soma dos tons igual ao total;
- **importação**: CSV com aspas e separador variável, detecção de colunas por sinônimo,
  normalização de datas e de tombos com zero à esquerda, criação/ignorados/recusados com
  simulação que não grava, atualização sob demanda, cadastro automático de opções novas e
  registro no histórico;
- todas as regras de entrada/saída, colisão de tombo, histórico, backup/restauração,
  autenticação, permissões, paleta nos dois temas, geração real de XLSX (com ida-e-volta)
  e de PDF, e a montagem das sete páginas.

Última execução válida: **78 aprovados, 0 falhas**, mas contra a versão `localStorage`
anterior ao Firestore (ver aviso acima).

Em linha de comando:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new `
  --disable-gpu --allow-file-access-from-files --user-data-dir="$env:TEMP\celab_t" `
  --virtual-time-budget=9000 --dump-dom `
  "file:///$((Get-Location).Path -replace '\\','/')/tests/autoteste.html" > "$env:TEMP\r.html"
```

Para inspeção visual: `tests/preview.html?tema=dark#/estoque` (rotas: `dashboard`,
`estoque`, `entrada`, `saida`, `relatorios`, `configuracoes`; `?login=1` abre o login).

---

## 8. Plano de evolução

### Fase 1 — máquina única (superada)
Dados em `localStorage`, sincronização entre abas por `BroadcastChannel`. Ficou pra trás
quando o sistema passou a atender mais de um operador.

### Fase 2 — multiusuário em rede (concluída — Firebase)

Implementada com **Firebase**, não com o Supabase originalmente cogitado aqui — o
resultado é o mesmo objetivo (dados centralizados, tempo real entre operadores,
autenticação de verdade), com uma stack diferente:

| Camada | Antes | Agora |
|---|---|---|
| Dados | `localStorage` | Firestore (`equipamentos`, `movimentacoes`) |
| Tempo real | `BroadcastChannel` (só entre abas da mesma máquina) | `onSnapshot` do Firestore (entre qualquer cliente autenticado) |
| Login | array local, senha em texto puro | Firebase Authentication (e-mail/senha) |
| Autorização | só na UI | reforçada nas [firestore.rules](firestore.rules) (admin/tecnico) |
| Frontend | — | o mesmo; só `js/store.js` fala com o Firebase — as 7 páginas não mudaram de API |

`js/store.js` mantém `estado.equipamentos`/`estado.movimentacoes` como espelho em
memória, atualizado pelos listeners `onSnapshot` — por isso toda função de leitura
(`listarEquipamentos`, `resumo`…) continua síncrona; só as escritas
(`registrarEntrada`, `criarEquipamento`…) viraram `Promise`.

**Ainda não migradas:** as listas editáveis (status, setores, técnicos, modelos, TTR)
continuam no `localStorage` de cada navegador — ver Limitações conhecidas.

### Fase 3 — se o escopo crescer

- **Migrar as listas editáveis para o Firestore também** (coleção `listas`, já prevista
  em `firestore.rules`) — hoje é a maior inconsistência: dois técnicos em máquinas
  diferentes podem ver setores/status diferentes se um deles personalizar a lista local.
- **Reescrever `tests/autoteste.html`** para a API assíncrona atual (ver aviso na seção 7).
- **Next.js 15 + TypeScript + TanStack Query** — só se surgirem muitas telas novas, SSR
  ou necessidade de tipagem forte; o Firebase já no lugar permite migrar o frontend
  incrementalmente, rota a rota.
- **Anexos** (fotos do defeito, termo de entrega assinado) — Firebase Storage.
- **Assinatura digital do termo de saída** e integração com o sistema patrimonial.
- **Relatório de tempo médio de reparo** — os dados já estão no histórico; falta a tela.

---

## 9. Limitações conhecidas

- **Listas editáveis não são compartilhadas.** Status, setores, técnicos, modelos e TTR
  continuam no `localStorage` de cada navegador — só equipamentos e movimentações estão
  no Firestore. Dois técnicos em máquinas diferentes podem ver essas listas divergentes
  se uma delas for personalizada. Ver Fase 3.
- **Exige internet.** Sem conexão com o Firebase, o sistema não abre (login e dados
  dependem de rede) — diferente da versão anterior, que funcionava 100% offline.
- **Sem controle de concorrência forte.** Duas edições no mesmo tombo ao mesmo tempo: a
  última gravação vence (não há transação otimista entre clientes).
- **Exportação depende de CDN.** Sem internet, XLSX vira CSV e o PDF vai pela janela de
  impressão. Para uso offline permanente, baixe as bibliotecas para `js/vendor/` e ajuste
  os `<script>` do `index.html`.
- **`tests/autoteste.html` desatualizado.** Ainda testa a API síncrona da versão
  `localStorage`; não cobre o Firestore. Ver seção 7.
