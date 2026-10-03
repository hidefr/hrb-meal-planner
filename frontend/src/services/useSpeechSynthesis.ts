import { useCallback, useRef } from 'react';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

export function useSpeechSynthesis() {
  const isNative = Capacitor.isNativePlatform();
  const isSpeakingRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackTokenRef = useRef(0);

  const stop = useCallback(async () => {
    isSpeakingRef.current = false;
    playbackTokenRef.current++; // Invalidate any ongoing TTS network requests immediately!

    // 1. Stop HTML5 Audio stream
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      } catch {}
    }

    // 2. Stop Web Speech Synthesis
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

  const pause = useCallback(() => {
    if (currentAudioRef.current && !currentAudioRef.current.paused) {
      try {
        currentAudioRef.current.pause();
      } catch {}
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      try {
        window.speechSynthesis.pause();
      } catch {}
    }
  }, []);

  const resume = useCallback(() => {
    if (currentAudioRef.current && currentAudioRef.current.paused) {
      try {
        currentAudioRef.current.play();
      } catch {}
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.paused) {
      try {
        window.speechSynthesis.resume();
      } catch {}
    }
  }, []);

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
    isSpeakingRef.current = true;
    if (onStart) onStart();

    const handleFinished = () => {
      isSpeakingRef.current = false;
      currentAudioRef.current = null;
      if (onProgress) onProgress(1.0);
      if (onEnd) onEnd();
    };

    // Use a unique playback token to discard stale async fetch responses if user clicks Pause/Exit/Next
    const playbackToken = ++playbackTokenRef.current;

    // 🌟 Tier 1: High-Fidelity Natural Neural Voice (via Backend Neural Audio Stream)
    // Pre-buffers full audio blob to prevent stuttering, pausing, or missing words on mobile/tablet Wi-Fi
    try {
      // Convert speed to edge-tts rate format (e.g. 1.15 -> +15%, 1.25 -> +25%, 1.0 -> +0%)
      const speedPct = Math.round((speed - 1.0) * 100);
      const rateParam = speedPct >= 0 ? `+${speedPct}%` : `${speedPct}%`;

      const audioUrl = `/api/voice/tts?voice=${encodeURIComponent(voiceId)}&text=${encodeURIComponent(cleanText)}&rate=${encodeURIComponent(rateParam)}`;
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`TTS server responded with ${response.status}`);
      }

      // If user exited or started new step while fetching, abort immediately!
      if (playbackTokenRef.current !== playbackToken || !isSpeakingRef.current) {
        return;
      }

      const blob = await response.blob();
      if (playbackTokenRef.current !== playbackToken || !isSpeakingRef.current) {
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      currentAudioRef.current = audio;

      audio.ontimeupdate = () => {
        if (audio.duration && onProgress && !audio.paused) {
          const ratio = Math.min(1.0, audio.currentTime / audio.duration);
          onProgress(ratio);
        }
      };

      audio.onplay = () => {
        isSpeakingRef.current = true;
      };

      audio.onended = () => {
        URL.revokeObjectURL(objectUrl);
        handleFinished();
      };

      audio.onerror = (e) => {
        URL.revokeObjectURL(objectUrl);
        console.warn("Neural audio playback error, falling back to local TTS:", e);
        if (playbackTokenRef.current === playbackToken && isSpeakingRef.current) {
          fallbackSpeak(cleanText, handleFinished);
        }
      };

      await audio.play();
      return;
    } catch (err) {
      if (playbackTokenRef.current !== playbackToken || !isSpeakingRef.current) return;
      console.warn("Failed to stream neural audio, trying fallback:", err);
      fallbackSpeak(cleanText, handleFinished);
    }
  }, [stop]);

  // Fallback if offline or network unavailable
  const fallbackSpeak = useCallback(async (cleanText: string, onDone: () => void) => {
    if (isNative) {
      try {
        await TextToSpeech.speak({
          text: cleanText,
          lang: 'en-US',
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient',
        });
        onDone();
        return;
      } catch (e) {
        console.warn("Capacitor Native TextToSpeech error:", e);
      }
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.lang = 'en-US';
        utterance.onend = () => onDone();
        utterance.onerror = () => onDone();
        window.speechSynthesis.speak(utterance);
        return;
      } catch (e) {
        console.warn("Web speech synthesis fallback failed:", e);
      }
    }

    onDone();
  }, [isNative]);

  return { speak, stop, pause, resume, isSupported: true, isSpeakingRef };
}
