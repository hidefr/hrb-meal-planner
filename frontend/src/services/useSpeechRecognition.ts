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

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
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
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interimTranscript += item[0].transcript;
          }
        }

        const base = baseTextRef.current;
        const currentSpeech = (finalTranscript || interimTranscript).trim();

        if (currentSpeech) {
          let separator = '';
          if (base && !base.endsWith(' ') && !base.endsWith('\n')) {
            separator = ' ';
          }
          onTranscriptChange(base + separator + currentSpeech);
        }

        if (finalTranscript) {
          let separator = '';
          if (base && !base.endsWith(' ') && !base.endsWith('\n')) {
            separator = ' ';
          }
          baseTextRef.current = (base + separator + finalTranscript.trim()).trim();
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
          alert("Microphone permission was denied. Please allow microphone access in your browser settings.");
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
