// Conteúdo da landing page. Edite aqui para mudar textos e links.
export const RELEASES_URL = "https://github.com/Tigasvrauuu/meus-addons-mcpe/releases";
export const REPO_URL = "https://github.com/Tigasvrauuu/meus-addons-mcpe";

export const FEATURES = [
  {
    icon: "🕸️",
    title: "Lança-teia e balanço",
    text: "Mire numa superfície a até 30 blocos, prenda a teia e balance com física controlada. Solte com um clique e mantenha o impulso.",
  },
  {
    icon: "🧗",
    title: "Escalada em paredes",
    text: "Agache e clique com o direito perto de uma parede. Olhe para cima ou para baixo para subir ou descer. Pule para soltar.",
  },
  {
    icon: "⚡",
    title: "Gadgets de combate",
    text: "Impact Web, Web Restraint e Tech Pulse. Cada um tem efeito, recarga e alvo próprios.",
  },
  {
    icon: "🕷️",
    title: "Spider-Sense",
    text: "Alertas de proximidade quando inimigos hostis se aproximam ou quando você leva dano. Pode ser desligado.",
  },
  {
    icon: "🎽",
    title: "Trajes e progressão",
    text: "Três trajes com bônus reais e desbloqueios por ação: balanços, escaladas e uso de gadgets.",
  },
  {
    icon: "🧭",
    title: "Spider Hub",
    text: "Um menu no item Spider Hub com trajes, gadgets, configurações, progresso e guia de controles.",
  },
];

export const STEPS = [
  { title: "Baixe o .mcaddon", text: "Pegue o arquivo na página de releases do GitHub." },
  { title: "Importe no Minecraft", text: "Abra o arquivo. O Bedrock importa os dois packs de uma vez." },
  { title: "Ative no mundo", text: "Ative o Behavior Pack e o Resource Pack nas configurações do mundo." },
  { title: "Pegue o kit", text: "Ao entrar, você recebe Web-Shooter, Gadget Launcher e Spider Hub." },
];

export const FAQ = [
  {
    q: "Funciona em qual versão?",
    a: "Foi feito para o Minecraft Bedrock Edition 26.52, usando os módulos de Script API 2.11.0 e server-ui 2.3.0 da mesma versão.",
  },
  {
    q: "Precisa ativar algum experimento?",
    a: "Não nos manifestos atuais. Se o jogo reclamar do módulo de script, verifique se é preciso ativar o Beta APIs.",
  },
  {
    q: "Funciona no celular e no console?",
    a: "Ainda não foi testado. As ações com agachar (escalada e soltar com agachamento) podem ser difíceis no toque. Soltar a teia com um novo clique e o Spider Hub funcionam como alternativas.",
  },
  {
    q: "Os trajes mudam a aparência?",
    a: "Não nesta versão. Os trajes mudam apenas bônus numéricos. Visuais personalizados ainda não existem.",
  },
];
