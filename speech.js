/* =========================================================
   speech.js — reconhecimento de fala (fala → texto)
   ---------------------------------------------------------
   Hoje: usa o reconhecimento nativo do Safari/iOS
   (webkitSpeechRecognition), 100% local ao dispositivo/
   navegador, sem backend e sem custo.

   Amanhã: se o reconhecimento nativo não for suficiente
   (ex.: em iPhones/Safaris mais antigos, ou para maior
   precisão), basta implementar um novo "provider" que
   envie o áudio para um serviço de transcrição por IA
   (ex.: Whisper da OpenAI, Deepgram, Google Speech-to-Text)
   e trocar EstudoFacilConfig.transcription.provider para
   "cloud". Nenhuma outra parte do app precisa mudar — o
   app.js só conhece a interface comum abaixo:

     provider.isSupported()
     provider.start()
     provider.stop()
     callbacks.onInterim(textoParcial)
     callbacks.onFinalChunk(textoFinal, pausaMs)
     callbacks.onStatus(estado)   // 'ouvindo' | 'parado' | 'processando' | 'erro'
     callbacks.onError(mensagem)
   ========================================================= */
(function (global) {
  "use strict";

  // ---- Configuração central (troque aqui no futuro) ----
  const EstudoFacilConfig = {
    transcription: {
      // 'native' (Safari/Chrome) ou 'cloud' (a implementar)
      provider: "native",
      cloud: {
        // Preencha quando integrar um serviço de IA de transcrição.
        // NUNCA coloque chaves de API diretamente no código do
        // GitHub Pages (é público). Use um endpoint próprio (proxy)
        // que guarde a chave no servidor, ou um serviço que aceite
        // chamadas autenticadas por usuário.
        endpoint: null, // ex.: "https://meu-proxy.workers.dev/transcrever"
        apiKey: null,
      },
    },
  };
  global.EstudoFacilConfig = EstudoFacilConfig;

  // ---------------------------------------------------------
  // Provider nativo (Safari / Chrome Web Speech API)
  // ---------------------------------------------------------
  function NativeSpeechProvider(callbacks) {
    const SR = global.SpeechRecognition || global.webkitSpeechRecognition;
    let recognition = null;
    let ouvindoAtivo = false; // intenção do usuário (para auto-restart)
    let ultimoTimestamp = Date.now();

    this.isSupported = function () {
      return !!SR;
    };

    this.start = function () {
      if (!SR) {
        callbacks.onError("O reconhecimento de voz não está disponível neste navegador.");
        return;
      }
      ouvindoAtivo = true;
      ultimoTimestamp = Date.now();
      iniciarInstancia();
    };

    this.stop = function () {
      ouvindoAtivo = false;
      if (recognition) {
        try { recognition.stop(); } catch (e) { /* noop */ }
      }
      callbacks.onStatus("parado");
    };

    function iniciarInstancia() {
      recognition = new SR();
      recognition.lang = "pt-BR";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = function () {
        callbacks.onStatus("ouvindo");
      };

      recognition.onresult = function (event) {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const resultado = event.results[i];
          const texto = resultado[0].transcript;
          if (resultado.isFinal) {
            const agora = Date.now();
            const pausaMs = agora - ultimoTimestamp;
            ultimoTimestamp = agora;
            callbacks.onFinalChunk(texto, pausaMs);
          } else {
            interim += texto;
          }
        }
        if (interim) callbacks.onInterim(interim);
      };

      recognition.onerror = function (event) {
        const erro = event.error;
        if (erro === "no-speech") {
          // silêncio: apenas reinicia silenciosamente se ainda ativo
          return;
        }
        if (erro === "not-allowed" || erro === "service-not-allowed") {
          ouvindoAtivo = false;
          callbacks.onError("Permita o uso do microfone nas Configurações do Safari para usar o ditado.");
          callbacks.onStatus("erro");
          return;
        }
        if (erro === "network") {
          callbacks.onError("Sem conexão para o reconhecimento de voz. Tente novamente.");
          callbacks.onStatus("erro");
          return;
        }
        callbacks.onError("Não foi possível reconhecer a fala agora. Tente novamente.");
        callbacks.onStatus("erro");
      };

      recognition.onend = function () {
        // Safari/Chrome encerram a sessão após alguns segundos de
        // silêncio ou automaticamente; se o usuário ainda quer
        // ditar, reinicia de forma transparente.
        if (ouvindoAtivo) {
          try { iniciarInstancia(); } catch (e) { callbacks.onStatus("parado"); }
        } else {
          callbacks.onStatus("parado");
        }
      };

      try {
        recognition.start();
      } catch (e) {
        // start() pode lançar se chamado rápido demais em sequência
        setTimeout(() => { if (ouvindoAtivo) { try { recognition.start(); } catch (e2) {} } }, 250);
      }
    }
  }

  // ---------------------------------------------------------
  // Provider em nuvem (stub / preparado para o futuro)
  // ---------------------------------------------------------
  function CloudSpeechProvider(callbacks) {
    this.isSupported = function () {
      return !!(EstudoFacilConfig.transcription.cloud && EstudoFacilConfig.transcription.cloud.endpoint);
    };
    this.start = function () {
      callbacks.onError(
        "A transcrição por IA em nuvem ainda não foi configurada. Defina EstudoFacilConfig.transcription.cloud.endpoint em js/speech.js."
      );
      callbacks.onStatus("erro");
    };
    this.stop = function () {
      callbacks.onStatus("parado");
    };
    // Ponto de extensão sugerido para quando for implementar:
    // 1) capturar áudio com MediaRecorder (getUserMedia)
    // 2) enviar blobs/streaming para EstudoFacilConfig.transcription.cloud.endpoint
    // 3) receber texto transcrito e chamar callbacks.onFinalChunk(texto, pausaMs)
  }

  function getTranscriptionProvider(callbacks) {
    const escolhido = EstudoFacilConfig.transcription.provider;
    if (escolhido === "cloud") return new CloudSpeechProvider(callbacks);
    return new NativeSpeechProvider(callbacks);
  }

  global.EstudoFacilSpeech = { getTranscriptionProvider };
})(window);
