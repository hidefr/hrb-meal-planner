import { useCallback, useRef } from 'react';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

export function useSpeechSynthesis() {
  const isNative = Capacitor.isNativePlatform();
  const isSpeakingRef = useRef(false);
  const isPausedRef = useRef(false);
  const playbackTokenRef = useRef(0);
  const progressTimerRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

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

    // 1. Stop Neural Audio playback immediately if active
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.src = '';
      } catch {}
      currentAudioRef.current = null;
    }

    // 2. Stop Web Speech Synthesis immediately
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    // 3. Stop Native Android TextToSpeech immediately
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

    // 1. Pause Neural Audio if active
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
      } catch {}
    }

    // 2. Cancel Web Speech Synthesis immediately
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    // 3. Stop Native Android TTS immediately
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
    if (currentAudioRef.current && isPausedRef.current) {
      try {
        currentAudioRef.current.play();
        isPausedRef.current = false;
        isSpeakingRef.current = true;
        return true;
      } catch {}
    }
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

    // 🌟 0. If Neural / ElevenLabs voice engine is enabled in settings, stream lifelike neural audio
    let engine = 'device';
    try {
      engine = localStorage.getItem('tastecraft_voice_engine') || 'device';
    } catch {}

    if (engine === 'neural') {
      try {
        const rateParam = speed >= 1.25 ? '+20%' : speed >= 1.1 ? '+10%' : '+0%';
        const audioUrl = `/api/voice/tts?text=${encodeURIComponent(cleanText)}&voice=${encodeURIComponent(_voiceId)}&rate=${encodeURIComponent(rateParam)}`;
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;

        audio.onplay = () => {
          if (playbackTokenRef.current === playbackToken) {
            startWordTracking();
          }
        };

        audio.onended = () => {
          if (playbackTokenRef.current === playbackToken) {
            handleFinished();
          }
        };

        audio.onerror = () => {
          console.warn("Neural TTS audio unavailable or offline, continuing to device fallback.");
        };

        await audio.play();
        return;
      } catch (err) {
        console.warn("Neural audio play failed, falling back to device speech:", err);
      }
    }

    // 🌟 1. On Native Android App: Use Android Native TextToSpeech plugin (Instant, zero lag, zero buffering)
    if (isNative) {
      try {
        startWordTracking();

        let targetVoiceIndex: number | undefined = undefined;
        try {
          const result = await TextToSpeech.getSupportedVoices();
          if (result && Array.isArray(result.voices) && result.voices.length > 0) {
            // Find Google Voice 3 (Google TTS en-US Voice 3 identifier is 'iob' or contains 'voice 3' / 'voice_3')
            const v3Idx = result.voices.findIndex((v: any) => {
              const name = (v?.name || '').toLowerCase();
              return name.includes('iob') || name.includes('voice 3') || name.includes('voice_3');
            });
            if (v3Idx >= 0) {
              targetVoiceIndex = v3Idx;
            } else {
              // Fallback to any high-quality en-US voice
              const enIdx = result.voices.findIndex((v: any) => {
                const lang = (v?.lang || '').toLowerCase();
                const name = (v?.name || '').toLowerCase();
                return lang.startsWith('en') && (name.includes('google') || (v?.quality && v.quality >= 400));
              });
              if (enIdx >= 0) targetVoiceIndex = enIdx;
            }
          }
        } catch (vErr) {
          console.warn("Could not query supported Android TTS voices:", vErr);
        }

        await TextToSpeech.speak({
          text: cleanText,
          lang: 'en-US',
          rate: speed,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient',
          voice: targetVoiceIndex,
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
