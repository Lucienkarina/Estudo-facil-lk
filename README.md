# 📖 Estudo Fácil

Assistente de estudos por voz para uma estudante de História. PWA feito em HTML, CSS e JavaScript puro — sem backend, sem serviços pagos, funciona offline depois do primeiro acesso.

## O que o app faz

- **🎙️ Falar** — toque no microfone e fale naturalmente em português. O texto aparece em tempo real, já com capitalização de frases, correção leve de espaçamento/pontuação e quebras de parágrafo automáticas quando você faz uma pausa maior (sem precisar dizer "vírgula" ou "ponto"). O texto é totalmente editável depois.
- **📝 Novo** — começa um texto em branco (para digitar ou falar).
- **📚 Estudos** — técnicas rápidas de estudo e uma lista de temas de História; tocar em um tema já abre um texto novo pronto para falar sobre ele.
- **📂 Arquivos** — todos os textos salvos no aparelho, com busca, abrir, exportar e excluir.
- **📤 Enviar** — escolhe um texto salvo e compartilha pelo menu nativo do iPhone (Mensagens, E-mail, AirDrop, Arquivos, WhatsApp etc.).
- **Exportação** — Word (.docx), PDF e .txt, gerados inteiramente no navegador.
- **Armazenamento local** — os textos ficam no IndexedDB do próprio navegador/iPhone (nada é enviado para nenhum servidor).

## Publicar no GitHub Pages

1. Crie um repositório novo no GitHub (ex.: `estudo-facil`).
2. Envie **todos os arquivos desta pasta** para a raiz do repositório (mantendo a estrutura de pastas `css/`, `js/`, `icons/`).
3. No GitHub, vá em **Settings → Pages**.
4. Em "Build and deployment", escolha **Deploy from a branch**, selecione a branch `main` e a pasta `/ (root)`.
5. Salve. Em alguns minutos o app estará em `https://SEU-USUARIO.github.io/estudo-facil/`.
6. Abra esse link no Safari do iPhone.

## Instalar no iPhone (virar app de verdade)

1. Abra o link do app no **Safari** (precisa ser o Safari, não outro navegador).
2. Toque no ícone de **compartilhar** (o quadrado com a seta para cima).
3. Toque em **"Adicionar à Tela de Início"**.
4. Pronto — o ícone aparece na tela como um app normal, abrindo em tela cheia, com ícone e nome próprios.

## Sobre o reconhecimento de voz

O app usa o reconhecimento de fala nativo do Safari/iOS (`webkitSpeechRecognition`), que roda localmente/via Apple, sem custo e sem backend próprio. Alguns pontos importantes:

- É necessário permitir o uso do **microfone** quando o Safari perguntar.
- Em iPhones/Safaris mais antigos o reconhecimento por voz pode não estar disponível ou ser menos preciso — nesse caso, o texto ainda pode ser digitado normalmente.
- A pontuação automática é uma aproximação por pausas de fala (heurística), não é perfeita — por isso o texto é sempre editável.

### Preparado para evoluir para transcrição por IA

O arquivo `js/speech.js` foi organizado com uma **interface única de "provedor de transcrição"**, hoje implementada pelo reconhecimento nativo (`NativeSpeechProvider`). Existe também um `CloudSpeechProvider` (stub) pronto para receber, no futuro, um serviço de transcrição por IA (ex. Whisper, Deepgram, Google Speech-to-Text), caso o reconhecimento nativo do Safari não seja suficiente.

Para ativar futuramente:

1. Implemente o envio de áudio (`MediaRecorder`/`getUserMedia`) para o seu serviço de transcrição dentro de `CloudSpeechProvider` em `js/speech.js`.
2. Troque `EstudoFacilConfig.transcription.provider` de `"native"` para `"cloud"` no topo do mesmo arquivo.
3. **Nunca** coloque chaves de API diretamente no código publicado no GitHub Pages (é um site público). Use um endpoint/proxy próprio que guarde a chave no servidor.

Nenhuma outra parte do app precisa mudar — `app.js` só conhece `start()`, `stop()` e os callbacks (`onInterim`, `onFinalChunk`, `onStatus`, `onError`).

## Estrutura de arquivos

```
estudo-facil/
├── index.html
├── manifest.json
├── service-worker.js
├── css/
│   └── style.css
├── js/
│   ├── db.js            → armazenamento local (IndexedDB)
│   ├── textCleanup.js   → normalização do texto falado
│   ├── speech.js         → fala → texto (nativo + preparado para IA)
│   ├── export.js         → exportar .docx / .pdf / .txt / compartilhar
│   └── app.js             → controlador da interface
└── icons/
    └── ícones do app (vários tamanhos)
```

## Bibliotecas usadas (via CDN, gratuitas)

- [html-docx-js](https://github.com/evidenceprime/html-docx-js) — gera arquivos .docx no navegador.
- [jsPDF](https://github.com/parallax/jsPDF) — gera arquivos .pdf no navegador.

Ambas são carregadas por CDN e ficam em cache pelo service worker após o primeiro uso, para funcionar offline depois.

## Limitações conhecidas

- O reconhecimento de voz do Safari exige conexão com a internet na maioria das versões do iOS (o processamento de áudio acontece nos servidores da Apple); o restante do app (editar, salvar, exportar, ver arquivos) funciona 100% offline.
- O compartilhamento de arquivos pelo menu nativo (`navigator.share` com arquivos) requer iOS 15+ no Safari.
