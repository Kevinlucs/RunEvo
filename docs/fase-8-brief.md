# Fase 8 — Brief de Execução: Análise de Viabilidade + Trial de 8 Semanas + Reposicionamento do Plus

> **Para o Claude Code executar.** Branch: `feat/fase-8-viabilidade-trial` (a partir de `main`, após merge da 7.5).
> Referências: enunciado §13 (blueprint/goalContext), §34 (Free/Plus). Motor: `src/domain/motor-evo/`.
> Esta é a fase que responde **"por que pagar o RunEvo?"** — trate a linguagem com o mesmo cuidado do código.
>
> **Objetivo:** dar voz ao que o motor já calcula em silêncio (viabilidade do objetivo), aplicar o
> trial de 8 semanas como gate de valor, e reposicionar o Plus como **treinador**, não dashboard.

---

## 0. Guardrails da fase

1. **`src/domain/motor-evo/` está fechado.** O motor **já calcula** a relação entre capacidade (teste de 3km) e objetivo — via `getGoalContext`/`muchSlowerGoal` ou equivalente já portado. Esta fase **lê e comunica** esse cálculo; **não cria lógica de viabilidade nova no motor** nem recalcula. Se o dado necessário não estiver exposto pelo motor, **pare e me avise** — a gente decide se expõe um campo (mudança mínima e autorizada caso a caso), nunca inventa número.
2. **Trial é regra de acesso, decidida no SERVIÇO.** O gate das 8 semanas usa `useEntitlement()`/subscription service, nunca decisão na UI. `RunEvo+` é o entitlement.
3. **Persistência via repositories** (offline-first).
4. **Gates verdes antes de cada commit:** typecheck 0, lint 0/0, testes ≥475.

---

## Grupo 0 — Mapeamento (headless, antes de tudo)

Antes de escrever qualquer UI, **inspecione o motor portado** e reporte na Parada 1 o que já existe:
- O que `getGoalContext` (ou equivalente em `src/domain/motor-evo/`) retorna sobre a relação capacidade×objetivo? Há um campo/enum que classifica o objetivo (realista/ambicioso/irreal)? Como se chama, que valores assume?
- O `blueprint` gerado carrega `athleteAnalysis`/`warnings` que já expressam viabilidade? O que exatamente?
- O motor calcula um **pace-alvo derivado da capacidade real** (o que ele "ancora" quando o objetivo é longe demais)? Esse é o número que vira "com este plano você chega a ~X".
- **IMC:** o motor **já usa o IMC/peso** em algum ponto do cálculo (viabilidade, volume, progressão, risco)? Onde e como? Ou o peso hoje só é coletado e exibido, sem entrar na lógica? **Reporte exatamente** — isto decide se o IMC já pode compor o veredito ou se precisamos de uma mudança mínima e autorizada no motor para que ele entre. **Não altere o motor no Grupo 0** — só descubra e relate.

**Não construa nada ainda** — só mapeie e reporte. Isto define (a) se conseguimos os 3 níveis a partir do que existe, e (b) se o IMC já participa ou precisa passar a participar.

### ⏸ PARADA 1 — reporte o mapeamento
O que o motor já expõe, e o que (se algo) falta para classificar em 3 níveis. Aguarde minha decisão antes do Grupo 1.

---

## Grupo 1 — Classificador de viabilidade (serviço, lê do motor)

`src/services/viability/goal-viability.ts` — função pura **fora do motor** que traduz a saída do motor em um dos **3 níveis**:

- **Realista** — a capacidade atual comporta o objetivo no prazo dado.
- **Ambicioso** — alcançável, mas exige muito; o plano vai no limite saudável.
- **Fora de alcance por ora** — a capacidade atual não comporta o objetivo neste prazo; o motor ancorou num alvo seguro.

A classificação **deriva de valores que o motor já produziu** (gap entre pace-objetivo e pace-capacidade, prazo, `goalContext`, e **IMC** se o Grupo 0 confirmou que ele entra). Se o motor já dá o enum, só mapeamos os nomes; se dá números, definimos os limiares aqui (documentados) — **sem** recalcular treino.

