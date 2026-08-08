# SAGE-TI — Sistema de Ativos e Gestão de Estoque de Tecnologia da Informação

Sistema web de controle de estoque para laboratório de manutenção de equipamentos de TI.
Registra entradas, saídas e alterações; mantém o inventário e a dashboard sincronizados
em tempo real; exporta inventário e relatórios em **XLSX** e **PDF**.

**Roda sem instalar nada.** Abra [index.html](index.html) no navegador.

---

## 1. Como usar

### Abrir

Dê duplo clique em `index.html`, ou arraste-o para uma janela do Chrome/Edge.

Credenciais de demonstração:

| Usuário   | Senha        | Perfil                                |
|-----------|--------------|---------------------------------------|
| `admin`   | `admin123`   | Administrador — edita e exclui        |
| `tecnico` | `tecnico123` | Técnico — edita, não exclui           |

> O sistema nasce com 18 equipamentos de exemplo para a dashboard não abrir vazia.
> Em **Dados e backup → Apagar todos os dados** você zera tudo e começa do inventário real.

### Recomendado: servir por HTTP

Aberto direto do disco (`file://`) alguns navegadores restringem o armazenamento local
e a sincronização entre abas. Dentro da pasta `CELAB`:

```powershell
python servidor.py
```

Depois acesse `http://localhost:8080`. Com isso você ganha:

- persistência garantida entre sessões;
- **sincronização entre abas** — abra a dashboard em uma aba e a entrada em outra:
  ao salvar, a dashboard se atualiza sozinha.

### Publicar na intranet

[servidor.py](servidor.py) já escuta em `0.0.0.0:8080`, então outras máquinas da rede
acessam por `http://<ip-desta-máquina>:8080`. Host e porta ficam no topo do arquivo.

Libere a porta no firewall **uma vez**, em um PowerShell como Administrador:

```powershell
New-NetFirewallRule -DisplayName "SAGE-TI 8080" -Direction Inbound `
  -Protocol TCP -LocalPort 8080 -Action Allow -Profile Private
```

> **Atenção — os dados não são compartilhados.** Servir na rede distribui a *interface*,
> não o banco. Cada navegador guarda o próprio `localStorage`: duas máquinas verão
> inventários diferentes, e lançar uma entrada em uma delas não aparece na outra.
> Para um estoque único entre vários operadores é preciso um backend — veja a
> **Fase 2** na seção 8.

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

Em `store.js`, função `usuariosPadrao()`. As senhas ficam em texto puro — adequado a um
app de máquina única, **não** a uma implantação em rede. Veja a Fase 2.

---

## 7. Testes

Abra [tests/autoteste.html](tests/autoteste.html) no navegador. São 78 verificações
cobrindo:

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

Última execução: **78 aprovados, 0 falhas** (Chrome headless, perfil limpo).

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

O que existe hoje atende **um laboratório, um computador**. O que muda conforme a
necessidade cresce:

### Fase 1 — em produção hoje (concluída)
Dados em `localStorage`, sincronização entre abas por `BroadcastChannel`, backup manual
em JSON, listas editáveis pela interface e carga inicial por planilha. Zero
infraestrutura, zero custo.

**Limite:** os dados vivem no navegador daquela máquina. Dois técnicos em computadores
diferentes têm inventários diferentes.

### Fase 2 — multiusuário em rede (recomendada quando houver 2+ operadores)

**Stack sugerida: Supabase.** É o menor salto de complexidade a partir daqui — Postgres
gerenciado, autenticação e *realtime* por WebSocket num serviço só, com camada gratuita
suficiente para este volume.

| Camada | Hoje | Depois |
|---|---|---|
| Dados | `localStorage` | Postgres (Supabase) |
| Tempo real | `BroadcastChannel` | Supabase Realtime (replicação lógica) |
| Login | `usuariosPadrao()` | Supabase Auth + RLS por perfil |
| Frontend | este mesmo | este mesmo, só o `store.js` muda |

A migração **não exige reescrever o sistema**. `store.js` já isola toda a persistência
atrás de uma interface pequena; trocá-la é substituir seis funções:

```js
// store.js — hoje
function registrarEntrada(dados) { /* …grava em memória… */ emit({tipo:'entrada'}); }

// store.js — com Supabase
async function registrarEntrada(dados) {
  const { data, error } = await supabase.rpc('registrar_entrada', dados);
  if (error) return { ok: false, erro: error.message };
  return { ok: true, equipamento: data };   // o emit vem do canal realtime
}

supabase.channel('estoque')
  .on('postgres_changes', { event: '*', schema: 'public' }, recarregarDeFora)
  .subscribe();
