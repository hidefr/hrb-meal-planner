import { useState, useRef, useEffect, useCallback } from 'react';

interface UseSpeechRecognitionOptions {
  onTranscriptChange: (text: string) => void;
  getCurrentText: () => string;
}

export function useSpeechRecognition({ onTranscriptChange, getCurrentText }: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef('');

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(async () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    // Step 1: On Android Chrome, SpeechRecognition fails silently with 'not-allowed'
    // unless explicit microphone permission was already requested and granted via getUserMedia!
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Release hardware track immediately so SpeechRecognition can bind to it
        stream.getTracks().forEach(track => track.stop());
      } catch (err: any) {
        console.warn("Microphone access prompt error:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          alert("Microphone permission was not allowed. In Chrome, tap the tune/lock icon next to the URL bar and enable Microphone for this site.");
          return;
        }
      }
    }

    // Set base text to whatever is currently in the text box so we NEVER override existing text
    const current = getCurrentText();
    baseTextRef.current = current;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentFinal = '';
        let currentInterim = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            currentFinal += item[0].transcript;
          } else {
            currentInterim += item[0].transcript;
          }
        }

        const chunk = (currentFinal || currentInterim).trim();
        if (chunk) {
          const base = baseTextRef.current;
          let separator = '';
          if (base && !base.endsWith(' ') && !base.endsWith('\n')) {
            separator = ' ';
          }
          onTranscriptChange(base + separator + chunk);
        }

        if (currentFinal) {
          const base = baseTextRef.current;
          let separator = '';
          if (base && !base.endsWith(' ') && !base.endsWith('\n')) {
            separator = ' ';
          }
          baseTextRef.current = (base + separator + currentFinal.trim()).trim();
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
          alert("Microphone permission was denied. Tap the settings/lock icon in Chrome's address bar next to the URL to verify Microphone is set to Allow.");
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
    }
  }, [getCurrentText, onTranscriptChange]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
    toggleListening
  };
}
