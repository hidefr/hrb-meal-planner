import { useCallback, useRef } from 'react';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

export function useSpeechSynthesis() {
  const isNative = Capacitor.isNativePlatform();
  const isSpeakingRef = useRef(false);
  const isPausedRef = useRef(false);
  const playbackTokenRef = useRef(0);
  const progressTimerRef = useRef<any>(null);

  /**
   * Instantly stops and silences all speech.
   */
  const stop = useCallback(async () => {
    isSpeakingRef.current = false;
    isPausedRef.current = false;
    playbackTokenRef.current++;

    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    // 1. Stop Web Speech Synthesis immediately
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    // 2. Stop Native Android TextToSpeech immediately
    if (isNative) {
      try {
        await TextToSpeech.stop();
      } catch {}
    }
  }, [isNative]);

  /**
   * Instantly pauses and silences all speech.
   */
  const pause = useCallback(async () => {
    isSpeakingRef.current = false;
    isPausedRef.current = true;
    playbackTokenRef.current++;

    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    // 1. Cancel Web Speech Synthesis immediately
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    // 2. Stop Native Android TTS immediately
    if (isNative) {
      try {
        await TextToSpeech.stop();
      } catch {}
    }
  }, [isNative]);

  /**
   * Resumes speech (caller re-triggers reading the current step if paused).
   */
  const resume = useCallback(() => {
    isPausedRef.current = false;
    return false; // Tells caller to smoothly re-read the step
  }, []);

  /**
   * Instant, zero-lag on-device speech synthesis:
   * - Uses Android's high-performance native Google TTS on Android devices.
   * - Uses Chrome/browser native SpeechSynthesis on web.
   * - Starts in 0ms with zero network requests and zero buffering delay.
   * - Throttles word progress updates to actual words (~3 updates/sec instead of 60fps),
   *   preventing React re-render thrashing and eliminating audio stutter.
   */
  const speak = useCallback(async (
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    _voiceId: string = 'en-US-AvaNeural',
    speed: number = 1.15,
    onProgress?: (progress: number) => void
  ) => {
    if (!text) {
      if (onEnd) onEnd();
      return;
    }

    await stop();

    const cleanText = text.replace(/[*#_~`]/g, '').trim();
    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    isSpeakingRef.current = true;
    isPausedRef.current = false;
    const playbackToken = ++playbackTokenRef.current;

    if (onStart) onStart();

    const words = cleanText.split(/\s+/).filter(Boolean);
    const wordCount = Math.max(1, words.length);

    // Setup lightweight word tracking (estimated ~2.8 words/second at 1.15x speed)
    // Updates at most once per word (e.g. every 300-400ms), NOT 60 times a second!
    const msPerWord = Math.max(220, Math.round(350 / speed));
    let currentWordIdx = 0;

    const startWordTracking = () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (!onProgress) return;

      currentWordIdx = 0;
      onProgress(0);

      progressTimerRef.current = setInterval(() => {
        if (!isSpeakingRef.current || isPausedRef.current || playbackTokenRef.current !== playbackToken) {
          if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
          }
          return;
        }

        currentWordIdx++;
        if (currentWordIdx < wordCount) {
          const ratio = Math.min(0.95, currentWordIdx / wordCount);
          onProgress(ratio);
        } else {
          if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
          }
        }
      }, msPerWord);
    };

    const handleFinished = () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      isSpeakingRef.current = false;
      if (playbackTokenRef.current === playbackToken && !isPausedRef.current) {
        if (onProgress) onProgress(1.0);
        if (onEnd) onEnd();
      }
    };

    // 🌟 1. On Native Android App: Use Android Native TextToSpeech plugin (Instant, zero lag, zero buffering)
    if (isNative) {
      try {
        startWordTracking();
        await TextToSpeech.speak({
          text: cleanText,
          lang: 'en-US',
          rate: speed,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient',
        });
        handleFinished();
        return;
      } catch (err) {
        console.warn("Capacitor Native TextToSpeech error, falling back to Web:", err);
      }
    }

    // 🌟 2. On Web Browser: Use Web SpeechSynthesis (Instant, zero network requests)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = speed;
        utterance.pitch = 1.0;
        utterance.lang = 'en-US';

        // Select the best natural-sounding voice if available
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const naturalVoice =
            voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Jenny') || v.name.includes('Ava') || v.name.includes('Samantha'))) ||
            voices.find(v => v.lang.startsWith('en')) ||
            null;
          if (naturalVoice) {
            utterance.voice = naturalVoice;
          }
        }

        // Use native word boundary if supported for pinpoint word accuracy
        utterance.onboundary = (e) => {
          if (isPausedRef.current || !isSpeakingRef.current || playbackTokenRef.current !== playbackToken) {
            try { window.speechSynthesis.cancel(); } catch {}
            return;
          }
          if (e.name === 'word' && onProgress) {
            const charIndex = e.charIndex || 0;
            const ratio = Math.min(0.98, charIndex / Math.max(1, cleanText.length));
            onProgress(ratio);
          }
        };

        // Fallback interval tracking if onboundary doesn't fire
        startWordTracking();

        utterance.onstart = () => {
          if (isPausedRef.current || !isSpeakingRef.current || playbackTokenRef.current !== playbackToken) {
            try { window.speechSynthesis.cancel(); } catch {}
          }
        };

        utterance.onend = () => {
          handleFinished();
        };

        utterance.onerror = (e) => {
          console.warn("SpeechSynthesis error:", e);
          handleFinished();
        };

        window.speechSynthesis.speak(utterance);
        return;
      } catch (e) {
        console.warn("Web SpeechSynthesis failed:", e);
      }
    }

    handleFinished();
  }, [stop, isNative]);

  return { speak, stop, pause, resume, isSupported: true, isSpeakingRef, isPausedRef };
}
