import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, ChevronRight, ChevronLeft,
  X, Check, RotateCcw, Sparkles, ChefHat, Clock, Users,
  List, Play, ArrowRight, HelpCircle, Bot, Loader2, MessageSquare,
  AlertTriangle, ShieldAlert, Flame, Info, Sun, Moon, Gauge
} from 'lucide-react';
import { Recipe } from '../types';
import { useSpeechSynthesis } from '../services/useSpeechSynthesis';
import { sendChatMessage } from '../services/api';
import { SpeechRecognition as NativeSpeechRecognition } from '@capacitor-community/speech-recognition';
import { Capacitor } from '@capacitor/core';

interface VoiceCookingModeProps {
  recipe: Recipe;
  dayOfWeek: string;
  onClose: () => void;
  onSwitchDay?: (day: string) => void;
}

type CookwareType = 'stainless' | 'cast_iron' | 'nonstick' | 'sheet_pan';

export const VoiceCookingMode: React.FC<VoiceCookingModeProps> = ({
  recipe,
  dayOfWeek,
  onClose,
  onSwitchDay,
}) => {
  const stepStorageKey = `tastecraft_cooking_step_${recipe.id || recipe.title}`;
  const [currentStep, setCurrentStep] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(stepStorageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
    } catch {
      // Ignore
    }
    return 0;
  });

  const updateStep = (newStep: number | ((prev: number) => number)) => {
    setCurrentStep(prev => {
      const resolved = typeof newStep === 'function' ? newStep(prev) : newStep;
      try {
        localStorage.setItem(stepStorageKey, String(resolved));
      } catch {}
      return resolved;
    });
  };

  // Cookware selection
  const [cookware, setCookware] = useState<CookwareType>(() => {
    try {
      const saved = localStorage.getItem('tastecraft_cookware');
      if (saved && ['stainless', 'cast_iron', 'nonstick', 'sheet_pan'].includes(saved)) {
        return saved as CookwareType;
      }
    } catch {}
    return 'stainless';
  });

  const handleSelectCookware = (cw: CookwareType) => {
    setCookware(cw);
    try {
      localStorage.setItem('tastecraft_cookware', cw);
    } catch {}
  };

  const [activeSection, setActiveSection] = useState<'ingredients' | 'steps'>('steps');
  const [isListening, setIsListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string>('Say "Next step", "Ingredients", or ask any question!');
  const [lastHeard, setLastHeard] = useState<string>('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  // Panic Rescue Mode Overlay State
  const [panicRescue, setPanicRescue] = useState<{ issue: string; advice: string } | null>(null);

  // AI Response Bubble State
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);

  // Theme mode: 'light' (warm cookie cream/taupe) or 'dark' (rich warm espresso/biscuit brown)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('tastecraft_cooking_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'light'; // Default to beautiful light theme matching user's Cookie screenshot!
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('tastecraft_cooking_theme', next); } catch {}
      return next;
    });
  };

  // Voice speech rate setting: 1.0 (Normal), 1.15 (Brisk - Default), 1.3 (Fast)
  const [voiceSpeed, setVoiceSpeed] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tastecraft_voice_speed');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0.8 && val <= 1.5) return val;
      }
    } catch {}
    return 1.15; // 15% faster by default
  });

  const handleSetVoiceSpeed = (newSpeed: number) => {
    setVoiceSpeed(newSpeed);
    try { localStorage.setItem('tastecraft_voice_speed', String(newSpeed)); } catch {}
  };

  // Word-by-word reading progress ratio (0.0 to 1.0)
  const [speechProgress, setSpeechProgress] = useState<number>(0);

  // Hotword AI trigger state: when user says "Cookie", "Chef", or "Hey Chef", we await their question
  const [isAwaitingQuestion, setIsAwaitingQuestion] = useState(false);
  const awaitingQuestionTimerRef = useRef<any>(null);

  const { speak, stop: stopSpeaking, isSpeakingRef } = useSpeechSynthesis();
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const isThinkingRef = useRef(false);
  const isClosedRef = useRef(false);

  const steps = recipe.instructions || [];
  const ingredients = recipe.ingredients || [];

  // Cookware adaptive tips & sensorial cues
  const getCookwareGuidance = (stepText: string): { tip: string; cue: string } | null => {
    const lower = stepText.toLowerCase();
    const isHeatStep = lower.includes('heat') || lower.includes('sear') || lower.includes('oil') || lower.includes('pan') || lower.includes('skillet');
    
    if (!isHeatStep) return null;

    if (cookware === 'stainless') {
      return {
        tip: "Stainless Steel Preheating: Perform the water-drop test. Flick a drop of water; if it forms a bead that dances across the surface, your pan is at the Leidenfrost temperature and food will not stick.",
        cue: "Listen for a steady, gentle sizzle rather than aggressive spattering."
      };
    }
    if (cookware === 'cast_iron') {
      return {
        tip: "Cast Iron Patience: Cast iron takes 3-4 minutes to heat evenly. Wait until you feel steady heat radiating 2 inches above the pan surface before adding oil.",
        cue: "Add oil only when hot to prevent polymer breakdown. Food should release naturally once seared."
      };
    }
    if (cookware === 'nonstick') {
      return {
        tip: "Non-stick Heat Ceiling: Keep heat below medium-high to protect coating longevity. Never heat dry non-stick.",
        cue: "Watch for shimmering oil, but don't let it smoke."
      };
    }
    if (cookware === 'sheet_pan') {
      return {
        tip: "Sheet Pan Spacing: Ensure vegetables and proteins aren't crowded, or they will steam instead of roast.",
        cue: "Check for golden caramelized edges and fragrant browning aroma."
      };
    }
    return null;
  };

  // Stop everything immediately
  const terminateAll = useCallback(() => {
    isClosedRef.current = true;
    isListeningRef.current = false;
    isThinkingRef.current = false;
    setIsListening(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        NativeSpeechRecognition.stop();
      } catch {}
    }

    stopSpeaking();
  }, [stopSpeaking]);

  const handleExitCooking = useCallback(() => {
    terminateAll();
    onClose();
  }, [terminateAll, onClose]);

  // Read current step aloud with sensorial guidance & word-by-word tracking
  const speakCurrentStep = useCallback((stepIdx: number) => {
    if (stepIdx < 0 || stepIdx >= steps.length || isClosedRef.current) return;
    const stepText = steps[stepIdx];
    setVoiceFeedback(`Step ${stepIdx + 1} of ${steps.length}`);
    setAiResponse(null);
    setPanicRescue(null);
    setSpeechProgress(0);

    const guidance = getCookwareGuidance(stepText);
    let speechScript = `Step ${stepIdx + 1}. ${stepText}`;
    if (guidance) {
      speechScript += ` Sensorial tip for ${cookware.replace('_', ' ')}: ${guidance.cue}`;
    }

    if (autoSpeak) {
      speak(
        speechScript,
        () => setSpeechProgress(0),
        () => setSpeechProgress(1.0),
        'en-US-AvaNeural',
        voiceSpeed,
        (progress) => setSpeechProgress(progress)
      );
    }
  }, [steps, autoSpeak, speak, cookware, voiceSpeed]);

  // Read all ingredients
  const speakIngredients = useCallback(() => {
    if (isClosedRef.current) return;
    setActiveSection('ingredients');
    setVoiceFeedback(`Reading ingredients (${ingredients.length} items)`);
    setAiResponse(null);
    setPanicRescue(null);
    setSpeechProgress(0);
    if (autoSpeak) {
      const text = ingredients.map(i => `${i.amount} ${i.unit} ${i.name}`).join(', ');
      speak(
        `Here are the ingredients: ${text}. Say "Next step" when you're ready.`,
        () => setSpeechProgress(0),
        () => setSpeechProgress(1.0),
        'en-US-AvaNeural',
        voiceSpeed
      );
    }
  }, [ingredients, autoSpeak, speak, voiceSpeed]);

  // Trigger Panic Kitchen Rescue (Smoking pan, food sticking, sauce breaking, burning)
  const triggerPanicRescue = useCallback(async (issuePhrase: string) => {
    stopSpeaking();
    setVoiceFeedback('🚨 Calm Down: Rescue Strategy Active');
    setIsThinking(true);

    try {
      const prompt = `[PANN EMERGENCY PANIC RESCUE]: The cook is mid-recipe cooking "${recipe.title}" on ${cookware}. CURRENT STEP: "${steps[currentStep]}". THE COOK CRIED OUT IN PANIC: "${issuePhrase}". Give an immediate, calm, 2-sentence culinary rescue instruction right now: tell them what to pull off the burner or adjust, and how to save the dish. Do not lecture. Be the calm Gordon Ramsay / friendly coach.`;
      
      const res = await sendChatMessage(prompt);
      const advice = res.reply.replace(/[*#_~`]/g, '').trim();

      setPanicRescue({
        issue: issuePhrase,
        advice: advice
      });
      setIsThinking(false);
      speak(`Don't panic! Here is what to do: ${advice}`);
    } catch (err) {
      console.error(err);
      setIsThinking(false);
      const fallback = "Take the pan off the heat right now and turn the burner down! Take a breath, and let the temperature drop.";
      setPanicRescue({
        issue: issuePhrase,
        advice: fallback
      });
      speak(fallback);
    }
  }, [recipe.title, cookware, steps, currentStep, stopSpeaking, speak]);

  // Query AI for cooking advice, ingredient substitutes, timer questions, or general recipe questions
  const askCookingAssistant = useCallback(async (query: string) => {
    if (isThinkingRef.current || isClosedRef.current) return;
    isThinkingRef.current = true;
    setIsThinking(true);
    setVoiceFeedback(`Chef is thinking...`);

    try {
      const currentStepText = steps[currentStep] || "None";
      const ingList = ingredients.map(i => `${i.amount} ${i.unit} ${i.name}`).join(', ');
      const prompt = `[CONTEXT: The user is currently cooking "${recipe.title}". Current Step #${currentStep + 1}: "${currentStepText}". Cookware: ${cookware}. Ingredients: ${ingList}]. USER ASKS VIA HANDS-FREE VOICE: "${query}". Keep your response empathetic, friendly, and very concise (1 to 2 short spoken sentences) using sensorial cues (smell, sound, color, touch) rather than technical temperatures.`;

      const res = await sendChatMessage(prompt);
      if (isClosedRef.current) return;

      const answer = res.reply.replace(/[*#_~`]/g, '').trim();
      setAiResponse(answer);
      setVoiceFeedback(`Chef answered`);
      if (autoSpeak) {
        speak(answer);
      }
    } catch (err) {
      if (isClosedRef.current) return;
      console.error("AI query failed:", err);
      const fallback = "I couldn't reach the AI assistant right now. You can try asking again in a moment.";
      setAiResponse(fallback);
      setVoiceFeedback('Assistant error');
      if (autoSpeak) {
        speak(fallback);
      }
    } finally {
      isThinkingRef.current = false;
      setIsThinking(false);
    }
  }, [recipe.title, currentStep, steps, ingredients, autoSpeak, speak, cookware]);

  // Handle Selective Voice Commands & Hotword-triggered AI Questions
  const handleVoiceCommand = useCallback((rawTranscript: string) => {
    if (isClosedRef.current) return;

    // Ignore voice recognition while the app is speaking its own text!
    if (isSpeakingRef.current) {
      console.log("Ignoring echo input while speaking:", rawTranscript);
      return;
    }

    const text = rawTranscript.toLowerCase().trim();
    if (!text || text.length < 2) return;

    setLastHeard(rawTranscript);

    // 0. MID-COOK PANIC RESCUE DETECTION (Always active for kitchen safety)
    if (
      text.includes('smoke') ||
      text.includes('smoking') ||
      text.includes('burning') ||
      text.includes('burn') ||
      text.includes('sticking') ||
      text.includes('stuck') ||
      text.includes('breaking') ||
      text.includes('curdling') ||
      text.includes('fire') ||
      text.includes('panic')
    ) {
      triggerPanicRescue(rawTranscript);
      return;
    }

    // 1. Next step / Continue
    if (
      text === 'next' ||
      text === 'next step' ||
      text === 'continue' ||
      text === 'forward' ||
      text.endsWith('next step') ||
      text.startsWith('next step')
    ) {
      setActiveSection('steps');
      updateStep(prev => {
        const next = Math.min(steps.length - 1, prev + 1);
        speakCurrentStep(next);
        return next;
      });
      return;
    }

    // 2. Previous step / Back
    if (
      text === 'back' ||
      text === 'previous' ||
      text === 'previous step' ||
      text === 'last step' ||
      text.endsWith('previous step')
    ) {
      setActiveSection('steps');
      updateStep(prev => {
        const back = Math.max(0, prev - 1);
        speakCurrentStep(back);
        return back;
      });
      return;
    }

    // 3. Repeat / Read again / Repeat step
    if (
      text === 'repeat' ||
      text === 'repeat step' ||
      text === 'say again' ||
      text === 'read again' ||
      text.includes('repeat step') ||
      text === 'what step'
    ) {
      setActiveSection('steps');
      speakCurrentStep(currentStep);
      return;
    }

    // 4. Read ingredients / show ingredients
    if (
      text === 'ingredients' ||
      text === 'show ingredients' ||
      text === 'read ingredients' ||
      text === 'what do i need'
    ) {
      speakIngredients();
      return;
    }

    // 5. Jump to specific step (e.g., "step 3", "step 2", "go to step 4")
    const stepMatch = text.match(/(?:step|go to step|number)\s*(\d+)/i);
    if (stepMatch && stepMatch[1]) {
      const targetStep = parseInt(stepMatch[1], 10) - 1;
      if (targetStep >= 0 && targetStep < steps.length) {
        setActiveSection('steps');
        updateStep(targetStep);
        speakCurrentStep(targetStep);
        return;
      }
    }

    // 6. Stop speaking / pause
    if (
      text === 'pause' ||
      text === 'stop' ||
      text === 'quiet' ||
      text === 'silence' ||
      text.includes('pause') ||
      text.includes('stop speaking')
    ) {
      stopSpeaking();
      setVoiceFeedback('Paused speech');
      return;
    }

    // 7. Close / exit cooking mode
    if (
      text === 'exit' ||
      text === 'close' ||
      text === 'quit' ||
      text === 'done cooking' ||
      text.includes('exit cooking')
    ) {
      handleExitCooking();
      return;
    }

    // 8. HOTWORD DETECTION FOR AI QUESTIONS:
    // Only answer if the user uses the hotword: "cookie", "hey cookie", "chef", "hey chef"
    // OR if they recently activated question mode.
    const hasHotword =
      text.includes('cookie') ||
      text.includes('hey cookie') ||
      text.includes('chef') ||
      text.includes('hey chef');

    if (hasHotword || isAwaitingQuestion) {
      // Clean hotword from query
      let query = rawTranscript
        .replace(/\b(hey\s+cookie|cookie|hey\s+chef|chef)\b/gi, '')
        .trim();

      if (!query || query.length < 3) {
        // Just the wake word spoken! Activate listening mode and prompt user
        setIsAwaitingQuestion(true);
        setVoiceFeedback('Listening for your question...');
        speak("I'm listening, go ahead!", undefined, undefined, 'en-US-AvaNeural', voiceSpeed);
        if (awaitingQuestionTimerRef.current) clearTimeout(awaitingQuestionTimerRef.current);
        awaitingQuestionTimerRef.current = setTimeout(() => {
          setIsAwaitingQuestion(false);
          setVoiceFeedback('Say "Next step" or "Cookie [question]"');
        }, 8000);
        return;
      }

      // Hotword accompanied by question, or followed up question!
      setIsAwaitingQuestion(false);
      if (awaitingQuestionTimerRef.current) clearTimeout(awaitingQuestionTimerRef.current);
      askCookingAssistant(query);
      return;
    }

    // Otherwise, intentionally ignore random kitchen banter / noise!
    console.log("Ignored non-command speech:", rawTranscript);
  }, [steps.length, currentStep, speakCurrentStep, speakIngredients, stopSpeaking, handleExitCooking, askCookingAssistant, isSpeakingRef, triggerPanicRescue]);

  // Start continuous hands-free voice recognition
  const startHandsFree = useCallback(async () => {
    if (isClosedRef.current) return;

    // 1. If running natively in Android APK, verify and request microphone permissions via Capacitor
    if (Capacitor.isNativePlatform()) {
      try {
        const hasPermission = await NativeSpeechRecognition.checkPermissions();
        if (hasPermission.speechRecognition !== 'granted') {
          await NativeSpeechRecognition.requestPermissions();
        }
      } catch (err) {
        console.warn("Capacitor SpeechRecognition permission check:", err);
      }
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      if (Capacitor.isNativePlatform()) {
        try {
          setIsListening(true);
          isListeningRef.current = true;
          setVoiceFeedback('🎙️ Hands-free listening... Speak any command!');

          const startNativeLoop = async () => {
            while (isListeningRef.current && !isClosedRef.current) {
              try {
                if (isSpeakingRef.current) {
                  await new Promise(r => setTimeout(r, 600));
                  continue;
                }

                const res = await NativeSpeechRecognition.start({
                  language: 'en-US',
                  maxResults: 1,
                  prompt: 'Say a command or ask a cooking question',
                  partialResults: false,
                  popup: false,
                });
                if (isClosedRef.current) break;
                if (res.matches && res.matches.length > 0 && !isSpeakingRef.current) {
                  handleVoiceCommand(res.matches[0]);
                }
              } catch (e) {
                await new Promise(r => setTimeout(r, 1000));
              }
            }
          };
          startNativeLoop();
          return;
        } catch (e) {
          console.error("Native speech loop error:", e);
        }
      }

      setVoiceFeedback('Speech recognition not available on this device');
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = navigator.language || 'en-US';

      rec.onstart = () => {
        if (isClosedRef.current) {
          try { rec.abort(); } catch {}
          return;
        }
        setIsListening(true);
        isListeningRef.current = true;
        setVoiceFeedback('🎙️ Hands-free listening... Speak any command or question!');
      };

      rec.onresult = (event: any) => {
        if (isClosedRef.current) return;
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript;
        if (transcript) {
          handleVoiceCommand(transcript);
        }
      };

      rec.onerror = (event: any) => {
        console.warn("Cooking mode speech error:", event.error);
        if (event.error === 'not-allowed') {
          setVoiceFeedback('Microphone permission blocked. Tap the mic button to grant.');
          setIsListening(false);
          isListeningRef.current = false;
        }
      };

      rec.onend = () => {
        if (isListeningRef.current && !isClosedRef.current) {
          try {
            rec.start();
          } catch {
            setIsListening(false);
            isListeningRef.current = false;
          }
        } else {
          setIsListening(false);
        }
      };

      rec.start();
      recognitionRef.current = rec;
    } catch (e) {
      console.error(e);
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, [handleVoiceCommand, isSpeakingRef]);

  const stopHandsFree = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (Capacitor.isNativePlatform()) {
      try {
        NativeSpeechRecognition.stop();
      } catch {}
    }
    stopSpeaking();
    setVoiceFeedback('Hands-free mode paused.');
  }, [stopSpeaking]);

  const toggleHandsFree = () => {
    if (isListening) {
      stopHandsFree();
    } else {
      startHandsFree();
    }
  };

  // Initial greeting and read aloud
  useEffect(() => {
    isClosedRef.current = false;
    if (steps.length > 0 && autoSpeak) {
      speak(`Cooking mode for ${recipe.title}. Cookware set to ${cookware.replace('_', ' ')}. Step 1: ${steps[0]}`);
    }
    startHandsFree();

    return () => {
      terminateAll();
    };
  }, []);

  const currentStepText = steps[currentStep] || "Enjoy your meal!";
  const activeGuidance = getCookwareGuidance(currentStepText);

  // Split step text into words for word-by-word reading highlighting
  const words = currentStepText.split(/\s+/).filter(Boolean);
  const activeWordIdx = Math.floor(speechProgress * words.length);

  // Cookie Logo Icon component (matching the warm cookie badge from user screenshot)
  const CookieLogo = ({ className = "w-7 h-7" }: { className?: string }) => (
    <div className={`relative flex items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 shadow-md border-2 border-amber-300/40 p-1 shrink-0 ${className}`}>
      <span className="absolute top-1 left-1.5 w-1 h-1 rounded-full bg-[#3d2110]" />
      <span className="absolute bottom-1.5 left-2 w-1.5 h-1.5 rounded-full bg-[#3d2110]" />
      <span className="absolute top-2 right-1.5 w-1 h-1 rounded-full bg-[#3d2110]" />
      <span className="absolute bottom-1 right-2 w-1.5 h-1.5 rounded-full bg-[#3d2110]" />
      <ChefHat className="w-full h-full text-white drop-shadow" />
    </div>
  );

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between animate-fadeIn overflow-hidden transition-colors duration-300 ${
        theme === 'light'
          ? 'bg-[#F7F4EE] text-[#2C2117]'
          : 'bg-[#181310] text-[#F5EEDB]'
      }`}
    >
      {/* Subtle Warm Aesthetic Glow */}
      <div
        className={`absolute top-0 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
          theme === 'light' ? 'bg-amber-200/40' : 'bg-amber-600/10'
        }`}
      />

      {/* Top Header Bar - Tablet & Mobile Friendly */}
      <header
        className={`px-3 py-2.5 sm:px-6 sm:py-3.5 border-b backdrop-blur-md flex items-center justify-between gap-2 shrink-0 z-20 transition-colors ${
          theme === 'light'
            ? 'bg-[#F2ECE1]/95 border-[#E5DAC6]'
            : 'bg-[#211A15]/95 border-[#34271D]'
        }`}
      >
        {/* Left: Cookie Logo & Title */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
          <CookieLogo className="w-9 h-9 sm:w-11 sm:h-11" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
                  theme === 'light'
                    ? 'bg-amber-100 text-amber-900 border-amber-300/80'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                {dayOfWeek}
              </span>
              <span
                className={`text-[10px] hidden sm:inline ${
                  theme === 'light' ? 'text-[#7D6B58]' : 'text-stone-400'
                }`}
              >
                Prep: {recipe.prep_time_mins}m • Cook: {recipe.cook_time_mins}m
              </span>
            </div>
            <h1
              className={`text-sm sm:text-lg md:text-xl font-serif font-bold truncate max-w-[180px] sm:max-w-xs md:max-w-md ${
                theme === 'light' ? 'text-[#2C2117]' : 'text-white'
              }`}
            >
              {recipe.title}
            </h1>
          </div>
        </div>

        {/* Right Controls: Theme, Speed, Cookware, Panic, Audio, Mic, and Prominent Exit */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Theme Toggle: Light vs Warm Espresso Dark */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`p-2 sm:p-2.5 rounded-xl border transition cursor-pointer ${
              theme === 'light'
                ? 'bg-white hover:bg-stone-50 text-amber-900 border-[#DFD3BE] shadow-xs'
                : 'bg-[#291F18] hover:bg-[#34271D] text-amber-300 border-[#423223]'
            }`}
            title={`Switch to ${theme === 'light' ? 'Dark Warm Brown' : 'Cookie Light'} theme`}
          >
            {theme === 'light' ? <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-800" /> : <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400" />}
          </button>

          {/* Voice Speed Toggle Pill: 1.0x, 1.15x (Default brisk), 1.3x */}
          <div
            className={`flex items-center rounded-xl p-0.5 border text-xs font-semibold ${
              theme === 'light'
                ? 'bg-[#EAE0CD] border-[#D9CCB4]'
                : 'bg-[#291F18] border-[#423223]'
            }`}
            title="Speech Speed Rate"
          >
            {[
              { val: 1.0, label: '1.0x' },
              { val: 1.15, label: '1.15x' },
              { val: 1.3, label: '1.3x' },
            ].map(s => (
              <button
                key={s.label}
                type="button"
                onClick={() => handleSetVoiceSpeed(s.val)}
                className={`px-2 py-1 rounded-lg transition cursor-pointer text-[11px] font-bold ${
                  voiceSpeed === s.val
                    ? theme === 'light'
                      ? 'bg-white text-amber-950 shadow-xs'
                      : 'bg-amber-600 text-white shadow-xs'
                    : theme === 'light'
                    ? 'text-stone-600 hover:text-stone-900'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Cookware Selector Pill (Tablet/Desktop) */}
          <div
            className={`hidden xl:flex items-center rounded-xl p-0.5 border text-xs ${
              theme === 'light'
                ? 'bg-[#EAE0CD] border-[#D9CCB4]'
                : 'bg-[#291F18] border-[#423223]'
            }`}
          >
            {[
              { id: 'stainless', label: 'Stainless' },
              { id: 'cast_iron', label: 'Cast Iron' },
              { id: 'nonstick', label: 'Non-stick' },
              { id: 'sheet_pan', label: 'Sheet Pan' },
            ].map(cw => (
              <button
                key={cw.id}
                type="button"
                onClick={() => handleSelectCookware(cw.id as any)}
                className={`px-2 py-1 rounded-lg font-medium transition cursor-pointer text-[11px] ${
                  cookware === cw.id
                    ? theme === 'light'
                      ? 'bg-amber-600 text-white font-bold shadow-xs'
                      : 'bg-amber-500 text-stone-950 font-bold'
                    : theme === 'light'
                    ? 'text-stone-600 hover:text-stone-900'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {cw.label}
              </button>
            ))}
          </div>

          {/* Panic Button */}
          <button
            type="button"
            onClick={() => triggerPanicRescue("Help! My pan is smoking and food is sticking!")}
            className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1 shadow-md cursor-pointer transition active:scale-95"
            title="Panic Rescue - Instant troubleshooting advice"
          >
            <ShieldAlert className="w-4 h-4 text-white" />
            <span className="hidden md:inline">Panic</span>
          </button>

          {/* Audio speech toggle */}
          <button
            type="button"
            onClick={() => {
              if (autoSpeak) {
                stopSpeaking();
                setAutoSpeak(false);
              } else {
                setAutoSpeak(true);
                speakCurrentStep(currentStep);
              }
            }}
            className={`p-2 sm:p-2.5 rounded-xl border transition cursor-pointer ${
              autoSpeak
                ? theme === 'light'
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : theme === 'light'
                ? 'bg-white text-stone-400 border-stone-200'
                : 'bg-[#291F18] text-stone-400 border-[#423223]'
            }`}
            title={autoSpeak ? "Voice Audio is On" : "Voice Audio is Muted"}
          >
            {autoSpeak ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          {/* Hands-Free Mic Toggle */}
          <button
            type="button"
            onClick={toggleHandsFree}
            className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
              isListening
                ? theme === 'light'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-md'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md'
                : theme === 'light'
                ? 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'
                : 'bg-[#291F18] text-stone-400 border-[#423223] hover:text-white'
            }`}
          >
            {isListening ? (
              <>
                <Mic className="w-4 h-4 animate-bounce" />
                <span className="hidden sm:inline">Listening</span>
              </>
            ) : (
              <>
                <MicOff className="w-4 h-4" />
                <span className="hidden sm:inline">Mic</span>
              </>
            )}
          </button>

          {/* Help toggle */}
          <button
            type="button"
            onClick={() => setShowHelp(prev => !prev)}
            className={`hidden sm:flex p-2 sm:p-2.5 rounded-xl border transition cursor-pointer ${
              theme === 'light'
                ? 'bg-white text-stone-600 border-[#E5DAC6] hover:text-stone-900'
                : 'bg-[#291F18] text-stone-400 border-[#423223] hover:text-white'
            }`}
            title="Voice Commands Help"
          >
            <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* PROMINENT HIGH-CONTRAST EXIT BUTTON */}
          <button
            type="button"
            onClick={handleExitCooking}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md active:scale-95 ${
              theme === 'light'
                ? 'bg-[#3E2F23] hover:bg-rose-800 text-white border border-[#2D2117]'
                : 'bg-gradient-to-r from-stone-800 to-stone-700 hover:from-rose-900 hover:to-rose-800 text-stone-200 hover:text-white border border-stone-600'
            }`}
            title="Exit Cooking Mode & Return to Meal Plan"
          >
            <X className="w-4 h-4 text-amber-300" />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* Voice Assistant Status Banner */}
      <div
        className={`px-4 py-2 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs shrink-0 z-10 transition-colors ${
          theme === 'light'
            ? 'bg-[#EFE7D8] border-[#DFD3BE] text-[#5C4A3A]'
            : 'bg-[#1E1712] border-[#31251B] text-stone-300'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg border ${
              theme === 'light'
                ? 'bg-white text-amber-900 border-amber-300/80 shadow-xs'
                : 'bg-amber-950/60 text-amber-300 border-amber-500/30'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="font-semibold">{voiceFeedback}</span>
          </div>
          {isAwaitingQuestion && (
            <div className="px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 font-bold text-[10px] animate-pulse">
              Cookie listening... speak your question now!
            </div>
          )}
          {lastHeard && (
            <div
              className={`px-2.5 py-1 rounded-lg border text-xs ${
                theme === 'light'
                  ? 'bg-white/70 border-[#D9CCB4] text-[#423326]'
                  : 'bg-[#291F18] border-[#3A2C21] text-stone-300'
              }`}
            >
              Heard: <strong className="text-amber-600 dark:text-amber-300">"{lastHeard}"</strong>
            </div>
          )}
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
          <button
            onClick={() => setActiveSection('ingredients')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeSection === 'ingredients'
                ? 'bg-amber-600 text-white shadow-md font-bold'
                : theme === 'light'
                ? 'bg-white/80 text-stone-700 hover:bg-white'
                : 'bg-[#291F18] text-stone-400 hover:text-white'
            }`}
          >
            Ingredients ({ingredients.length})
          </button>
          <button
            onClick={() => setActiveSection('steps')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeSection === 'steps'
                ? 'bg-amber-600 text-white shadow-md font-bold'
                : theme === 'light'
                ? 'bg-white/80 text-stone-700 hover:bg-white'
                : 'bg-[#291F18] text-stone-400 hover:text-white'
            }`}
          >
            Steps ({steps.length})
          </button>
        </div>
      </div>

      {/* Main Content Stage - Optimized for Phone & 11" Tablet Countertop Viewing */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 flex flex-col max-w-5xl mx-auto w-full z-10">
        {showHelp && (
          <div
            className={`border rounded-2xl p-4 sm:p-5 mb-5 text-xs space-y-2 animate-fadeIn shrink-0 shadow-lg ${
              theme === 'light'
                ? 'bg-[#FFFDF9] border-amber-300 text-stone-800'
                : 'bg-amber-950/80 border-amber-500/50 text-amber-200'
            }`}
          >
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Voice Navigation & Hotword Commands:</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <div>• <strong className="font-bold">"Next step" / "Next":</strong> Advance forward</div>
              <div>• <strong className="font-bold">"Previous step" / "Back":</strong> Go backward</div>
              <div>• <strong className="font-bold">"Repeat step" / "Repeat":</strong> Re-read step with sensory guidance</div>
              <div>• <strong className="font-bold">"Step X":</strong> Jump directly to any step (e.g. "Step 3")</div>
              <div>• <strong className="font-bold">"Pause" / "Stop":</strong> Stop audio speech</div>
              <div>• <strong className="font-bold">"Cookie [question]" or "Chef":</strong> Wakes AI for tailored cooking answers</div>
              <div>• <strong className="font-bold">"Panic" / "Food sticking":</strong> Immediate rescue strategy</div>
            </div>
          </div>
        )}

        {/* 🚨 Mid-Cook Panic Rescue Overlay */}
        {panicRescue && (
          <div className="mb-5 bg-gradient-to-r from-rose-950/95 via-red-950/90 to-[#1c1210] border-2 border-rose-500/80 rounded-3xl p-5 sm:p-6 shadow-2xl animate-fadeIn shrink-0 text-white">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-rose-800/40">
              <div className="flex items-center gap-2 text-rose-300">
                <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
                <span className="font-bold uppercase tracking-wider text-xs">Kitchen Rescue Strategy</span>
              </div>
              <button
                onClick={() => setPanicRescue(null)}
                className="text-stone-300 hover:text-white text-xs underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
            <p className="text-base sm:text-lg font-serif leading-relaxed mb-3">
              {panicRescue.advice}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => speak(panicRescue.advice)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>Hear Rescue Advice Again</span>
              </button>
            </div>
          </div>
        )}

        {/* 💬 Conversational AI Response Card */}
        {(aiResponse || isThinking) && (
          <div
            className={`mb-5 border-2 rounded-3xl p-5 sm:p-6 shadow-2xl animate-fadeIn shrink-0 transition-colors ${
              theme === 'light'
                ? 'bg-white border-amber-400 text-stone-900 shadow-amber-900/10'
                : 'bg-gradient-to-br from-[#2B1F17] to-[#1C140F] border-amber-500/70 text-stone-100 shadow-2xl'
            }`}
          >
            <div
              className={`flex items-center justify-between mb-3 pb-2 border-b ${
                theme === 'light' ? 'border-amber-200' : 'border-amber-500/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <CookieLogo className="w-6 h-6" />
                <span
                  className={`font-bold uppercase tracking-wider text-xs ${
                    theme === 'light' ? 'text-amber-900' : 'text-amber-300'
                  }`}
                >
                  Cookie Kitchen Assistant
                </span>
              </div>
              {!isThinking && (
                <button
                  onClick={() => setAiResponse(null)}
                  className={`text-xs underline cursor-pointer ${
                    theme === 'light' ? 'text-stone-500 hover:text-stone-900' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Dismiss
                </button>
              )}
            </div>

            {isThinking ? (
              <div className="flex items-center gap-3 py-3 text-sm font-medium animate-pulse text-amber-600 dark:text-amber-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Chef is formulating advice...</span>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <p
                  className={`text-base sm:text-lg font-serif leading-relaxed whitespace-pre-line flex-1 ${
                    theme === 'light' ? 'text-[#2C2117]' : 'text-stone-100'
                  }`}
                >
                  {aiResponse}
                </p>
                <button
                  type="button"
                  onClick={() => aiResponse && speak(aiResponse)}
                  className={`p-3 rounded-2xl transition cursor-pointer shrink-0 border shadow-md ${
                    theme === 'light'
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300'
                      : 'bg-amber-600/40 hover:bg-amber-600 text-amber-200 hover:text-white border-amber-500/40'
                  }`}
                  title="Read AI response again"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}

        {activeSection === 'steps' ? (
          <div className="space-y-6 my-auto">
            {/* Step Progress & Indicators */}
            <div
              className={`flex items-center justify-between text-xs ${
                theme === 'light' ? 'text-[#7D6B58]' : 'text-stone-400'
              }`}
            >
              <span className="font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Step {currentStep + 1} of {steps.length} • {cookware.replace('_', ' ').toUpperCase()} AWARE
              </span>
              <span>Say "Next step" or tap arrow</span>
            </div>

            {/* Giant Recipe Step Card with Word-by-Word Highlighting (Cookie App Design) */}
            <div
              className={`border rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-12 shadow-2xl relative overflow-hidden transition-colors ${
                theme === 'light'
                  ? 'bg-white border-[#E6DAC7] shadow-amber-900/5'
                  : 'bg-[#221A15] border-[#3B2C21] shadow-2xl'
              }`}
            >
              <div className="flex items-start gap-3.5 sm:gap-6 md:gap-8">
                {/* Step Number Badge */}
                <span className="w-11 h-11 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white font-black text-lg sm:text-3xl md:text-4xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-600/30">
                  {currentStep + 1}
                </span>

                <div className="space-y-4 flex-1 min-w-0">
                  {/* Word-by-Word Highlighted Instruction Text */}
                  <div className="text-base sm:text-2xl md:text-3xl font-serif font-medium leading-relaxed sm:leading-loose">
                    {words.map((w, idx) => {
                      const isCurrent = idx === activeWordIdx && speechProgress > 0 && speechProgress < 0.98;
                      const isPast = idx < activeWordIdx && speechProgress > 0;
                      return (
                        <span
                          key={idx}
                          className={`inline-block mr-1.5 sm:mr-2 px-1 py-0.5 rounded transition-colors duration-150 ${
                            isCurrent
                              ? theme === 'light'
                                ? 'bg-amber-300 text-amber-950 font-bold scale-105 shadow-xs'
                                : 'bg-amber-500 text-stone-950 font-bold scale-105 shadow-md'
                              : isPast
                              ? theme === 'light'
                                ? 'text-amber-950 font-medium'
                                : 'text-amber-200/90'
                              : theme === 'light'
                              ? 'text-[#2C2117]'
                              : 'text-stone-300'
                          }`}
                        >
                          {w}
                        </span>
                      );
                    })}
                  </div>

                  {/* Sensorial coaching callout for cookware */}
                  {activeGuidance && (
                    <div
                      className={`border rounded-xl sm:rounded-2xl p-3 sm:p-4 text-xs sm:text-sm flex items-start gap-2.5 sm:gap-3 mt-4 ${
                        theme === 'light'
                          ? 'bg-[#F9F5EC] border-amber-300 text-amber-950'
                          : 'bg-[#2B2019] border-amber-500/30 text-amber-200/90'
                      }`}
                    >
                      <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <strong
                          className={`block font-sans mb-0.5 ${
                            theme === 'light' ? 'text-amber-900' : 'text-white'
                          }`}
                        >
                          Sensorial Cookware Coach:
                        </strong>
                        <span>{activeGuidance.tip}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div
                className={`w-full h-2.5 rounded-full overflow-hidden mt-8 ${
                  theme === 'light' ? 'bg-[#EFE8DA]' : 'bg-[#2E231C]'
                }`}
              >
                <div
                  className="bg-gradient-to-r from-amber-600 to-amber-400 h-full transition-all duration-300"
                  style={{ width: `${Math.round(((currentStep + 1) / steps.length) * 100)}%` }}
                />
              </div>
            </div>

            {/* Step Selector Pills */}
            <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentStep(idx);
                    speakCurrentStep(idx);
                  }}
                  className={`w-9 h-9 rounded-xl text-xs font-bold transition cursor-pointer ${
                    currentStep === idx
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30 scale-110 font-black'
                      : theme === 'light'
                      ? 'bg-white text-stone-700 hover:bg-stone-50 border border-[#DED3BD]'
                      : 'bg-[#291F18] text-stone-400 hover:bg-[#34271D] hover:text-white border border-[#423223]'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Ingredients View */
          <div className="space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <h2
                className={`text-base sm:text-xl font-serif font-bold flex items-center gap-2 ${
                  theme === 'light' ? 'text-[#2C2117]' : 'text-white'
                }`}
              >
                <List className="w-5 h-5 text-amber-500" />
                <span>Ingredients for {recipe.title}</span>
              </h2>
              <button
                onClick={() => {
                  setActiveSection('steps');
                  speakCurrentStep(0);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition cursor-pointer shadow-lg"
              >
                Start Step 1
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {ingredients.map((ing, idx) => (
                <div
                  key={idx}
                  className={`p-4 border rounded-2xl flex items-center justify-between gap-3 shadow-sm ${
                    theme === 'light'
                      ? 'bg-white border-[#E5DAC6] text-stone-800'
                      : 'bg-[#221A15] border-[#3B2C21] text-stone-200'
                  }`}
                >
                  <span className="font-semibold text-sm">{ing.name}</span>
                  <span
                    className={`font-mono text-xs px-3 py-1 rounded-xl border shrink-0 font-bold ${
                      theme === 'light'
                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                        : 'bg-[#2C2018] text-amber-300 border-[#473627]'
                    }`}
                  >
                    {ing.amount} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Big Bottom Action Controls - Phone & 11" Tablet Countertop Optimized */}
      <footer
        className={`p-3 sm:p-5 md:p-6 border-t backdrop-blur-md flex items-center justify-between gap-2 sm:gap-4 shrink-0 z-10 transition-colors ${
          theme === 'light'
            ? 'bg-[#F2ECE1]/95 border-[#E5DAC6]'
            : 'bg-[#211A15]/95 border-[#34271D]'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setActiveSection('steps');
            updateStep(prev => {
              const back = Math.max(0, prev - 1);
              speakCurrentStep(back);
              return back;
            });
          }}
          disabled={currentStep === 0 && activeSection === 'steps'}
          className={`px-3 sm:px-6 md:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl disabled:opacity-30 text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 sm:gap-2 transition cursor-pointer border shadow-md shrink-0 ${
            theme === 'light'
              ? 'bg-white hover:bg-stone-50 text-stone-800 border-[#DED3BD]'
              : 'bg-[#291F18] hover:bg-[#34271D] text-stone-200 border-[#423223]'
          }`}
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Prev</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (activeSection === 'ingredients') {
              speakIngredients();
            } else {
              speakCurrentStep(currentStep);
            }
          }}
          className={`px-3 sm:px-6 md:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 sm:gap-2 transition cursor-pointer border shadow-md shrink-0 ${
            theme === 'light'
              ? 'bg-white hover:bg-stone-50 text-amber-900 border-amber-300'
              : 'bg-[#291F18] hover:bg-[#34271D] text-amber-300 border-amber-500/30'
          }`}
        >
          <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden xs:inline">Repeat</span>
          <span className="xs:hidden">Re-read</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (activeSection === 'ingredients') {
              setActiveSection('steps');
              updateStep(0);
              speakCurrentStep(0);
            } else if (currentStep < steps.length - 1) {
              updateStep(prev => {
                const next = prev + 1;
                speakCurrentStep(next);
                return next;
              });
            } else {
              handleExitCooking();
            }
          }}
          className="px-4 sm:px-8 md:px-10 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 text-xs sm:text-sm md:text-base font-black flex items-center gap-1.5 sm:gap-2 transition cursor-pointer shadow-xl shadow-amber-950/20 shrink-0 active:scale-95"
        >
          <span>{currentStep === steps.length - 1 ? 'Done' : 'Next Step'}</span>
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </footer>
    </div>
  );
};