```

O `emit()` local dá lugar ao evento vindo do banco — as páginas, que já assinam o store,
não mudam uma linha.

Esboço do schema:

```sql
-- As listas são DADOS, não constraints. Um CHECK com status fixos quebraria o
-- requisito de o usuário poder criar as próprias opções pela interface.
create table listas (
  id uuid primary key default gen_random_uuid(),
  lista text not null,          -- 'status' | 'setores' | 'tecnicos' | …
  valor text not null,
  tom text,                     -- só para status: good|info|warning|serious|critical|neutral
  no_lab boolean default true,  -- só para status: presença física padrão
  contextos text[],             -- só para status: {entrada,saida,estoque}
  descricao text,
  ordem int default 0,
  unique (lista, valor)
);
-- Duplicata tolerante a acento e caixa, como no cliente:
create unique index listas_valor_uk
  on listas (lista, lower(unaccent(valor)));

create table equipamentos (
  id uuid primary key default gen_random_uuid(),
  equipamento text not null,
  modelo text not null,
  tombo_novo text,
  tombo_antigo text,
  status text not null,
  no_laboratorio boolean not null default true,   -- definido pela operação
  chamado text,
  servico_solicitado text,
  ttr text,
  tecnico text,
  data_entrada date,
  predio_origem text,
  setor_origem text,
  data_saida date,
  predio_destino text,
  setor_destino text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- a regra de identidade por tombo, garantida pelo banco
create unique index equipamentos_tombo_novo_uk
  on equipamentos (tombo_novo) where tombo_novo <> '';
create index equipamentos_no_lab_idx on equipamentos (no_laboratorio);

create table movimentacoes (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid references equipamentos(id) on delete set null,
  tipo text not null check (tipo in
    ('ENTRADA','SAIDA','CADASTRO','AJUSTE','EXCLUSAO','IMPORTACAO')),
  data date not null,
  status_anterior text,
  status_resultante text,
  predio text, setor text, chamado text, ttr text, tecnico text,
  servico_solicitado text, observacao text,
  usuario_id uuid references auth.users(id),
  registrado_em timestamptz default now()
);

create index movimentacoes_data_idx on movimentacoes (data desc);
alter publication supabase_realtime
  add table equipamentos, movimentacoes, listas;
```

Duas funções `plpgsql` fecham as regras no banco: `registrar_entrada` (upsert por tombo,
`no_laboratorio = true`) e `registrar_saida` (recusa tombo ausente ou já expedido,
`no_laboratorio = false`). Renomear uma opção vira um `UPDATE` em cascata dentro de uma
transação — o mesmo que `listas.renomear()` faz hoje no cliente.

As regras de entrada e saída viram funções `plpgsql` — assim a consistência não depende
do cliente. Ative RLS: leitura para autenticados, escrita para `tecnico` e `admin`,
`delete` só para `admin`.

**Esforço estimado:** 2 a 3 dias, sem tocar na interface.

### Fase 3 — se o escopo crescer

Só vale a pena com demandas concretas que a Fase 2 não cubra:

- **Next.js 15 + TypeScript + TanStack Query** — se surgirem muitas telas novas, SSR ou
  necessidade de tipagem forte no domínio. Com Supabase já no lugar, o frontend é
  reescrito de forma incremental, rota a rota.
- **Leitura de código de barras do tombo** — `@zxing/browser` com a câmera do celular
  acelera muito a conferência física de inventário.
- **Anexos** (fotos do defeito, termo de entrega assinado) — Supabase Storage.
- **Assinatura digital do termo de saída** e integração com o sistema patrimonial.
- **Relatório de tempo médio de reparo** — os dados já estão no histórico; falta a tela.

Recomendação: só saia da Fase 2 quando houver uma demanda que a Fase 2 realmente não
resolva. Next.js aqui é uma escolha de escala, não de qualidade — a interface atual já
entrega a experiência pretendida.

---

## 9. Limitações conhecidas

- **Dados por navegador.** Trocar de computador ou limpar os dados de navegação apaga o
  inventário. Faça o backup JSON com regularidade (Dados e backup → Baixar backup).
- **Senhas em texto puro.** Aceitável para uma máquina de laboratório com acesso físico
  controlado; inaceitável em rede — resolvido na Fase 2 com Supabase Auth.
- **Sem controle de concorrência.** Duas abas editando o mesmo tombo ao mesmo tempo: a
  última gravação vence.
- **Exportação depende de CDN.** Sem internet, XLSX vira CSV e o PDF vai pela janela de
  impressão. Para uso offline permanente, baixe as três bibliotecas para `js/vendor/` e
  ajuste os `<script>` do `index.html`.
- **Volume.** `localStorage` comporta ~5 MB — na ordem de 15 a 20 mil movimentações. Bem
  acima do giro de um laboratório, mas é um teto real.
