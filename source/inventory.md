# Inventário funcional inicial — NRD Códigos

## Referência pública atual

O site publicado em `https://bichocutela.github.io/` foi inspecionado em 28/08/2026. Ele apresenta uma Home operacional com banner do Supermercado Nordestão, marca NRD Códigos, busca por nome ou código, acionadores de scanner e voz, categorias, total de itens, lista de adições recentes, notificações e menu lateral.

O menu lateral expõe Início, as categorias Açougue, Cafeteria, Frios, Hortifruti, Mercearia e Padaria, além de Acesso administrativo, Configurações e instruções de instalação em iPhone e Android. Esta estrutura será tomada como referência visual e de navegação, sem copiar arquivos minificados ou controles sem integração real.

As configurações públicas atuais controlam modo de aparência, tema, tamanho de letras, tamanho de código e tamanho de título; também oferecem vibração, permissões e preferências de avisos de catálogo, ajuda e envio de feedback. Na reconstrução, esses controles permanecerão quando houver API do navegador ou persistência local/real correspondente.

## Fonte de verdade Android

O Android inicia em busca e tem destinos reais para busca, abas dinâmicas, assistente, painel administrativo, Painel Mestre, gerenciamento de abas, gerenciamento de produtos, promoções, configurações e sobre. A navegação lateral também contém categorias e acesso administrativo. As telas identificadas são `SearchScreen`, `AssistantScreen`, `AdminScreen`, `MestreScreen`, `ManageProductsScreen`, `ManageTabsScreen`, `DynamicTabScreen`, `PromotionsScreen`, `SettingsScreen` e `AboutScreen`.

Os contratos remotos já confirmados são Firestore: `products`, `latest_product/latest`, `dynamic_tabs`, `suggestions`, `catalog_history` e `config/appSettings`. Este último armazena banner, configurações de Home, categorias, aparência, fundos personalizados, notificações e Assistente IA. Os fundos são listas por tema e usam `id`, `label`, `url`, `isActive`, `startDate` e `endDate`; o intervalo é inclusivo e, fora dele, deve voltar ao fundo padrão nativo do tema.

O bundle estático atual já contém referências a Firestore e `products`, mas suas preferências de tema, favoritos, histórico, feedback, notificações e sessão estão identificadas como armazenamento local do navegador. Ele não contém os campos `appearanceThemeBackgrounds`, `startDate` ou `endDate`. A reconstrução deve preservar o que é apropriadamente local e adicionar leitura remota de aparência somente pelo contrato que o Android já usa.

O PWA também possui um worker de notificações em segundo plano que conserva preferências e histórico localmente, filtra avisos de produto adicionado e código alterado e abre a busca do produto ao tocar em uma notificação. A nova fonte manterá esse comportamento com configurações carregadas no processo de build, sem registrar valores de configuração remota em documentação ou arquivos de exemplo.

O Painel Mestre Android concentra: tratamento de sugestões; diagnóstico e sincronização de catálogo; snapshots e restauração; publicação de seções da Home; criação, edição, ativação e ordenação de categorias; políticas globais de notificação; parâmetros do Assistente IA; e aparência global. A aparência inclui tema, modo, banner e até cinco fundos por tema, com URL remota, ativação manual e agenda opcional de início/fim. Os fluxos que alteram dados só deverão aparecer no PWA quando estiverem vinculados às permissões e operações remotas correspondentes.

## Diretriz de reconstrução

A fonte editável será mantida no repositório `bichocutela/bichocutela.github.io`, separando claramente código-fonte, arquivos de configuração e build publicado. O projeto de trabalho Manus permanece como ambiente de desenvolvimento e validação; somente um build validado substituirá o conteúdo publicado no endereço atual.
