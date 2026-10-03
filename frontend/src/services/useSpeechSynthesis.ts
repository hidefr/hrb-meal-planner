import { useCallback } from 'react';

export function useSpeechSynthesis() {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!isSupported || !text) {
      if (onEnd) onEnd();
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stop any previous speech
      const cleanText = text.replace(/[*#_~`]/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = navigator.language || 'en-US';

      if (onEnd) {
        utterance.onend = () => onEnd();
        utterance.onerror = () => onEnd();
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
      if (onEnd) onEnd();
    }
  }, [isSupported]);

  const stop = useCallback(() => {
    if (isSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }, [isSupported]);

  return { speak, stop, isSupported };
}
