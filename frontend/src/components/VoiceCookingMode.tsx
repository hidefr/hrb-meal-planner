import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, ChevronRight, ChevronLeft,
  X, Check, RotateCcw, Sparkles, ChefHat, Clock, Users,
  List, Play, Pause, ArrowRight, HelpCircle, Bot, Loader2, MessageSquare,
  AlertTriangle, ShieldAlert, Flame, Info, Sun, Moon, Gauge
} from 'lucide-react';
import { Recipe } from '../types';
import { useSpeechSynthesis } from '../services/useSpeechSynthesis';
import { askVoiceAssistant, sendChatMessage, VoiceConversationTurn } from '../services/api';
import { SpeechRecognition as NativeSpeechRecognition } from '@capacitor-community/speech-recognition';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';

interface VoiceCookingModeProps {
  recipe: Recipe;
  dayOfWeek: string;
  onClose: () => void;
  onSwitchDay?: (day: string) => void;
  onRecipeUpdated?: (updatedRecipe: Recipe) => void;
}

type CookwareType = 'stainless' | 'cast_iron' | 'nonstick' | 'sheet_pan';

export const VoiceCookingMode: React.FC<VoiceCookingModeProps> = ({
  recipe: initialRecipe,
  dayOfWeek,
  onClose,
  onSwitchDay,
  onRecipeUpdated,
}) => {
  const [currentRecipe, setCurrentRecipe] = useState<Recipe>(initialRecipe);
  const stepStorageKey = `tastecraft_cooking_step_${currentRecipe.id || currentRecipe.title}`;
  
  // Track saved step from previous session
  const [savedStep] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(stepStorageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch {}
    return 0;
  });

  // Track session start gate and resume prompt:
  // If savedStep > 0, show prompt to continue vs start over.
  // If savedStep === 0, show "Begin" screen/button before starting audio/hands-free.
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [showResumeModal, setShowResumeModal] = useState<boolean>(() => savedStep > 0);

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
  const [isPaused, setIsPaused] = useState(false);

  // Hotword AI trigger state: when user says "Cookie", "Chef", or "Hey Chef", we await their question
  const [isAwaitingQuestion, setIsAwaitingQuestion] = useState(false);
  const isAwaitingQuestionRef = useRef(false);
  const awaitingQuestionTimerRef = useRef<any>(null);

  // Multi-turn Conversational Memory for cooking session (e.g. asking substitute then saying "yes add that")
  const [conversationHistory, setConversationHistory] = useState<VoiceConversationTurn[]>([]);
  const conversationHistoryRef = useRef<VoiceConversationTurn[]>([]);

  // Busy/Processing state: prevents voice command overloading while Chef is calculating or responding
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const isProcessingCommandRef = useRef(false);

  const { speak, stop: stopSpeaking, pause: pauseSpeaking, resume: resumeSpeaking, isSpeakingRef } = useSpeechSynthesis();
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const isThinkingRef = useRef(false);
  const isClosedRef = useRef(false);
  const responseCardRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when Chef responds or starts thinking
  useEffect(() => {
    if (aiResponse || isThinking) {
      setTimeout(() => {
        responseCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }, [aiResponse, isThinking]);

  const steps = currentRecipe.instructions || [];
  const ingredients = currentRecipe.ingredients || [];

  // Cookware adaptive tips & sensorial cues - only show when relevant on step 1 (preheating/heating pan)
  const getCookwareGuidance = (stepText: string, stepIdx: number): { tip: string; cue: string } | null => {
    // Only show sensorial cookware guidance on the initial heating/prep step, not on every page
    if (stepIdx > 1) return null;
    const lower = stepText.toLowerCase();
    const isHeatStep = lower.includes('heat') || lower.includes('sear') || lower.includes('oil') || lower.includes('preheat') || lower.includes('pan') || lower.includes('skillet');
    
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
  const wakeLockRef = useRef<any>(null);

  const requestScreenKeepAwake = async () => {
    // 1. Native Android via Capacitor KeepAwake plugin
    try {
      await KeepAwake.keepAwake();
    } catch (e) {
      // Ignore if on web or unsupported
    }

    // 2. Web Screen Wake Lock API (Chrome on Android / Tablet / Desktop)
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (e) {
      // Wake lock request can fail if device battery saver is active
    }
  };

  const releaseScreenKeepAwake = async () => {
    // 1. Release Native KeepAwake
    try {
      await KeepAwake.allowSleep();
    } catch (e) {}

    // 2. Release Web Screen Wake Lock
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (e) {}
  };

  // Terminate voice speech & recognition & restore device sleep
  const terminateAll = useCallback(() => {
    isClosedRef.current = true;
    isListeningRef.current = false;
    isThinkingRef.current = false;
    isProcessingCommandRef.current = false;
    setIsProcessingCommand(false);
    setIsListening(false);

    releaseScreenKeepAwake();

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

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    try {
      localStorage.removeItem('tastecraft_cooking_mode');
    } catch {}
  }, [stopSpeaking]);

  const handleExitCooking = useCallback(() => {
    try {
      localStorage.removeItem('tastecraft_cooking_mode');
    } catch {}
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
    setIsPaused(false);

    // Speak purely the instruction text so words highlight 1:1 in sync without drifting!
    const speechScript = stepText;

    if (autoSpeak) {
      let lastReportedWordIdx = -1;
      const stepWordCount = Math.max(1, stepText.split(/\s+/).filter(Boolean).length);

      speak(
        speechScript,
        () => {
          lastReportedWordIdx = -1;
          setSpeechProgress(0);
        },
        () => {
          lastReportedWordIdx = -1;
          setSpeechProgress(1.0);
          setIsPaused(false);
        },
        'en-US-AvaNeural',
        voiceSpeed,
        (progress) => {
          const wIdx = Math.floor(progress * stepWordCount);
          if (wIdx !== lastReportedWordIdx) {
            lastReportedWordIdx = wIdx;
            setSpeechProgress(progress);
          }
        }
      );
    }
  }, [steps, autoSpeak, speak, voiceSpeed]);

  const handleTogglePause = useCallback(() => {
    if (isPaused) {
      resumeSpeaking();
      setIsPaused(false);
      setVoiceFeedback('Resumed reading');
    } else {
      pauseSpeaking();
      setIsPaused(true);
      setVoiceFeedback('⏸️ Paused');
    }
  }, [isPaused, resumeSpeaking, pauseSpeaking]);

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
      const prompt = `[TASTECRAFT EMERGENCY PANIC RESCUE]: The cook is mid-recipe cooking "${currentRecipe.title}" on ${cookware}. CURRENT STEP: "${steps[currentStep]}". THE COOK CRIED OUT IN PANIC: "${issuePhrase}". Give an immediate, calm, 2-sentence culinary rescue instruction right now: tell them what to pull off the burner or adjust, and how to save the dish. Do not lecture. Be the calm Gordon Ramsay / friendly coach.`;
      
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
  }, [currentRecipe.title, cookware, steps, currentStep, stopSpeaking, speak]);

  // Query AI for cooking advice, ingredient substitutes, timer questions, or general recipe questions
  const askCookingAssistant = useCallback(async (query: string) => {
    if (isThinkingRef.current || isClosedRef.current) return;
    isThinkingRef.current = true;
    setIsThinking(true);
    isProcessingCommandRef.current = true;
    setIsProcessingCommand(true);
    setVoiceFeedback(`Chef is thinking...`);

    // Stop current reading immediately so user hears the chef's answer clearly
    stopSpeaking();

    try {
      const currentStepText = steps[currentStep] || "";
      const ingList = ingredients.map(i => `${i.amount} ${i.unit} ${i.name}`);

      // Record user turn in conversation history
      const currentHistory = [...conversationHistoryRef.current, { role: 'user' as const, content: query }];
      conversationHistoryRef.current = currentHistory;
      setConversationHistory(currentHistory);

      // Call dedicated ultra-fast voice endpoint with multi-turn history
      const res = await askVoiceAssistant({
        query,
        recipe_title: currentRecipe.title,
        current_step: currentStepText,
        step_number: currentStep + 1,
        cookware,
        ingredients: ingList,
        instructions: steps,
        history: currentHistory.slice(-8),
      });

      if (isClosedRef.current) return;

      const answer = res.reply.replace(/[*#_~`]/g, '').trim();
      
      // Record assistant turn in conversation history
      const updatedHistory = [...conversationHistoryRef.current, { role: 'assistant' as const, content: answer }];
      conversationHistoryRef.current = updatedHistory;
      setConversationHistory(updatedHistory);

      setAiResponse(answer);
      setVoiceFeedback(`Chef: "${answer.slice(0, 30)}..."`);

      // 🌟 AUTOMATIC ON-THE-FLY INGREDIENT & RECIPE ADAPTATION
      let spokenAnswer = answer;
      if (res.ingredient_update && res.ingredient_update.new_name) {
        const { old_name, new_name, new_amount, new_unit, notes } = res.ingredient_update;
        
        // Ensure the spoken response clearly mentions what was substituted if the answer didn't already
        const lowerAnswer = answer.toLowerCase();
        const lowerNew = new_name.toLowerCase();
        if (!lowerAnswer.includes(lowerNew) && !lowerAnswer.includes('substitute') && !lowerAnswer.includes('replace') && !lowerAnswer.includes('added')) {
          spokenAnswer = old_name
            ? `Substituted ${old_name} with ${new_name} in your recipe cards. ${answer}`
            : `Added ${new_name} to your recipe cards. ${answer}`;
        }

        setCurrentRecipe(prev => {
          const oldClean = (old_name || '').toLowerCase().trim();
          let matched = false;

          // 1. Try exact or substring match
          let updatedIngredients = (prev.ingredients || []).map(ing => {
            const ingLower = ing.name.toLowerCase().trim();
            if (
              !matched &&
              oldClean &&
              (ingLower === oldClean || ingLower.includes(oldClean) || oldClean.includes(ingLower))
            ) {
              matched = true;
              return {
                ...ing,
                name: new_name,
                amount: new_amount !== null && new_amount !== undefined ? new_amount : ing.amount,
                unit: new_unit || ing.unit,
                notes: notes ? `${notes} (substituted for ${ing.name})` : (ing.notes || `substituted for ${ing.name}`)
              };
            }
            return ing;
          });

          // 2. Fallback word match if not matched yet (e.g. "honey" matches "clover honey" or "pure raw honey")
          if (!matched && oldClean) {
            const oldWords = oldClean.split(/\s+/).filter(w => w.length > 2);
            updatedIngredients = (prev.ingredients || []).map(ing => {
              const ingLower = ing.name.toLowerCase().trim();
              if (!matched && oldWords.some(w => ingLower.includes(w))) {
                matched = true;
                return {
                  ...ing,
                  name: new_name,
                  amount: new_amount !== null && new_amount !== undefined ? new_amount : ing.amount,
                  unit: new_unit || ing.unit,
                  notes: notes ? `${notes} (substituted for ${ing.name})` : (ing.notes || `substituted for ${ing.name}`)
                };
              }
              return ing;
            });
          }

          // 3. If no existing ingredient was replaced, add the new ingredient!
          if (!matched) {
            updatedIngredients.push({
              name: new_name,
              amount: new_amount || 1,
              unit: new_unit || 'item',
              category: 'Pantry',
              notes: notes || undefined
            });
          }

          // Also adapt recipe instructions if they mention the old ingredient
          const oldTarget = oldClean || (matched ? old_name : '');
          const oldRegex = oldTarget && oldTarget.trim() ? new RegExp(`\\b${oldTarget.trim()}\\b`, 'gi') : null;
          const updatedInstructions = (prev.instructions || []).map(inst => {
            if (oldRegex && oldRegex.test(inst)) {
              return inst.replace(oldRegex, new_name);
            }
            return inst;
          });

          const adaptedRecipe: Recipe = {
            ...prev,
            ingredients: updatedIngredients,
            instructions: updatedInstructions,
          };

          // Propagate adapted recipe to parent so whole meal plan updates persistently
          if (onRecipeUpdated) {
            try {
              onRecipeUpdated(adaptedRecipe);
            } catch (e) {
              console.warn("Failed to propagate updated recipe:", e);
            }
          }

          return adaptedRecipe;
        });
      }

      setAiResponse(spokenAnswer);
      setVoiceFeedback(`Chef: "${spokenAnswer.slice(0, 32)}..."`);

      if (autoSpeak) {
        speak(
          spokenAnswer,
          undefined,
          () => {
            // Unblock processing once answer finishes speaking
            isProcessingCommandRef.current = false;
            setIsProcessingCommand(false);
          },
          'en-US-AvaNeural',
          voiceSpeed
        );
      } else {
        isProcessingCommandRef.current = false;
        setIsProcessingCommand(false);
      }
    } catch (err) {
      if (isClosedRef.current) return;
      console.error("Fast voice assistant query failed, falling back to chat:", err);
      try {
        const currentStepText = steps[currentStep] || "None";
        const ingList = ingredients.map(i => `${i.amount} ${i.unit} ${i.name}`).join(', ');
        const prompt = `[CONTEXT: The user is cooking "${currentRecipe.title}". Step #${currentStep + 1}: "${currentStepText}". Cookware: ${cookware}. Ingredients: ${ingList}]. USER ASKS VIA VOICE: "${query}". Answer in 1 to 2 short sentences.`;
        const res = await sendChatMessage(prompt);
        if (isClosedRef.current) return;
        const answer = res.reply.replace(/[*#_~`]/g, '').trim();
        setAiResponse(answer);
        setVoiceFeedback(`Chef answered`);
        if (autoSpeak) {
          speak(
            answer,
            undefined,
            () => {
              isProcessingCommandRef.current = false;
              setIsProcessingCommand(false);
            },
            'en-US-AvaNeural',
            voiceSpeed
          );
        } else {
          isProcessingCommandRef.current = false;
          setIsProcessingCommand(false);
        }
      } catch (fallbackErr) {
        if (isClosedRef.current) return;
        const fallback = "I couldn't reach the AI assistant right now. You can ask again in a moment.";
        setAiResponse(fallback);
        setVoiceFeedback('Assistant unavailable');
        if (autoSpeak) {
          speak(
            fallback,
            undefined,
            () => {
              isProcessingCommandRef.current = false;
              setIsProcessingCommand(false);
            },
            'en-US-AvaNeural',
            voiceSpeed
          );
        } else {
          isProcessingCommandRef.current = false;
          setIsProcessingCommand(false);
        }
      }
    } finally {
      isThinkingRef.current = false;
      setIsThinking(false);
    }
  }, [currentRecipe.title, currentStep, steps, ingredients, autoSpeak, speak, cookware, stopSpeaking, voiceSpeed, onRecipeUpdated]);

  // Handle Selective Voice Commands & Hotword-triggered AI Questions
  const handleVoiceCommand = useCallback((rawTranscript: string) => {
    if (isClosedRef.current) return;

    const text = rawTranscript.toLowerCase().trim();
    if (!text || text.length < 2) return;

    // Check if the utterance is an intentional command that should interrupt speaking
    const isInterruptIntent =
      isAwaitingQuestionRef.current ||
      text === 'pause' ||
      text === 'stop' ||
      text === 'quiet' ||
      text === 'silence' ||
      text.includes('pause') ||
      text.includes('stop speaking') ||
      text === 'next' ||
      text === 'next step' ||
      text === 'continue' ||
      text === 'back' ||
      text === 'previous' ||
      text === 'previous step' ||
      text === 'repeat' ||
      text === 'repeat step' ||
      text === 'reread' ||
      text.includes('reread') ||
      text.includes('chef') ||
      text.includes('tastecraft') ||
      text.includes('cookie') ||
      text.startsWith('what if') ||
      text.startsWith('can i substitute') ||
      text.startsWith('what can i use') ||
      text.startsWith('can i replace') ||
      text.startsWith('replace ') ||
      text.startsWith('substitute ') ||
      text.startsWith('swap ') ||
      text.includes('replace') ||
      text.includes('substitute') ||
      text.startsWith('yes add') ||
      text.startsWith('yes replace') ||
      text.startsWith('yes use') ||
      text.startsWith('add ') ||
      text.startsWith('how long') ||
      text.startsWith('how do i know') ||
      text.includes('smoke') ||
      text.includes('smoking') ||
      text.includes('burning') ||
      text.includes('burn') ||
      text.includes('sticking') ||
      text.includes('stuck') ||
      text.includes('panic');

    // If app is speaking and the transcript is NOT a user command/question, ignore as echo!
    if (isSpeakingRef.current && !isInterruptIntent) {
      console.log("Ignoring echo input while speaking:", rawTranscript);
      return;
    }

    // If awaiting question and user started speaking their query, cut off any ongoing prompt ("I'm listening...") immediately!
    if (isAwaitingQuestionRef.current && isSpeakingRef.current) {
      stopSpeaking();
    }

    // Capacity & Flow Guard: If Chef is already thinking, formulating advice, or doing an AI query,
    // only allow immediate safety/interruption commands ('stop', 'pause', 'panic', 'exit').
    // Reject other speech so the app never gets overwhelmed or backlogged!
    if (isProcessingCommandRef.current || isThinkingRef.current) {
      const isUrgentOverride =
        text === 'stop' ||
        text === 'pause' ||
        text.includes('panic') ||
        text.includes('smoke') ||
        text.includes('fire') ||
        text === 'exit';

      if (!isUrgentOverride) {
        console.log("Chef is currently busy processing; dropping extra command:", rawTranscript);
        setVoiceFeedback('Chef is working... please wait');
        return;
      }
    }

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

    // 0.5. Begin / Start Cooking or Start Over Voice Commands
    if (
      text === 'begin' ||
      text === 'start' ||
      text === 'start cooking' ||
      text === 'lets cook' ||
      text === "let's cook" ||
      text === 'begin cooking'
    ) {
      if (!hasStarted) {
        startCookingAtStep(currentStep);
        return;
      }
    }

    if (
      text === 'start over' ||
      text === 'restart' ||
      text === 'start from the beginning' ||
      text === 'start from step 1'
    ) {
      startCookingAtStep(0);
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
      if (!hasStarted) {
        startCookingAtStep(currentStep);
        return;
      }
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

    // 3. Repeat / Read again / Repeat step / Reread
    if (
      text === 'repeat' ||
      text === 'repeat step' ||
      text === 'say again' ||
      text === 'read again' ||
      text === 'reread' ||
      text.includes('reread') ||
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
      pauseSpeaking();
      setIsPaused(true);
      isProcessingCommandRef.current = false;
      setIsProcessingCommand(false);
      setVoiceFeedback('⏸️ Paused speech');
      return;
    }

    if (
      text === 'resume' ||
      text === 'continue reading' ||
      text === 'play'
    ) {
      resumeSpeaking();
      setIsPaused(false);
      setVoiceFeedback('▶️ Resumed speech');
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

    // 8. HOTWORD & TARGETED COOKING QUESTION DETECTION FOR AI CULINARY COACH:
    // To prevent ambient living room speech from accidentally triggering the chef,
    // we require either:
    // a) An explicit wake word ("Chef", "Hey Chef", "TasteCraft", "Hey TasteCraft", "Cookie")
    // b) An active follow-up window after wake-word was primed (isAwaitingQuestion)
    // c) An unmistakable direct culinary inquiry starting specifically with cooking substitution triggers
    const hasHotword =
      text.includes('hey chef') ||
      text.includes('chef') ||
      text.includes('tastecraft') ||
      text.includes('taste craft') ||
      text.includes('hey tastecraft') ||
      text.includes('hey taste craft') ||
      text.includes('cookie');

    // Narrow, unambiguous culinary question openers (cannot be confused with casual banter)
    const isExplicitCulinaryQuestion =
      text.startsWith("i don't have") ||
      text.startsWith("i dont have") ||
      text.startsWith("we don't have") ||
      text.startsWith("we dont have") ||
      text.startsWith("what if i don't have") ||
      text.startsWith("what if i dont have") ||
      text.startsWith("can i substitute") ||
      text.startsWith("what can i substitute") ||
      text.startsWith("what can i use instead of") ||
      text.startsWith("can i replace") ||
      text.startsWith("replace ") ||
      text.startsWith("substitute ") ||
      text.startsWith("swap ") ||
      text.startsWith("yes add") ||
      text.startsWith("yes replace") ||
      text.startsWith("yes use") ||
      text.startsWith("use ") ||
      text.startsWith("add ") ||
      text.startsWith("can we add") ||
      text.startsWith("can i add");

    if (hasHotword || isAwaitingQuestionRef.current || isExplicitCulinaryQuestion) {
      // Clean hotword from query
      let query = rawTranscript
        .replace(/\b(hey\s+tastecraft|hey\s+taste\s+craft|tastecraft|taste\s+craft|hey\s+chef|chef|cookie)\b/gi, '')
        .trim();

      if (!query || query.length < 3) {
        // Just the wake word spoken! Activate listening mode and prompt user
        isAwaitingQuestionRef.current = true;
        setIsAwaitingQuestion(true);
        setVoiceFeedback('Listening for your question...');
        speak("I'm listening, go ahead!", undefined, undefined, 'en-US-AvaNeural', voiceSpeed);
        if (awaitingQuestionTimerRef.current) clearTimeout(awaitingQuestionTimerRef.current);
        awaitingQuestionTimerRef.current = setTimeout(() => {
          isAwaitingQuestionRef.current = false;
          setIsAwaitingQuestion(false);
          setVoiceFeedback('Say "Next step" or "Hey Chef [question]"');
        }, 8000);
        return;
      }

      // Hotword accompanied by question, or explicit substitution question!
      isAwaitingQuestionRef.current = false;
      setIsAwaitingQuestion(false);
      if (awaitingQuestionTimerRef.current) clearTimeout(awaitingQuestionTimerRef.current);
      stopSpeaking();
      askCookingAssistant(query);
      return;
    }

    // Otherwise, intentionally ignore random kitchen banter / noise!
    console.log("Ignored non-command speech:", rawTranscript);
  }, [steps.length, currentStep, hasStarted, speakCurrentStep, speakIngredients, stopSpeaking, handleExitCooking, askCookingAssistant, isSpeakingRef, triggerPanicRescue]);

  const startHandsFreeRef = useRef<() => void>(() => {});

  // Start cooking at chosen step (either resumed step or step 0)
  const startCookingAtStep = useCallback((stepIdx: number) => {
    setHasStarted(true);
    setShowResumeModal(false);
    updateStep(stepIdx);
    setActiveSection('steps');

    if (steps.length > 0 && autoSpeak) {
      const isResuming = stepIdx > 0;
      const intro = isResuming
        ? `Welcome back to ${currentRecipe.title}. Resuming at step ${stepIdx + 1}. Cookware set to ${cookware.replace('_', ' ')}.`
        : `Cooking mode for ${currentRecipe.title}. Cookware set to ${cookware.replace('_', ' ')}.`;

      speak(
        intro,
        () => setVoiceFeedback(`Starting at Step ${stepIdx + 1}...`),
        () => {
          if (!isClosedRef.current) {
            speakCurrentStep(stepIdx);
          }
        },
        'en-US-AvaNeural',
        voiceSpeed
      );
    }
    startHandsFreeRef.current();
  }, [currentRecipe.title, cookware, autoSpeak, speak, voiceSpeed, speakCurrentStep, steps.length]);
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
                const res = await NativeSpeechRecognition.start({
                  language: 'en-US',
                  maxResults: 1,
                  prompt: 'Say a command or ask a cooking question',
                  partialResults: false,
                  popup: false,
                });
                if (isClosedRef.current) break;
                if (res.matches && res.matches.length > 0) {
                  handleVoiceCommand(res.matches[0]);
                }
              } catch (e) {
                await new Promise(r => setTimeout(r, 600));
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

  startHandsFreeRef.current = startHandsFree;

  const toggleHandsFree = () => {
    if (isListening) {
      stopHandsFree();
    } else {
      startHandsFree();
    }
  };

  // Keep screen awake while in cooking mode
  useEffect(() => {
    isClosedRef.current = false;
    requestScreenKeepAwake();

    return () => {
      terminateAll();
    };
  }, [terminateAll]);

  const currentStepText = steps[currentStep] || "Enjoy your meal!";
  const activeGuidance = getCookwareGuidance(currentStepText, currentStep);

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

      {/* Top Header Bar - Tablet & Mobile Friendly (with safe area top for Android status bar) */}
      <header
        className={`px-4 pt-safe pb-3 sm:px-6 border-b backdrop-blur-md flex items-center justify-between gap-2 shrink-0 z-20 transition-colors ${
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
                Prep: {currentRecipe.prep_time_mins}m • Cook: {currentRecipe.cook_time_mins}m
              </span>
            </div>
            <h1
              className={`text-sm sm:text-lg md:text-xl font-serif font-bold truncate max-w-[180px] sm:max-w-xs md:max-w-md ${
                theme === 'light' ? 'text-[#2C2117]' : 'text-white'
              }`}
            >
              {currentRecipe.title}
            </h1>
          </div>
        </div>

        {/* Right Controls: Speed, Cookware, Panic, Audio, Mic, and Prominent Exit */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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

          {/* Cookware Selector Pill (Visible across screen widths) */}
          <div
            className={`flex items-center rounded-xl p-0.5 border text-xs ${
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

          {/* Panic Button - Subtle & Compact */}
          <button
            type="button"
            onClick={() => triggerPanicRescue("Help! My pan is smoking and food is sticking!")}
            className={`p-2 sm:px-2.5 sm:py-2 rounded-xl text-xs font-semibold flex items-center gap-1 border transition cursor-pointer active:scale-95 ${
              theme === 'light'
                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                : 'bg-rose-950/40 text-rose-400 border-rose-900/40 hover:bg-rose-900/50'
            }`}
            title="Kitchen Rescue - Instant help for smoking, burning, or sticking"
          >
            <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="hidden lg:inline text-[11px]">Rescue</span>
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
            className={`flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg border transition-all ${
              isProcessingCommand || isThinking
                ? theme === 'light'
                  ? 'bg-amber-100 text-amber-950 border-amber-400 font-bold shadow-xs animate-pulse'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold shadow-xs animate-pulse'
                : theme === 'light'
                ? 'bg-white text-amber-900 border-amber-300/80 shadow-xs'
                : 'bg-amber-950/60 text-amber-300 border-amber-500/30'
            }`}
          >
            {isProcessingCommand || isThinking ? (
              <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )}
            <span className="font-semibold">{voiceFeedback}</span>
          </div>

          {(isProcessingCommand || isThinking) && (
            <div className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1 animate-pulse">
              <span>⏳ Chef busy responding — please wait a second</span>
            </div>
          )}

          {isAwaitingQuestion && (
            <div className="px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 font-bold text-[10px] animate-pulse">
              TasteCraft listening... speak your question now!
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

      {/* Main Content Stage - Optimized for Phone & 11" Tablet Countertop Viewing (Portrait & Landscape) */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-2 sm:py-4 flex flex-col max-w-5xl mx-auto w-full z-10 pl-safe pr-safe">
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
              <div>• <strong className="font-bold">"TasteCraft [question]" or "Chef":</strong> Wakes AI for tailored cooking answers</div>
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
            ref={responseCardRef}
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
                  TasteCraft AI Culinary Coach
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

        {/* 🌟 RESUME VS START OVER MODAL (Prompt when entering recipe with saved progress) */}
        {showResumeModal && savedStep > 0 && !hasStarted && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div
              className={`w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border text-center space-y-5 animate-scaleUp transition-colors ${
                theme === 'light'
                  ? 'bg-[#FFFDF9] border-amber-300 text-[#2C2117]'
                  : 'bg-[#221A15] border-[#4A382A] text-[#F5EEDB]'
              }`}
            >
              <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center border border-amber-500/30 shadow-inner">
                <CookieLogo className="w-10 h-10" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl sm:text-2xl font-serif font-black">
                  Welcome Back!
                </h3>
                <p className={`text-xs sm:text-sm ${theme === 'light' ? 'text-[#7D6B58]' : 'text-stone-300'}`}>
                  You were on <strong className="text-amber-600 dark:text-amber-400 font-bold">Step {savedStep + 1}</strong> of {steps.length} for <br className="hidden sm:inline" />"{currentRecipe.title}".
                </p>
                <p className={`text-xs font-semibold ${theme === 'light' ? 'text-amber-900' : 'text-amber-300'}`}>
                  Would you like to continue or start over?
                </p>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => startCookingAtStep(savedStep)}
                  className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 transition cursor-pointer active:scale-95"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Continue at Step {savedStep + 1}</span>
                </button>

                <button
                  type="button"
                  onClick={() => startCookingAtStep(0)}
                  className={`w-full py-3 px-5 rounded-2xl border font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 ${
                    theme === 'light'
                      ? 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-300'
                      : 'bg-[#2E241E] hover:bg-[#3D2E24] text-stone-300 border-[#473627]'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Start Over from Beginning (Step 1)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 🌟 WELCOME & BEGIN BANNER (When cooking hasn't started yet) */}
        {!hasStarted && !showResumeModal && (
          <div
            className={`mb-6 border-2 rounded-3xl p-5 sm:p-7 shadow-xl animate-fadeIn shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors ${
              theme === 'light'
                ? 'bg-gradient-to-r from-amber-50 via-white to-amber-50/60 border-amber-300 text-amber-950 shadow-amber-900/5'
                : 'bg-gradient-to-r from-[#2A1E16] via-[#241A13] to-[#1E150F] border-amber-500/50 text-stone-100 shadow-2xl'
            }`}
          >
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-inner">
                <ChefHat className="w-7 h-7 sm:w-8 sm:h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-serif font-bold">
                  Ready to cook "{currentRecipe.title}"?
                </h3>
                <p className={`text-xs ${theme === 'light' ? 'text-[#7D6B58]' : 'text-stone-300'}`}>
                  Get your ingredients prepped and cookware ready. Tap <strong>Begin</strong> or say <strong>"Begin"</strong> when you're ready!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => startCookingAtStep(0)}
              className="px-6 sm:px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-sm sm:text-base flex items-center gap-2 shadow-xl shadow-amber-600/30 transition cursor-pointer active:scale-95 shrink-0"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Begin Cooking</span>
            </button>
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
                <span>Ingredients for {currentRecipe.title}</span>
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
        className={`px-3 sm:px-6 md:px-8 py-2.5 sm:py-3.5 landscape:py-1.5 pb-safe border-t backdrop-blur-md flex items-center justify-between gap-2 sm:gap-4 shrink-0 z-10 transition-colors pl-safe pr-safe ${
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
          className={`px-3 sm:px-6 md:px-8 py-3 sm:py-4 landscape:py-1.5 landscape:px-3 rounded-xl sm:rounded-2xl disabled:opacity-30 text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 sm:gap-2 transition cursor-pointer border shadow-md shrink-0 ${
            theme === 'light'
              ? 'bg-white hover:bg-stone-50 text-stone-800 border-[#DED3BD]'
              : 'bg-[#291F18] hover:bg-[#34271D] text-stone-200 border-[#423223]'
          }`}
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Prev</span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            type="button"
            onClick={handleTogglePause}
            className={`px-3 sm:px-6 md:px-7 py-3 sm:py-4 landscape:py-1.5 landscape:px-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 sm:gap-2 transition cursor-pointer border shadow-md shrink-0 ${
              isPaused
                ? 'bg-amber-500 hover:bg-amber-600 text-stone-950 border-amber-600 shadow-amber-500/20 animate-pulse'
                : theme === 'light'
                ? 'bg-white hover:bg-stone-50 text-stone-800 border-[#DED3BD]'
                : 'bg-[#291F18] hover:bg-[#34271D] text-stone-200 border-[#423223]'
            }`}
            title={isPaused ? "Resume Reading" : "Pause Reading"}
          >
            {isPaused ? <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
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
            className={`px-3 sm:px-6 md:px-8 py-3 sm:py-4 landscape:py-1.5 landscape:px-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 sm:gap-2 transition cursor-pointer border shadow-md shrink-0 ${
              theme === 'light'
                ? 'bg-white hover:bg-stone-50 text-amber-900 border-amber-300'
                : 'bg-[#291F18] hover:bg-[#34271D] text-amber-300 border-amber-500/30'
            }`}
          >
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline">Repeat</span>
            <span className="xs:hidden">Re-read</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!hasStarted) {
              startCookingAtStep(currentStep);
            } else if (activeSection === 'ingredients') {
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
          className="px-4 sm:px-8 md:px-10 py-3 sm:py-4 landscape:py-1.5 landscape:px-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 text-xs sm:text-sm md:text-base font-black flex items-center gap-1.5 sm:gap-2 transition cursor-pointer shadow-xl shadow-amber-950/20 shrink-0 active:scale-95"
        >
          <span>{!hasStarted ? 'Begin' : currentStep === steps.length - 1 ? 'Done' : 'Next Step'}</span>
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </footer>
    </div>
  );
};
