import { useCallback, useRef } from 'react';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

// In-memory audio object URL cache to make speech playback INSTANT (0ms network delay)
const _AUDIO_CACHE = new Map<string, string>();
const _PREFETCH_IN_FLIGHT = new Set<string>();

function getCacheKey(text: string, voiceId: string, rateParam: string): string {
  return `${voiceId}__${rateParam}__${text}`;
}

export function useSpeechSynthesis() {
  const isNative = Capacitor.isNativePlatform();
  const isSpeakingRef = useRef(false);
  const isPausedRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackTokenRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  /**
   * Pre-fetch audio blobs in the background so step navigation & reading has ZERO lag.
   */
  const prefetch = useCallback((texts: string[], voiceId: string = 'en-US-AvaNeural', speed: number = 1.15) => {
    if (typeof window === 'undefined') return;
    const speedPct = Math.round((speed - 1.0) * 100);
    const rateParam = speedPct >= 0 ? `+${speedPct}%` : `${speedPct}%`;

    texts.forEach(async (t) => {
      if (!t) return;
      const clean = (typeof t === 'string' ? t : (t as any).text || String(t)).replace(/[*#_~`]/g, '').trim();
      if (!clean) return;
      const key = getCacheKey(clean, voiceId, rateParam);
      if (_AUDIO_CACHE.has(key) || _PREFETCH_IN_FLIGHT.has(key)) return;

      _PREFETCH_IN_FLIGHT.add(key);
      try {
        const audioUrl = `/api/voice/tts?voice=${encodeURIComponent(voiceId)}&text=${encodeURIComponent(clean)}&rate=${encodeURIComponent(rateParam)}`;
        const res = await fetch(audioUrl);
        if (res.ok) {
          const blob = await res.blob();
          const objUrl = URL.createObjectURL(blob);
          _AUDIO_CACHE.set(key, objUrl);
        }
      } catch (err) {
        // Silently ignore background prefetch errors; fallback will handle when speaking
      } finally {
        _PREFETCH_IN_FLIGHT.delete(key);
      }
    });
  }, []);

  /**
   * Immediately halts and silences all audio playback across HTML5 Audio, Web SpeechSynthesis, and Native Android TTS.
   */
  const stop = useCallback(async () => {
    isSpeakingRef.current = false;
    isPausedRef.current = false;
    playbackTokenRef.current++; // Invalidate any ongoing TTS network requests immediately!

    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // 1. Stop and purge HTML5 Audio stream
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.src = '';
        currentAudioRef.current.load();
      } catch {}
      currentAudioRef.current = null;
    }

    // 2. Stop Web Speech Synthesis immediately
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    // 3. Stop Native Android TTS
    if (isNative) {
      try {
        await TextToSpeech.stop();
      } catch {}
    }
  }, [isNative]);

  /**
   * Instantly pauses and silences all audio playback.
   */
  const pause = useCallback(async () => {
    isSpeakingRef.current = false;
    isPausedRef.current = true;
    playbackTokenRef.current++; // Invalidate any in-flight fetches or decodes immediately!

    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // 1. Immediately pause HTML5 Audio element
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
      } catch {}
    }

    // 2. Immediately cancel Web Speech Synthesis (Chromium .pause() is broken, .cancel() guarantees immediate silence)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    // 3. Immediately stop Native Android TTS
    if (isNative) {
      try {
        await TextToSpeech.stop();
      } catch {}
    }
  }, [isNative]);

  /**
   * Resumes audio playback if HTML5 audio is paused and not completed.
   * Returns true if resumed, false if playback needs to be re-initiated from caller.
   */
  const resume = useCallback(() => {
    isPausedRef.current = false;
    if (
      currentAudioRef.current &&
      currentAudioRef.current.paused &&
      currentAudioRef.current.currentTime < (currentAudioRef.current.duration || Infinity)
    ) {
      try {
        isSpeakingRef.current = true;
        currentAudioRef.current.play();
        return true;
      } catch {}
    }
    return false;
  }, []);

  /**
   * Fast on-device fallback TTS (Web SpeechSynthesis or Capacitor Native TextToSpeech).
   */
  const fallbackSpeak = useCallback(async (
    cleanText: string,
    onDone: () => void,
    speed: number = 1.0,
    onProgress?: (progress: number) => void
  ) => {
    // 1. Try Web Speech Synthesis first
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = speed;
        utterance.pitch = 1.0;
        utterance.lang = 'en-US';

        utterance.onboundary = (e) => {
          if (isPausedRef.current || !isSpeakingRef.current) {
            try { window.speechSynthesis.cancel(); } catch {}
            return;
          }
          if (e.name === 'word' && onProgress) {
            const charIndex = e.charIndex || 0;
            const ratio = Math.min(1.0, charIndex / Math.max(1, cleanText.length));
            onProgress(ratio);
          }
        };

        utterance.onstart = () => {
          if (isPausedRef.current || !isSpeakingRef.current) {
            try { window.speechSynthesis.cancel(); } catch {}
          }
        };

        utterance.onend = () => onDone();
        utterance.onerror = () => onDone();

        if (!isPausedRef.current && isSpeakingRef.current) {
          window.speechSynthesis.speak(utterance);
          return;
        }
      } catch (e) {
        console.warn("Web speech synthesis fallback error:", e);
      }
    }

    // 2. Native Capacitor Android TextToSpeech
    if (isNative) {
      try {
        if (!isPausedRef.current && isSpeakingRef.current) {
          await TextToSpeech.speak({
            text: cleanText,
            lang: 'en-US',
            rate: speed,
            pitch: 1.0,
            volume: 1.0,
            category: 'ambient',
          });
        }
        onDone();
        return;
      } catch (e) {
        console.warn("Capacitor Native TextToSpeech error:", e);
      }
    }

    onDone();
  }, [isNative]);

  /**
   * Main speech playback function:
   * 1. Checks in-memory cache for INSTANT 0ms playback.
   * 2. If not cached, fetches with a 400ms timeout guard; if network takes longer than 400ms,
   *    switches immediately to on-device TTS so the cook is NEVER stuck waiting in silence.
   * 3. Bulletproof pause/stop tracking: if user paused while loading, audio NEVER plays.
   */
  const speak = useCallback(async (
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    voiceId: string = 'en-US-AvaNeural',
    speed: number = 1.15, // Default ~15% faster for snappy natural pacing
    onProgress?: (progress: number) => void // 0.0 to 1.0 progress for word highlighting
  ) => {
    if (!text) {
      if (onEnd) onEnd();
      return;
    }

    await stop(); // Stop any currently playing audio first

    const cleanText = text.replace(/[*#_~`]/g, '').trim();
    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    isSpeakingRef.current = true;
    isPausedRef.current = false;
    if (onStart) onStart();

    const playbackToken = ++playbackTokenRef.current;

    const handleFinished = () => {
      isSpeakingRef.current = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      currentAudioRef.current = null;
      if (onProgress) onProgress(1.0);
      if (onEnd) onEnd();
    };

    const speedPct = Math.round((speed - 1.0) * 100);
    const rateParam = speedPct >= 0 ? `+${speedPct}%` : `${speedPct}%`;
    const cacheKey = getCacheKey(cleanText, voiceId, rateParam);

    const playAudioStream = async (objectUrl: string) => {
      if (playbackTokenRef.current !== playbackToken || isPausedRef.current || !isSpeakingRef.current) {
        return;
      }

      const audio = new Audio(objectUrl);
      currentAudioRef.current = audio;

      const trackProgress = () => {
        if (!isSpeakingRef.current || isPausedRef.current || playbackTokenRef.current !== playbackToken) return;
        if (audio && !audio.paused && audio.duration && isFinite(audio.duration)) {
          const ratio = Math.min(1.0, audio.currentTime / audio.duration);
          if (onProgress) onProgress(ratio);
          animFrameRef.current = requestAnimationFrame(trackProgress);
        }
      };

      audio.onplay = () => {
        if (playbackTokenRef.current !== playbackToken || isPausedRef.current || !isSpeakingRef.current) {
          try { audio.pause(); } catch {}
          return;
        }
        isSpeakingRef.current = true;
        animFrameRef.current = requestAnimationFrame(trackProgress);
      };

      audio.onpause = () => {
        if (animFrameRef.current !== null) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
      };

      audio.ontimeupdate = () => {
        if (audio.duration && onProgress && !audio.paused && isFinite(audio.duration)) {
          const ratio = Math.min(1.0, audio.currentTime / audio.duration);
          onProgress(ratio);
        }
      };

      audio.onended = () => {
        handleFinished();
      };

      audio.onerror = (e) => {
        console.warn("Neural audio playback error, falling back to local TTS:", e);
        if (playbackTokenRef.current === playbackToken && !isPausedRef.current && isSpeakingRef.current) {
          fallbackSpeak(cleanText, handleFinished, speed, onProgress);
        }
      };

      try {
        await audio.play();
      } catch (playErr) {
        if (playbackTokenRef.current !== playbackToken || isPausedRef.current || !isSpeakingRef.current) {
          return;
        }
        console.warn("audio.play() prevented or failed, using local TTS:", playErr);
        fallbackSpeak(cleanText, handleFinished, speed, onProgress);
      }
    };

    // 🌟 Tier 1: Instant cache hit!
    if (_AUDIO_CACHE.has(cacheKey)) {
      const cachedUrl = _AUDIO_CACHE.get(cacheKey)!;
      await playAudioStream(cachedUrl);
      return;
    }

    // 🌟 Tier 2: Fetch audio with a 400ms timeout guard to prevent lagging/freezing
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 400);

      const audioUrl = `/api/voice/tts?voice=${encodeURIComponent(voiceId)}&text=${encodeURIComponent(cleanText)}&rate=${encodeURIComponent(rateParam)}`;
      const response = await fetch(audioUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`TTS server error ${response.status}`);
      }

      if (playbackTokenRef.current !== playbackToken || isPausedRef.current || !isSpeakingRef.current) {
        return;
      }

      const blob = await response.blob();
      if (playbackTokenRef.current !== playbackToken || isPausedRef.current || !isSpeakingRef.current) {
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      _AUDIO_CACHE.set(cacheKey, objectUrl);

      await playAudioStream(objectUrl);
    } catch (fetchErr) {
      // If user paused/stopped, don't play anything!
      if (playbackTokenRef.current !== playbackToken || isPausedRef.current || !isSpeakingRef.current) {
        return;
      }
      // If network took >400ms or failed, immediately speak via instant on-device TTS!
      fallbackSpeak(cleanText, handleFinished, speed, onProgress);
    }
  }, [stop, fallbackSpeak]);

  return { speak, stop, pause, resume, prefetch, isSupported: true, isSpeakingRef, isPausedRef };
}
