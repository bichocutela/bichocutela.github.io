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
