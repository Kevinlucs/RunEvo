# PROMPT — Lapidar a fase "Recordes pessoais" (badges + tela de detalhe + Marcos)

> Cole este prompt inteiro no agente de código do RunEvo. Ele descreve **exatamente** o que
> mudar, os arquivos envolvidos, o modelo de dados e os guardrails. Siga na ordem.

---

## Contexto

A tela `src/app/stats/records.tsx` já existe e hoje renderiza um **grid de hexágonos SVG**
(`RecordHexagon`) que, ao toque, abre direto um `RecordEditModal` (dois `TextInput` com máscara).

Queremos deixá-la **fiel às duas referências visuais** (anexadas nesta sessão):

- **Ref A — Grid "Recordes pessoais":** 11 **badges PNG** (não SVG), 3 por linha, com o nome da
  distância, o tempo e a data embaixo de cada um.
- **Ref B — Tela de detalhe de um recorde:** badge grande centralizado, data, título
  "Mais rápido {distância}", tempo grande, botão **"+ ADICIONAR NOVO RECORDE PESSOAL"**, e uma
  seção **MARCOS** com o histórico de tempos (cada linha: tempo, data e uma lixeira pra apagar).

O input de tempo deve **reaproveitar o wheel carrossel** que já existe no projeto
(`src/components/forms/PreviousTimesWheel.tsx`, que usa `react-native-wheel-picker-expo`), em vez
dos `TextInput` com máscara atuais.

---

## Assets já disponíveis

- Badges: `assets/rp/RP-1.png` … `assets/rp/RP-11.png`.
- **Mapeamento posicional** (confirmado abrindo os PNGs): `RP-N` → `PERSONAL_RECORDS[N-1]`.

  | Arquivo   | key        | Label na ref B | Nome no grid (ref A) |
  | --------- | ---------- | -------------- | -------------------- |
  | RP-1.png  | `1k`       | 1K             | 1 km                 |
  | RP-2.png  | `1mi`      | 1MI            | 1 mi                 |
  | RP-3.png  | `2mi`      | 2MI            | 2 mi                 |
  | RP-4.png  | `5k`       | 5K             | 5 km                 |
  | RP-5.png  | `5mi`      | 5MI            | 5 mi                 |
  | RP-6.png  | `10k`      | 10K            | 10 km                |
  | RP-7.png  | `10mi`     | 10MI           | 10 mi                |
  | RP-8.png  | `half`     | 21.1           | Meia maratona        |
  | RP-9.png  | `marathon` | 42.2           | Maratona             |
  | RP-10.png | `50k`      | 50K            | 50 km                |
  | RP-11.png | `100k`     | 100K           | 100 km               |

  > Os PNGs **já trazem** a cor e o texto (1K, 21.1, etc.) embutidos. Não desenhar mais o hexágono
  > por cima — a imagem é a arte final. A cor de cada `PERSONAL_RECORDS[i].color` continua útil só
  > para acentos (ex.: borda do tempo grande na tela de detalhe), não para o badge.

**Nomes de exibição** (o `distanceLabel` atual é curto: "1k", "Meia"…). Adicionar um campo de nome
longo para o grid/detalhe. Ver Passo 1.

---

## Passo 1 — Constantes: nome longo + fonte do badge

Em `src/services/gamification/constants.ts`, no tipo `PersonalRecord` e no array
`PERSONAL_RECORDS`, **adicionar**:

- `displayName: string` — nome longo pra UI ("1 km", "Meia maratona", "Maratona", "100 km"…).

Criar um mapa estático de imagens (React Native exige `require` estático, não interpolado):

```ts
// src/services/gamification/recordBadges.ts
import type { ImageSourcePropType } from 'react-native';

/** Badge PNG de cada distância. Chave = PersonalRecord.key. */
export const RECORD_BADGES: Record<string, ImageSourcePropType> = {
  '1k': require('../../../assets/rp/RP-1.png'),
  '1mi': require('../../../assets/rp/RP-2.png'),
  '2mi': require('../../../assets/rp/RP-3.png'),
  '5k': require('../../../assets/rp/RP-4.png'),
  '5mi': require('../../../assets/rp/RP-5.png'),
  '10k': require('../../../assets/rp/RP-6.png'),
  '10mi': require('../../../assets/rp/RP-7.png'),
  half: require('../../../assets/rp/RP-8.png'),
  marathon: require('../../../assets/rp/RP-9.png'),
  '50k': require('../../../assets/rp/RP-10.png'),
  '100k': require('../../../assets/rp/RP-11.png'),
};
```

