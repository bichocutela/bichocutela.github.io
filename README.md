# NRD Códigos — PWA

Este repositório mantém o PWA publicado em [bichocutela.github.io](https://bichocutela.github.io/) e sua **fonte editável**. O Android `NRDLOJAS-v2` continua sendo a referência funcional para o catálogo compartilhado, categorias e configurações de aparência remotas.

## Estrutura

| Caminho | Finalidade |
| --- | --- |
| `/` | Build estático que o GitHub Pages publica no endereço atual. |
| `/source` | Fonte React/Vite editável, dependências, documentação de design e inventário funcional. |
| `/manus-storage` | Recursos estáticos já usados pela versão publicada. |
| `/firebase-messaging-sw.js` | Worker de notificações da versão publicada. |

## Desenvolvimento da fonte

No diretório `source`, instale as dependências com `pnpm install`, execute o ambiente local com `pnpm run dev` e valide tipos com `pnpm run check`. O comando `pnpm run build` gera o build estático. Antes de copiar esse build para a raiz e publicar, é obrigatório validar a interface, a consulta ao catálogo e os fluxos reais.

## Publicação

O endereço público permanece `https://bichocutela.github.io/`. A raiz só deve ser atualizada por um build validado; manter a fonte em `/source` permite evoluir o PWA sem editar arquivos minificados nem perder o projeto novamente.

## Regra de equivalência

O PWA preserva dados do catálogo no Firestore e prefere configurações remotas já usadas pelo Android. Preferências estritamente pessoais — como favoritos, histórico, tamanho de texto e permissões do navegador — ficam locais neste dispositivo. Fundos personalizados obedecem ao mesmo contrato do Android: início e fim opcionais, período inclusivo e retorno automático ao fundo padrão fora da janela programada.

## Promoções e lojas — equivalência com Android

- Promoções usa `nrd-promotion-control` e `nrd-price-gateway`: Cidade Jardim (0012) lê o mesmo snapshot ACP, demais filiais leem as páginas imutáveis da revisão publicada pelo Mestre. Não utiliza o Nossa Gente.
- Tipos De/Por, Leve e pague e Clube; categorias, busca, validade em America/Fortaleza e ordenação inicial por Maior desconto. Uma falha de filial preserva a consulta anterior ainda vigente e sinaliza o erro. Desabilitar uma loja remove suas ofertas.
- Atualização ao abrir, a cada minuto em primeiro plano e ao voltar à página. Documentos são relidos apenas quando muda a revisão.
- Nossas Lojas usa os serviços oficiais `nrd-stores` e `nrd-store-offers`, incluindo a redundância pública/autenticada já configurada no servidor. A preferida, filtros, mapa, contatos e condições ficam disponíveis no navegador. A localização depende da permissão do navegador.
- Painel Mestre → Logins compartilha o mesmo cofre e teste de acessos do Android. Somente a identidade Mestre verificada pode listar, testar e salvar. Credenciais nunca são devolvidas ao navegador.
- Imagens recebidas do catálogo e das ofertas oficiais são usadas por código do produto; falhas tentam as alternativas oficiais. Imagem desconhecida permanece indisponível, sem associação por aproximação.
- Acesso restrito usa a conta NRD/Firebase e a mesma sessão por dispositivo do Android. As permissões do Mestre continuam sendo verificadas no servidor. Preferências pessoais permanecem locais.

Validação: `pnpm check`, `pnpm exec vitest run`, `pnpm exec vite build`. Testes cobrem sincronização ACP por revisão, publicação completa, falha isolada por loja, loja desabilitada, datas e ordenação.

## Encartes, avisos e conteúdo publicado

- Encartes consulta a mesma fonte `nrd-encartes` do Android e mantém apenas edições vigentes de Natal e região. O leitor tem páginas, zoom e gestos; a rota de PDF aceita somente IDs ativos do catálogo oficial, pois o servidor original não libera CORS.
- Configurações e sinos de Encartes/Treinamento salvam as preferências deste navegador. Há inscrição FCM confirmada no servidor, filtros antes do histórico, deduplicação e links que abrem o conteúdo correspondente. Encartes oferece Desativadas, Simples e Detalhadas. Treinamentos de teste não são anunciados ao público.
- Recebimento em segundo plano exige permissão de notificações; no iOS, exige instalação na Tela de Início e suporte do sistema. Os testes automatizados não enviam avisos a usuários reais.
- Treinamento lê a configuração publicada no Firestore e respeita OFF/TEST/ALL e a identidade Mestre. Aprender inclui atendimento simulado, visor do cliente ampliável e teclado remoto; Prova e Caixa Livre usam as missões publicadas. Dados de prática não são enviados a serviços de CPF, pagamento ou SMS.
- Páginas/Cursos leem `dynamic_tabs`, com os mesmos blocos, ordem, habilitação e período do Android. O PWA não oferece os editores nativos desses módulos.
- Fotos oficiais recebidas continuam prioritárias. Quando faltam, `nrd-product-image` busca uma associação verificada por código/EAN/descrição no catálogo oficial, em segundo plano e com fila limitada. Sem correspondência, não inventa uma imagem.

Validação desta etapa: 30 testes do PWA, tipos e build; 118 testes dos serviços envolvidos. No navegador publicado foram conferidos os quatro encartes vigentes, abertura de um PDF com dez páginas, navegação/zoom, modos do sino, missões remotas, teclado simulado e visor ampliável. Entrega real de push não foi disparada em produção. Essa etapa não afirma equivalência de todas as rotinas privadas e telas administrativas nativas.
