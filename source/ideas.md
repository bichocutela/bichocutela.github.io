# Direção de design — NRD Códigos PWA

## Três abordagens consideradas

### 1. Catálogo em Movimento
**Very Brief Intro:** Uma central de consulta rápida que combina a energia gráfica do Nordestão com uma estrutura operacional clara. A experiência é leve, legível e pensada para uso em balcão ou corredor de loja.

**Probability:** 0.07

### 2. Caderno de Mercearia
**Very Brief Intro:** Um visual editorial de listas, etiquetas e recortes, com referências discretas a cadernos de estoque. É acolhedor, calmo e prioriza leitura prolongada.

**Probability:** 0.04

### 3. Sinalização de Loja
**Very Brief Intro:** Uma interface inspirada em placas de setores, preços e orientação de supermercado. Tipografia ampla, cores funcionais e comandos diretos tornam a consulta quase instantânea.

**Probability:** 0.09

## Abordagem escolhida: Catálogo em Movimento

### Design Movement

**Wayfinding retail contemporâneo**: sistemas de orientação física de loja traduzidos para uma ferramenta móvel, com superfícies claras, cor de setor bem controlada e informação escaneável.

### Core Principles

1. **Consulta antes de decoração:** busca, código e categoria sempre ocupam a primeira camada visual.
2. **Cor como sinalização:** o verde Nordestão orienta ações; as cores dos temas entram como acento ou plano de fundo, nunca como ruído sobre o conteúdo.
3. **Leitura de balcão:** textos essenciais usam contraste alto, tamanhos confortáveis e blocos compactos para telas pequenas.
4. **Estado explícito:** cada fundo informa se está agendado, ativo, vencido ou substituído pelo padrão.

### Color Philosophy

O branco levemente aquecido preserva a sensação de limpeza de um catálogo. O verde institucional estabelece confiança e ação, enquanto os tons multicoloridos do Nordestão aparecem no hero e nos detalhes de categoria. Fundos personalizados recebem uma camada leitosa de proteção para que o catálogo permaneça legível, independentemente da imagem escolhida pelo Mestre.

### Layout Paradigm

Uma **faixa de orientação vertical**: hero/banner no alto, trilha de consulta logo abaixo e resultados em cartões sequenciais. Em telas grandes, busca e filtros se deslocam para uma coluna funcional curta, deixando a área de produtos respirar ao lado, sem uma composição centrada uniforme.

### Signature Elements

1. **Faixa de setor:** marcador colorido vertical no início de cartões e blocos de pesquisa.
2. **Painel translúcido de consulta:** busca e filtros pairam sobre o fundo com vidro claro e contraste garantido.
3. **Etiquetas de código:** códigos de produto aparecem em cápsulas retangulares discretas, inspiradas em etiquetas de gôndola.

### Interaction Philosophy

As interações devem ser utilitárias e previsíveis: abrir, filtrar, limpar e navegar têm retorno imediato. Alterar tema atualiza o acento e o fundo sem deslocar o conteúdo; imagens agendadas não exigem ação manual do usuário.

### Animation

Entradas curtas em cascata de 40–60 ms para resultados e filtros. Painéis e menu deslizam com `cubic-bezier(0.23, 1, 0.32, 1)` em até 220 ms. A troca de fundo faz crossfade de opacidade em 220 ms; movimentos ficam desativados para `prefers-reduced-motion`.

### Typography System

**Barlow Condensed** é usada em rótulos de setor, contagens e chamadas operacionais; **Source Sans 3** conduz busca, produtos e descrições. Títulos usam peso 700–800, nomes de produto usam 650–700 e texto auxiliar mantém 400–500. Não usar Inter.

### Brand Essence

**NRD Códigos é a consulta operacional de produtos do Nordestão para encontrar códigos e setores com rapidez, no balcão ou na loja.**

Personalidade: **ágil, confiável, próximo**.

### Brand Voice

Headlines são diretas e úteis; CTAs descrevem a ação; microcopy informa estado sem jargão técnico.

- “Encontre o produto sem perder tempo.”
- “Fundo programado. O padrão volta após o vencimento.”

### Wordmark & Logo

O símbolo existente do NRD Códigos permanece como marca principal. O wordmark combina a sigla condensada em verde com “Códigos” em Source Sans 3, separado por uma barra de setor curta.

### Signature Brand Color

**Verde Gôndola — `#23834A`**: o verde de ação aplicado a busca, foco, estados ativos e sinalização de navegação.