> Ajustar o caminho relativo do `require` conforme a pasta real do arquivo. Confirmar que
> `assets/` está dentro do bundle do Metro (já está — outros PNGs de `assets/` são usados).

---

## Passo 2 — Modelo de dados: histórico de recordes ("Marcos")

**Este é o ponto mais importante e o que mais muda.** Hoje o repositório guarda **1 linha por
`(user_id, record_key)`** via `upsert` (`src/repositories/personal-record.repository.ts`), ou seja,
só existe _o_ recorde atual. A **ref B mostra um histórico** ("MARCOS": 02:00, 04:03, 04:09 com
datas diferentes) e permite apagar entradas individuais. Precisamos guardar **N entradas por
distância**.

### 2.1 Schema (migration)

A tabela `personal_records` hoje tem PK `(user_id, record_key)`. Migrar para permitir múltiplas
linhas por distância:

- Nova coluna `id TEXT PRIMARY KEY` (uuid).
- Manter `user_id`, `record_key`, `time_str`, `date_iso`, `updated_at`.
- Adicionar `source TEXT NOT NULL DEFAULT 'manual'` — `'manual' | 'strava'`.
- Adicionar `external_url TEXT` — deep link da atividade no Strava (null p/ manuais).
- Remover a UNIQUE `(user_id, record_key)` (agora há histórico).
- Índice em `(user_id, record_key)` pra listar rápido.

> Seguir o mesmo padrão de migração já usado no projeto (`src/db/`). A tabela continua **LOCAL-ONLY**
> (fora de `SYNCED_TABLES`) até uma futura necessidade de sincronização, como o comentário atual já diz.
> Se houver dados de teste na tabela antiga, uma migração destrutiva é aceitável nesta fase (app
> ainda não lançado) — mas confirme antes de dropar.

### 2.2 Entidade

`src/domain/entities/personal-record.ts` — atualizar:

```ts
export type PersonalRecordSource = 'manual' | 'strava';

export interface PersonalRecordEntry {
  id: string;
  key: string; // PersonalRecord.key
  time: string; // "HH:MM:SS" ou "MM:SS"
  date?: string; // ISO — quando o recorde foi obtido
  source: PersonalRecordSource;
  externalUrl?: string; // deep link Strava (source === 'strava')
  updatedAt: string;
}
```

### 2.3 Repositório

`src/repositories/personal-record.repository.ts` — reescrever a API:

- `listBest(userId)` → `Record<string, PersonalRecordEntry>` — **melhor** entrada por `key`
  (menor `parseTimeToSeconds(time)`). Usado pelo grid. **Mantém a mesma forma de retorno** que o
  `list` atual, então `computeRecords`/`usePersonalRecords` mudam pouco.
- `listByKey(userId, key)` → `PersonalRecordEntry[]` — todas as entradas da distância, ordenadas
  por `date` desc (sem data no fim). Usado pela tela de detalhe (Marcos).
- `add(userId, key, input: { time; date?; source?; externalUrl? })` → cria **nova** entrada
  (gera `id`, `source` default `'manual'`).
- `remove(id)` → apaga **uma** entrada pelo `id` (a lixeira dos Marcos).
- (opcional) `clearKey(userId, key)` → apaga todas de uma distância.

> Não usar mais `upsert` por `(user_id, record_key)`. "Adicionar recorde" sempre **insere** uma
> entrada nova; o "recorde atual" é derivado (menor tempo).

### 2.4 Hook

`src/hooks/usePersonalRecords.ts`:

- `overrides` continua sendo `Record<string, PersonalRecordEntry>` mas vindo de `listBest`.
- Trocar `save`/`clear` por `add(key, input)` e `removeEntry(id)`.
- Adicionar um segundo hook `usePersonalRecordHistory(key)` → `{ entries, add, removeEntry, isLoading }`
  usando `listByKey`, para a tela de detalhe. Invalida a mesma queryKey pra o grid refletir.

---

## Passo 3 — Grid "Recordes pessoais" (ref A)