**A viabilidade considera o atleta inteiro**, não só o pace: teste de 3km (capacidade), objetivo em texto livre (distância + tempo desejado), prazo até a prova, e **IMC** (peso ⟹ impacto articular e carga sustentável). Se o Grupo 0 mostrou que o motor **já** usa o IMC, o classificador só lê esse fator. Se **não** usa e você (usuário) autorizou, o Grupo 1 pode incorporar o IMC como um **sinal adicional determinístico** no classificador de viabilidade (fora do motor, em `goal-viability.ts`) — ex.: IMC muito elevado suaviza o veredito e reduz a agressividade recomendada — documentando o critério. **Nunca** transforme isso em juízo sobre o corpo do atleta; é sobre carga segura, não estética.

Cada nível carrega (dados estruturados, determinísticos):
- o **veredito** (um dos 3, com cor/ícone suave — nada alarmante)
- os **fatores** que pesaram (capacidade vs objetivo, prazo, IMC) — em forma de dados, para alimentar a mensagem
- quando "Fora de alcance": o **alvo intermediário** que o motor ancorou ("com este plano você chega a ~X") e a **projeção de jornada** ("concluindo este ciclo, você estará mais preparado para buscar Y")

**Teste:** os 3 níveis saem corretos para fixtures de (capacidade, objetivo, prazo, IMC) representativos; a classificação nunca lança; usa só dados do motor (+ IMC se autorizado).

---

## Grupo 2 — Comunicação na prévia (a isca de valor — Free)

Na tela de **prévia do plano** (já existe, `plan/preview.tsx`), adicione o **momento de viabilidade** — visível para **todos (Free)**, porque é o que conquista o atleta antes da semana 1.

**Regras de tom (tão importantes quanto o código):**
- **Nunca** a palavra "impossível". "Fora de alcance por ora" é o mais duro que se diz.
- Sempre **enquadrar como jornada em etapas**, não rejeição: *"Correr [objetivo] neste prazo é muito ambicioso para sua base atual. Montei um plano que te leva com segurança rumo a ~[alvo], e concluindo este ciclo você estará muito mais preparado para buscar [objetivo]. Vamos com consistência — a evolução vem."*
- **Honesto e encorajador ao mesmo tempo.** O atleta tem que sentir que o app entende de corrida (credibilidade) E que acredita nele (motivação).
- Para "Realista": celebrar sem arrogância ("Seu objetivo está ao seu alcance — o plano foi desenhado para te levar lá com segurança").
- Para "Ambicioso": honestidade animadora ("É ambicioso, e dá pra buscar — o plano vai no seu limite saudável; siga os check-ins e a gente ajusta no caminho").

### A explicação HUMANA (o coração da fase) — "o motor decide, a IA redige"

O atleta não quer um rótulo seco; quer entender **por que** o plano foi aprovado como está ou **por que** teve que ser ajustado, numa voz de treinador de verdade. A arquitetura (a mesma do check-in, que já funciona):

1. **O motor/serviço decide os FATOS** — o nível (3), os fatores (capacidade, prazo, IMC), o alvo ancorado. Determinístico, verdadeiro, nunca da IA.
2. **A IA REDIGE a explicação** — recebe no prompt **os fatos já decididos** (nível, gap de pace, efeito do IMC na carga, alvo intermediário, objetivo do atleta em texto) e é instruída a explicá-los em linguagem calorosa, simples e encorajadora. A IA é a **voz**, não o cérebro: **não decide o nível, não inventa número, não contradiz o motor**. Reutilize a Edge Function/infra de IA já existente (a `generate-plan` já tem esses dados no contexto — dá para pedir a explicação de viabilidade no mesmo retorno do blueprint, campo dedicado, em vez de uma chamada nova).
3. **Fallback determinístico obrigatório** — se a IA falhar (429/timeout/JSON inválido), um texto-modelo por nível (bem escrito, caloroso) assume. O atleta **sempre** recebe uma explicação humana, com ou sem IA.

**Guardrails da explicação (validar em código, não confiar na IA):**
- O texto da IA **nunca** substitui o veredito; o nível exibido é sempre o do motor.
- Se a explicação da IA vier vazia, malformada, ou contradizer o nível (heurística simples: menciona "impossível", ou promete um tempo melhor que o objetivo declarado num caso "fora de alcance"), **descarta e usa o fallback**.
- Nada de números que o motor não produziu (sem "perca 5kg", sem "em 3 semanas você melhora X" — a menos que o motor tenha esse dado).

