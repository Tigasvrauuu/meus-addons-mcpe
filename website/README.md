# Landing page React

Landing page responsiva em português para o add-on. React 19, Vite e Lucide; arte vetorial original criada em SVG. Não usa imagens de jogos comerciais nem serviços externos de fontes.

## Desenvolvimento

```sh
# Na raiz, atualize o pacote distribuído pelo site:
npm ci
npm run build
cp dist/Spider-Man-Definitive-Experience-1.0.0.mcaddon website/public/
npm ci --prefix website
npm run dev --prefix website
```

O servidor aceita o host do preview Arena e escuta em `0.0.0.0`. Build: `npm run build --prefix website`. O `base: './'` permite hospedar no subdiretório do repositório no Pages.

## Publicação

`.github/workflows/pages.yml` gera o add-on, testa e compila a página e publica via GitHub Pages. Nas configurações do repositório, Pages deve usar **GitHub Actions** como source. O sucesso depende das permissões e da situação de cobrança do GitHub. Um link do Pages só é considerado publicado depois de um deploy bem-sucedido.

## Conteúdo e interações

Navegação por âncoras, menu móvel, seis trajes selecionáveis e controles anterior/próximo, FAQ expansível, cópia do comando de recuperação e download real do `.mcaddon`. Links de documentação apontam à branch de trabalho. O site não alega validação dentro do Minecraft; as imagens são ilustrações, não screenshots.