Reescrever `src/app/stats/records.tsx`:

- Manter `<Screen>` + `<AppHeader />` + título "Recordes pessoais".
- Trocar o `RecordHexagon` por um novo card **`RecordBadgeCard`** que renderiza o **PNG**:
  - `<Image source={RECORD_BADGES[record.key]} />` (~96–104px, `resizeMode="contain"`).
  - Abaixo, em negrito: `record.displayName` ("1 km", "Meia maratona"…).
  - Se **houver** recorde: tempo humanizado (ver 3.1) + data curta (muted). Se **não** houver:
    só o nome (badge levemente esmaecido, `opacity ~0.9`, sem tempo/data) — igual à ref A onde
    "10 mi / Meia maratona / Maratona / 50 km / 100 km" aparecem sem tempo.
- Grid de **3 colunas** (`flexWrap`, largura ~1/3), espaçamento generoso como na ref.
- **Tap no card → navega para a tela de detalhe** (Passo 4), NÃO abre modal:
  `router.push('/stats/records/' + record.key)`.
- Remover o `RecordEditModal` desta tela (ele passa a viver na tela de detalhe).
- Pode manter uma nota de rodapé sobre a origem manual ou via Strava dos recordes.

### 3.1 Formato de tempo no grid

Na ref A o tempo aparece humanizado: **"2 min 0 s"**, "3 min 38 s", "22 min 26 s", "47 min 58 s",
"14 min 8 s". Criar helper `formatRecordTimeHuman(time: string): string`:

- `"MM:SS"` → `"{M} min {S} s"`.
- `"HH:MM:SS"` → `"{H} h {M} min {S} s"` (sem zeros à esquerda; omitir `h` se 0).

> Na **tela de detalhe** o tempo grande usa o formato **cru** (ex.: "02:00"), como na ref B.
> Manter os dois formatos.

### 3.2 `RecordHexagon`

Não é mais usado no grid. **Não apagar** ainda (pode estar referenciado em testes/outras telas);
apenas parar de importar em `records.tsx`. Se `grep` confirmar que ninguém mais usa, remover o
arquivo e o export em `src/components/gamification/index.ts`.

---

## Passo 4 — Tela de detalhe (ref B) — NOVA rota

Criar rota dinâmica **`src/app/stats/records/[key].tsx`** (expo-router). Se a estrutura atual não
comporta subpasta com o `_layout` de `stats`, criar `src/app/stats/records/_layout.tsx` mínimo
(Stack headless) espelhando `src/app/stats/_layout.tsx`.

Conteúdo da tela (de cima pra baixo, fiel à ref B):

1. **Voltar** — seta no topo-esquerdo (`router.back()`), mesmo estilo/hit-area dos outros headers
   da fase (reutilizar o botão de voltar que a fase já usa; se `AppHeader` tiver variante com back,
   usar).
2. **Badge grande** centralizado: `<Image source={RECORD_BADGES[key]} />` ~176–200px, `contain`.
3. **Data** do recorde atual (melhor entrada), formato "21 de abr. de 2026" (usar o formatador de
   data longo pt-BR que a fase já usa; se não houver, `toLocaleDateString('pt-BR', { day, month:
'short', year })`).
4. **Título**: `Mais rápido {record.displayName}` (ex.: "Mais rápido 1 km").
5. **Tempo grande**: melhor tempo no formato cru "02:00" (fonte grande, bold). Se não houver
   recorde, mostrar um placeholder discreto (ex.: "--:--") e ocultar a data.
6. **Botão** full-width "**+ ADICIONAR NOVO RECORDE PESSOAL**" (estilo pill escuro como na ref) →
   abre o **modal de wheel** (Passo 5). Ao confirmar, chama `add(key, { time, date })`.
7. **Divider "MARCOS"** — label centralizado com linhas nas laterais (como na ref).
8. **Lista de Marcos** — `usePersonalRecordHistory(key).entries`, cada item num card:
   - Tempo (bold) em cima, data (muted) embaixo.
   - **Lixeira** à direita → `removeEntry(entry.id)` com confirmação (usar o popup padrão de
     remoção já padronizado na fase — o mesmo "Remover Treino" reaproveitável, ou o `ConfirmDialog`
     equivalente). Não deletar sem confirmar.
   - Se `entry.source === 'strava'`: o card é **tocável** e abre o Strava
     (`Linking.openURL(entry.externalUrl)`). Exibir um selo/ícone discreto do Strava e **ocultar a
     lixeira** (entradas do Strava não se apagam manualmente — são espelho da integração). Deixar
     isso pronto mesmo sem dados reais ainda.

