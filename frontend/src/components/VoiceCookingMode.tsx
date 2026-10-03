import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, ChevronRight, ChevronLeft,
  X, Check, RotateCcw, Sparkles, ChefHat, Clock, Users,
  List, Play, ArrowRight, HelpCircle, Bot, Loader2, MessageSquare,
  AlertTriangle, ShieldAlert, Flame, Info
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

  // Read current step aloud with sensorial guidance
  const speakCurrentStep = useCallback((stepIdx: number) => {
    if (stepIdx < 0 || stepIdx >= steps.length || isClosedRef.current) return;
    const stepText = steps[stepIdx];
    setVoiceFeedback(`Step ${stepIdx + 1} of ${steps.length}`);
    setAiResponse(null);
    setPanicRescue(null);

    const guidance = getCookwareGuidance(stepText);
    let speechScript = `Step ${stepIdx + 1}. ${stepText}`;
    if (guidance) {
      speechScript += ` Sensorial tip for ${cookware.replace('_', ' ')}: ${guidance.cue}`;
    }

    if (autoSpeak) {
      speak(speechScript);
    }
  }, [steps, autoSpeak, speak, cookware]);

  // Read all ingredients
  const speakIngredients = useCallback(() => {
    if (isClosedRef.current) return;
    setActiveSection('ingredients');
    setVoiceFeedback(`Reading ingredients (${ingredients.length} items)`);
    setAiResponse(null);
    setPanicRescue(null);
    if (autoSpeak) {
      const text = ingredients.map(i => `${i.amount} ${i.unit} ${i.name}`).join(', ');
      speak(`Here are the ingredients: ${text}. Say "Start steps" when you're ready.`);
    }
  }, [ingredients, autoSpeak, speak]);

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

  // Handle Voice Commands & Questions
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

    // 0. MID-COOK PANIC RESCUE DETECTION
    if (
      text.includes('smoke') ||
      text.includes('smoking') ||
      text.includes('burning') ||
      text.includes('burn') ||
      text.includes('sticking') ||
      text.includes('stuck') ||
      text.includes('breaking') ||
      text.includes('curdling') ||
      text.includes('too salty') ||
      text.includes('fire') ||
      text.includes('help me') ||
      text.includes('panic')
    ) {
      triggerPanicRescue(rawTranscript);
      return;
    }

    // 1. Next step
    if (
      text.includes('next') ||
      text.includes('continue') ||
      text.includes('forward')
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
      text.includes('back') ||
      text.includes('previous') ||
      text.includes('last step')
    ) {
      setActiveSection('steps');
      updateStep(prev => {
        const back = Math.max(0, prev - 1);
        speakCurrentStep(back);
        return back;
      });
      return;
    }

    // 3. Repeat / Read again / Tell me again
    if (
      text.includes('repeat') ||
      text.includes('say again') ||
      text.includes('read again') ||
      text.includes('tell me again') ||
      text.includes('what step') ||
      text.includes('what is the step')
    ) {
      setActiveSection('steps');
      speakCurrentStep(currentStep);
      return;
    }

    // 4. Read ingredients / show ingredients
    if (
      text.includes('ingredient') ||
      text.includes('what do i need')
    ) {
      speakIngredients();
      return;
    }

    // 5. Start steps / first step
    if (
      text.includes('start step') ||
      text.includes('first step') ||
      text.includes('step one') ||
      text.includes('begin cooking')
    ) {
      setActiveSection('steps');
      updateStep(0);
      speakCurrentStep(0);
      return;
    }

    // 6. Jump to specific step (e.g., "step 3", "go to step 2")
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

    // 7. Stop speaking / pause
    if (
      text.includes('quiet') ||
      text.includes('stop') ||
      text.includes('pause') ||
      text.includes('shut up') ||
      text.includes('shh') ||
      text.includes('silence')
    ) {
      stopSpeaking();
      setVoiceFeedback('Paused speech');
      return;
    }

    // 8. Close / exit cooking mode
    if (
      text === 'exit' ||
      text === 'close' ||
      text.includes('exit') ||
      text.includes('close') ||
      text.includes('quit') ||
      text.includes('leave') ||
      text.includes('done cooking') ||
      text.includes('finish')
    ) {
      handleExitCooking();
      return;
    }

    // 9. Anything else is an intelligent question for Chef AI!
    askCookingAssistant(rawTranscript);
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

  return (
    <div className="fixed inset-0 z-50 bg-[#120f0d] text-[#f5eedf] flex flex-col justify-between animate-fadeIn overflow-hidden">
      {/* Warm ambient kitchen glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar - Pann Warm Luxury Aesthetic */}
      <header className="p-4 sm:p-5 border-b border-[#2d221a] bg-[#1a1411]/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-700/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold shadow-lg">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {dayOfWeek} • Sensorial Voice Coach
              </span>
              <span className="text-xs text-stone-400 hidden sm:inline">
                Prep: {recipe.prep_time_mins}m | Cook: {recipe.cook_time_mins}m
              </span>
            </div>
            <h1 className="text-base sm:text-xl font-serif font-bold text-white truncate max-w-sm sm:max-w-md mt-0.5">
              {recipe.title}
            </h1>
          </div>
        </div>

        {/* Cookware Picker & Controls */}
        <div className="flex items-center gap-2">
          {/* Cookware Selector Pill */}
          <div className="hidden md:flex items-center bg-[#251d17] border border-[#3e3025] rounded-xl p-0.5 text-xs">
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
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  cookware === cw.id
                    ? 'bg-amber-500 text-stone-950 font-bold'
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
            className="px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-950/40 cursor-pointer transition animate-pulse"
            title="Panic Rescue - Instant troubleshooting advice"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span className="hidden sm:inline">Panic Rescue</span>
          </button>

          {/* Audio speech test / un-mute */}
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
            className={`p-2.5 rounded-xl border transition cursor-pointer ${
              autoSpeak
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-[#251d17] text-stone-400 border-[#3e3025]'
            }`}
            title={autoSpeak ? "Voice Audio is On" : "Voice Audio is Muted"}
          >
            {autoSpeak ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Hands-Free Mic Toggle */}
          <button
            type="button"
            onClick={toggleHandsFree}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition cursor-pointer ${
              isListening
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-lg shadow-amber-950'
                : 'bg-[#251d17] text-stone-400 border-[#3e3025] hover:text-white'
            }`}
          >
            {isListening ? (
              <>
                <Mic className="w-4 h-4 text-amber-400 animate-bounce" />
                <span className="hidden sm:inline">Listening...</span>
              </>
            ) : (
              <>
                <MicOff className="w-4 h-4" />
                <span className="hidden sm:inline">Start Mic</span>
              </>
            )}
          </button>

          {/* Help toggle */}
          <button
            type="button"
            onClick={() => setShowHelp(prev => !prev)}
            className="p-2.5 text-stone-400 hover:text-white rounded-xl bg-[#251d17] border border-[#3e3025] transition cursor-pointer"
            title="Voice Commands Help"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={handleExitCooking}
            className="p-2.5 text-stone-400 hover:text-white rounded-xl bg-[#251d17] border border-[#3e3025] transition cursor-pointer"
            title="Exit Cooking Mode"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Voice Assistant Status Banner */}
      <div className="bg-[#17120f] border-b border-[#2d221a] px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-stone-300 shrink-0 z-10">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0 bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-500/30">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-amber-300 font-semibold">{voiceFeedback}</span>
          </div>
          {lastHeard && (
            <div className="bg-[#241c17] px-2.5 py-1 rounded-lg border border-[#3a2c22] text-stone-300">
              Heard: <strong className="text-amber-200">"{lastHeard}"</strong>
            </div>
          )}
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
          <button
            onClick={() => setActiveSection('ingredients')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeSection === 'ingredients'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-[#221a15] text-stone-400 hover:text-white'
            }`}
          >
            Ingredients ({ingredients.length})
          </button>
          <button
            onClick={() => setActiveSection('steps')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeSection === 'steps'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-[#221a15] text-stone-400 hover:text-white'
            }`}
          >
            Steps ({steps.length})
          </button>
        </div>
      </div>

      {/* Main Content Stage - Optimized for 11" Tablet Countertop Viewing */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col max-w-5xl mx-auto w-full z-10">
        {showHelp && (
          <div className="bg-amber-950/80 border border-amber-500/50 rounded-2xl p-4 sm:p-5 mb-5 text-xs text-amber-200 space-y-2 animate-fadeIn shrink-0">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Sensorial Voice Commands & Rescue Phrases:</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <div>• <strong className="text-white">"Next":</strong> Advance to next step</div>
              <div>• <strong className="text-white">"Back":</strong> Previous step</div>
              <div>• <strong className="text-white">"Repeat":</strong> Re-read current step with sensory cues</div>
              <div>• <strong className="text-white">"Panic Phrases":</strong> Say "My pan is smoking!", "Food is sticking!", or "Help!"</div>
              <div>• <strong className="text-white">"Ask Questions":</strong> e.g. "Can I swap sour cream?", "How brown should this get?"</div>
            </div>
          </div>
        )}

        {/* 🚨 Mid-Cook Panic Rescue Overlay */}
        {panicRescue && (
          <div className="mb-5 bg-gradient-to-r from-rose-950/95 via-red-950/90 to-[#1c1210] border-2 border-rose-500/80 rounded-3xl p-5 sm:p-6 shadow-2xl animate-fadeIn shrink-0">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-rose-800/40">
              <div className="flex items-center gap-2 text-rose-300">
                <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
                <span className="font-bold uppercase tracking-wider text-xs">Kitchen Rescue Strategy</span>
              </div>
              <button
                onClick={() => setPanicRescue(null)}
                className="text-stone-400 hover:text-white text-xs underline"
              >
                Dismiss
              </button>
            </div>
            <p className="text-base sm:text-lg text-white font-serif leading-relaxed mb-3">
              {panicRescue.advice}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => speak(panicRescue.advice)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600/40 hover:bg-rose-600 text-rose-100 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>Repeat Rescue Advice</span>
              </button>
            </div>
          </div>
        )}

        {/* Live AI Speech & Answer Bubble */}
        {(aiResponse || isThinking) && !panicRescue && (
          <div className="mb-5 bg-gradient-to-r from-[#201813] via-[#2a1f18] to-[#1a1410] border-2 border-amber-500/60 rounded-3xl p-5 sm:p-6 shadow-2xl animate-fadeIn shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2.5 border-b border-[#473629]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                  <Bot className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Chef AI Answer</span>
              </div>
              {lastHeard && (
                <div className="text-xs text-amber-200/90 bg-amber-950/40 border border-amber-600/30 px-3 py-1 rounded-xl">
                  You asked: <span className="font-medium text-white italic">"{lastHeard}"</span>
                </div>
              )}
            </div>

            {isThinking ? (
              <div className="flex items-center gap-3 py-2 text-sm text-amber-200 font-medium">
                <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                <span>Chef is formulating advice...</span>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <p className="text-base sm:text-lg text-stone-100 font-serif leading-relaxed whitespace-pre-line flex-1">
                  {aiResponse}
                </p>
                <button
                  type="button"
                  onClick={() => aiResponse && speak(aiResponse)}
                  className="p-3 rounded-2xl bg-amber-600/40 hover:bg-amber-600 text-amber-200 hover:text-white transition cursor-pointer shrink-0 border border-amber-500/40 shadow-lg"
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
            <div className="flex items-center justify-between text-xs text-stone-400">
              <span className="font-bold uppercase tracking-wider text-amber-400">
                Step {currentStep + 1} of {steps.length} • {cookware.replace('_', ' ').toUpperCase()} AWARE
              </span>
              <span>Say "Next" or tap arrows</span>
            </div>

            {/* Giant Step Card for easy 11" tablet viewing across the kitchen counter */}
            <div className="bg-[#181310]/90 border border-[#3b2d22] rounded-3xl p-6 sm:p-12 shadow-2xl relative overflow-hidden">
              <div className="flex items-start gap-5 sm:gap-8">
                <span className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-stone-950 font-black text-2xl sm:text-4xl flex items-center justify-center shrink-0 shadow-xl shadow-amber-950">
                  {currentStep + 1}
                </span>
                <div className="space-y-4 flex-1">
                  <p className="text-xl sm:text-3xl font-serif font-medium text-white leading-relaxed sm:leading-loose">
                    {currentStepText}
                  </p>

                  {/* Sensorial coaching callout for cookware */}
                  {activeGuidance && (
                    <div className="bg-[#241a14] border border-amber-500/30 rounded-2xl p-4 text-xs sm:text-sm text-amber-200/90 flex items-start gap-3 mt-4">
                      <Flame className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block font-sans mb-0.5">Sensorial Cookware Coach:</strong>
                        <span>{activeGuidance.tip}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#271d17] h-2.5 rounded-full overflow-hidden mt-8">
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
                      ? 'bg-amber-500 text-stone-950 shadow-lg shadow-amber-950 scale-110 font-black'
                      : 'bg-[#251d17] text-stone-400 hover:bg-[#34271f] hover:text-white border border-[#382b20]'
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
              <h2 className="text-base sm:text-xl font-serif font-bold text-white flex items-center gap-2">
                <List className="w-5 h-5 text-amber-400" />
                <span>Ingredients for {recipe.title}</span>
              </h2>
              <button
                onClick={() => {
                  setActiveSection('steps');
                  speakCurrentStep(0);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold transition cursor-pointer shadow-lg"
              >
                Start Step 1
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {ingredients.map((ing, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-[#191310] border border-[#34261d] rounded-2xl flex items-center justify-between gap-3 shadow-md"
                >
                  <span className="font-semibold text-stone-200 text-sm">{ing.name}</span>
                  <span className="font-mono text-xs text-amber-300 bg-[#251b14] px-3 py-1 rounded-xl border border-[#443325] shrink-0 font-bold">
                    {ing.amount} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Big Bottom Action Controls - Tablet Optimized */}
      <footer className="p-4 sm:p-6 border-t border-[#2d221a] bg-[#1a1411]/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-10">
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
          className="px-5 sm:px-8 py-4 rounded-2xl bg-[#241c17] hover:bg-[#34271f] disabled:opacity-30 text-stone-200 text-sm sm:text-base font-bold flex items-center gap-2 transition cursor-pointer border border-[#3a2c21] shadow-lg"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Previous</span>
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
          className="px-5 sm:px-8 py-4 rounded-2xl bg-[#241c17] hover:bg-[#34271f] text-amber-400 text-sm sm:text-base font-bold flex items-center gap-2 transition cursor-pointer border border-amber-500/30 shadow-lg"
        >
          <RotateCcw className="w-5 h-5" />
          <span>Repeat Step</span>
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
          className="px-7 sm:px-10 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 text-sm sm:text-base font-bold flex items-center gap-2 transition cursor-pointer shadow-xl shadow-amber-950 font-black"
        >
          <span>{currentStep === steps.length - 1 ? 'Done Cooking' : 'Next Step'}</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
};