**Exemplo de tom (fallback determinístico, nível "Fora de alcance por ora"):**
> "Seu objetivo de [X] é bem ambicioso para o momento — pelo seu teste de 3km e seu perfil atual, chegar lá neste prazo exigiria saltos que aumentariam muito o risco de lesão. Montei um plano que te leva com segurança rumo a ~[alvo], construindo a base que o seu corpo precisa. Concluindo este ciclo, você estará muito mais perto de buscar [X] com consistência. Bora com paciência — a evolução vem de quem não se machuca no caminho."

**Teste:** os 3 vereditos renderizam com o tom correto; nenhum caminho mostra "impossível"; o alvo intermediário aparece quando "Fora de alcance"; com a IA mockada como falha, o fallback determinístico aparece; uma explicação da IA que contradiz o nível é descartada em favor do fallback.

---

## Grupo 3 — Trial de 8 semanas (o gate de valor)

**Decisão de negócio (fechada):** o Free vê e treina as **8 primeiras semanas** do plano. Da **9ª em diante**, precisa do RunEvo+.

Regras:
- **O atleta sempre pode treinar a semana atual** — nunca fica sem o treino de hoje, mesmo Free, mesmo depois da semana 8 (não expulsar do próprio treino). *(Confirme comigo na Parada 2 se essa regra conflita com "semana 9 é Plus" — a intenção é: ver/planejar as semanas futuras é Plus, mas o treino corrente nunca some.)*
- **Ver as semanas 9+ detalhadas** (treinos, paces, blocos) = Plus. Para Free, aparecem **bloqueadas/borradas** com CTA único de assinatura (padrão §34).
- **Gerar uma nova planilha** = Plus (Free vive a 1ª planilha).
- **Edge do plano curto:** se o plano tem ≤8 semanas (ex.: 5k curto), o trial cobriria tudo. Regra: **"8 semanas OU metade do plano, o que terminar primeiro"** — para planos curtos, o gate cai na metade. Confirme o cálculo comigo se houver ambiguidade.
- **Aviso de prazo:** só **quando faltar pouco** (~2 semanas para o fim do trial) — um aviso discreto e encorajador ("faltam 2 semanas do seu acesso completo; assine para seguir rumo à sua prova"). **Sem** contador permanente.

Gate no serviço, lendo entitlement. Nunca decidir na UI.

**Teste:** Free vê semanas 1-8, semana 9+ bloqueada; plano de 6 semanas → gate na semana 3 (metade); semana atual sempre acessível; aviso dispara a ~2 semanas do fim; Plus vê tudo.

---

## Grupo 4 — Reposicionamento do Plus como "treinador"

Ajustar a **oferta RunEvo+** (`runevo-plus/index.tsx`) e a copy de conversão para vender **orientação e evolução**, não dashboard:

- Reordenar os benefícios para liderar com o que o iniciante quer: **plano completo desbloqueado**, **análise de viabilidade aprofundada** (reavaliação a cada ciclo), **adaptação inteligente**, e só então histórico/gráficos.
- A mensagem-mãe: *"O RunEvo+ é o treinador que te leva até a prova: plano completo, adaptação a cada semana, e a evolução que te prepara para o próximo objetivo."*
- Reusar `PLUS_FEATURES` (centralizado na Fase 6) — atualizar a ordem/texto lá, não espalhar.

**Teste:** a oferta reflete a nova ordem; copy sem promessas de features inexistentes.

---

## ⏸ PARADA 2 — fechamento

Traga **apenas**:
1. resumo `X/Y verdes` + divergências;
2. bloco §41 do PR;
3. decisões tomadas sozinho (em especial limiares dos 3 níveis, se você os definiu);
4. confirmação das duas regras que pedi para validar comigo: (a) "semana atual sempre acessível" vs "semana 9+ é Plus"; (b) cálculo do edge de plano curto;
5. teste no emulador **visível** (Pixel 7 — e 360dp se o AVD for recriado): gerar plano com objetivo realista, ambicioso e irreal, e conferir os 3 vereditos com o tom certo; ver o gate da semana 9; ver o aviso de fim de trial.

Depois abra o PR de `feat/fase-8-viabilidade-trial` para `main`.

---

## Disciplina de tokens

- Não reimprima teste que passa — só falhas + resumo.
- Um commit por grupo.
- Só interrompa fora das paradas se: precisar expor um campo do motor (não invente), ou algo exigir mudar comportamento.

**O veredito de viabilidade é determinístico (vem do motor via serviço), a IA só floreia o texto. Nunca "impossível" — sempre jornada em etapas. Nunca recalcular treino. Trial no serviço, não na UI.**