> Ordenação dos Marcos: por `date` desc; entradas sem data por último (ou por `updatedAt`).

---

## Passo 5 — Input de tempo com **wheel carrossel** (reaproveitar)

Refatorar o `RecordEditModal` (ou criar `RecordAddSheet`) para usar o **wheel** em vez dos
`TextInput` com máscara:

- Reaproveitar a lógica de `src/components/forms/PreviousTimesWheel.tsx`
  (`react-native-wheel-picker-expo`, helpers `toHMS`/`parseHMS`, colunas H/M/S). Extrair um
  componente `TimeWheel` genérico (horas 0–maxH, min 0–59, seg 0–59) se ajudar a não duplicar.
- **Data**: reaproveitar `src/components/forms/DateField.tsx` (não o `TextInput` "AAAA-MM-DD").
- Validação de tempo: continuar usando `parseTimeToSeconds` (rejeita 0/negativo). Como o wheel só
  gera valores válidos, o único caso de erro é tempo total = 0.
- Ao salvar: `onConfirm({ time, date })` → tela de detalhe chama `add(...)`.
- Remover deste sheet o botão "Remover recorde" (a remoção agora é por entrada, na lista de Marcos).

---

## Passo 6 — Ícones lucide (consistência da fase)

Trocar os `Ionicons` remanescentes destes componentes por **lucide-react-native** (padrão que a
fase adotou):

- `trophy` → `Award` (ou `Medal`).
- `trash-outline` → `Trash2`.
- seta de voltar → `ChevronLeft` / `ArrowLeft` (o mesmo que a fase usa).

---

## Guardrails (não desviar)

- **Fidelidade visual** às refs A e B: espaçamentos, hierarquia (badge → data → título → tempo →
  botão → MARCOS → lista), pill escuro do botão, divider "MARCOS". Nada de inventar cores novas —
  usar tokens de `@/theme` (`colors`, `spacing`, `fontSizes`, `fontWeight`, `radii`).
- **TypeScript estrito**: sem `any`, retorno explícito nas funções, tipos exportados onde já existem.
- **Não** alterar lógica de outras telas da fase (níveis, conquistas) nem o `compute.ts` além do
  necessário para `displayName`/melhor-tempo.
- **LOCAL-ONLY** permanece: `personal_records` fora de `SYNCED_TABLES`; nada de outbox/sync.
- Reaproveitar componentes existentes (`NeonButton`, `Screen`, `AppHeader`, `DateField`,
  wheel, popup de confirmação) — **não** recriar do zero.
- Manter a `queryKey` `['personal-records', userId]` e invalidar após `add`/`removeEntry` para o
  grid e o detalhe refletirem na hora.
- Acessibilidade: `accessibilityRole="button"` + `accessibilityLabel` nos cards, botão e lixeira.
- Rodar type-check/lint ao final; garantir que a navegação `/stats/records/[key]` funciona e que o
  grid volta a montar sem `RecordHexagon`.

---

## Checklist de aceite

- [ ] Grid mostra os 11 **badges PNG** (3/linha) com nome + tempo humanizado + data; vazios só com
      o nome, esmaecidos.
- [ ] Tap num badge **navega** pra tela de detalhe (não abre modal).
- [ ] Tela de detalhe fiel à ref B: badge grande, data, "Mais rápido {dist}", tempo grande, botão,
      divider MARCOS, lista com lixeira por entrada.
- [ ] "Adicionar novo recorde" abre o **wheel carrossel** (H:M:S) + data via `DateField`; salvar
      cria nova entrada.
- [ ] Marcos listam o histórico; lixeira apaga uma entrada (com confirmação) e o grid/tempo grande
      se atualizam (recorde = menor tempo).
- [ ] Entradas `source: 'strava'` prontas: tocáveis (abrem Strava), sem lixeira, com selo — mesmo
      sem dados reais.
- [ ] Ícones em lucide; sem `Ionicons` nos componentes tocados.
- [ ] Type-check e lint limpos.

```

```
