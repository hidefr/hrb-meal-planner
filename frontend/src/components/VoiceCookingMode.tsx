import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, ChevronRight, ChevronLeft,
  X, Check, RotateCcw, Sparkles, ChefHat, Clock, Users,
  List, Play, ArrowRight, HelpCircle
} from 'lucide-react';
import { Recipe } from '../types';
import { useSpeechSynthesis } from '../services/useSpeechSynthesis';

interface VoiceCookingModeProps {
  recipe: Recipe;
  dayOfWeek: string;
  onClose: () => void;
  onSwitchDay?: (day: string) => void;
}

export const VoiceCookingMode: React.FC<VoiceCookingModeProps> = ({
  recipe,
  dayOfWeek,
  onClose,
  onSwitchDay,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [activeSection, setActiveSection] = useState<'ingredients' | 'steps'>('steps');
  const [isListening, setIsListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string>('Say "Next step", "Read ingredients", or "Repeat"');
  const [lastHeard, setLastHeard] = useState<string>('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  const { speak, stop: stopSpeaking } = useSpeechSynthesis();
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  const steps = recipe.instructions || [];
  const ingredients = recipe.ingredients || [];

  // Read current step aloud
  const speakCurrentStep = useCallback((stepIdx: number) => {
    if (stepIdx < 0 || stepIdx >= steps.length) return;
    const stepText = steps[stepIdx];
    setVoiceFeedback(`Step ${stepIdx + 1} of ${steps.length}`);
    if (autoSpeak) {
      speak(`Step ${stepIdx + 1}. ${stepText}`);
    }
  }, [steps, autoSpeak, speak]);

  // Read all ingredients
  const speakIngredients = useCallback(() => {
    setActiveSection('ingredients');
    setVoiceFeedback(`Reading ingredients (${ingredients.length} items)`);
    if (autoSpeak) {
      const text = ingredients.map(i => `${i.amount} ${i.unit} ${i.name}`).join(', ');
      speak(`Here are the ingredients: ${text}. Say "Start steps" when you're ready.`);
    }
  }, [ingredients, autoSpeak, speak]);

  // Handle Voice Commands
  const handleVoiceCommand = useCallback((rawTranscript: string) => {
    const text = rawTranscript.toLowerCase().trim();
    setLastHeard(rawTranscript);

    // 1. Next step
    if (
      text.includes('next') ||
      text.includes('next step') ||
      text.includes('go forward') ||
      text.includes('continue')
    ) {
      setActiveSection('steps');
      setCurrentStep(prev => {
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
      text.includes('go back') ||
      text.includes('last step')
    ) {
      setActiveSection('steps');
      setCurrentStep(prev => {
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
      text.includes('tell me') ||
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
      text.includes('ingredients') ||
      text.includes('what do i need') ||
      text.includes('what ingredients')
    ) {
      speakIngredients();
      return;
    }

    // 5. Start steps / first step
    if (
      text.includes('start') ||
      text.includes('first step') ||
      text.includes('step one') ||
      text.includes('begin')
    ) {
      setActiveSection('steps');
      setCurrentStep(0);
      speakCurrentStep(0);
      return;
    }

    // 6. Jump to specific step (e.g., "step 3", "go to step 2")
    const stepMatch = text.match(/(?:step|go to step|number)\s*(\d+)/i);
    if (stepMatch && stepMatch[1]) {
      const targetStep = parseInt(stepMatch[1], 10) - 1;
      if (targetStep >= 0 && targetStep < steps.length) {
        setActiveSection('steps');
        setCurrentStep(targetStep);
        speakCurrentStep(targetStep);
        return;
      }
    }

    // 7. Stop speaking / pause
    if (
      text.includes('quiet') ||
      text.includes('stop') ||
      text.includes('pause') ||
      text.includes('shh') ||
      text.includes('silence')
    ) {
      stopSpeaking();
      setVoiceFeedback('Paused speech');
      return;
    }

    // 8. Close / exit cooking mode
    if (
      text.includes('exit') ||
      text.includes('close') ||
      text.includes('done cooking') ||
      text.includes('finish')
    ) {
      stopSpeaking();
      onClose();
      return;
    }

    // Unrecognized command
    setVoiceFeedback(`Heard: "${rawTranscript}". Try "Next", "Back", "Repeat", or "Ingredients".`);
  }, [steps.length, currentStep, speakCurrentStep, speakIngredients, stopSpeaking, onClose]);

  // Start continuous hands-free voice recognition
  const startHandsFree = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = navigator.language || 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        setVoiceFeedback('🎙️ Hands-free listening... Speak any command!');
      };

      rec.onresult = (event: any) => {
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
        // Automatically restart if user still wants hands-free active!
        if (isListeningRef.current) {
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
  }, [handleVoiceCommand]);

  const stopHandsFree = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
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

  // Initial read when opening
  useEffect(() => {
    if (steps.length > 0 && autoSpeak) {
      speak(`Cooking mode for ${recipe.title}. Step 1: ${steps[0]}`);
    }
    // Attempt auto-start hands-free listening
    startHandsFree();

    return () => {
      stopHandsFree();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md text-white flex flex-col justify-between animate-fadeIn overflow-hidden">
      {/* Top Header Bar */}
      <header className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {dayOfWeek} • Hands-Free Mode
              </span>
              <span className="text-xs text-slate-400">
                Prep: {recipe.prep_time_mins}m | Cook: {recipe.cook_time_mins}m
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-white truncate max-w-sm sm:max-w-md">
              {recipe.title}
            </h1>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-2">
          {/* Mute/Unmute audio narration */}
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
                ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title={autoSpeak ? "Audio narration active" : "Audio narration muted"}
          >
            {autoSpeak ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Hands-Free Mic Toggle */}
          <button
            type="button"
            onClick={toggleHandsFree}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition cursor-pointer ${
              isListening
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-lg shadow-rose-950 animate-pulse'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            {isListening ? (
              <>
                <Mic className="w-4 h-4 text-rose-400" />
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
            className="p-2.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 border border-slate-700 transition cursor-pointer"
            title="Voice Commands Help"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={() => {
              stopHandsFree();
              onClose();
            }}
            className="p-2.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 border border-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Voice Assistant Status Banner */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs text-slate-300 shrink-0">
        <div className="flex items-center gap-2 truncate">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-emerald-400 font-semibold">{voiceFeedback}</span>
          {lastHeard && (
            <span className="text-slate-500 truncate hidden md:inline">
              (Heard: "{lastHeard}")
            </span>
          )}
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setActiveSection('ingredients')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeSection === 'ingredients'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Ingredients ({ingredients.length})
          </button>
          <button
            onClick={() => setActiveSection('steps')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeSection === 'steps'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Steps ({steps.length})
          </button>
        </div>
      </div>

      {/* Main Content Stage */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col justify-center max-w-4xl mx-auto w-full">
        {showHelp && (
          <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-3xl p-5 mb-6 text-xs text-emerald-200 space-y-2 animate-fadeIn">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Hands-Free Voice Commands You Can Say:</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <div>• <strong className="text-white">"Next" / "Next step":</strong> Read and jump to next step</div>
              <div>• <strong className="text-white">"Back" / "Previous":</strong> Go back one step</div>
              <div>• <strong className="text-white">"Repeat" / "Say again":</strong> Re-read the current step</div>
              <div>• <strong className="text-white">"Ingredients":</strong> Read all ingredients aloud</div>
              <div>• <strong className="text-white">"Step 3":</strong> Jump directly to step 3</div>
              <div>• <strong className="text-white">"Stop" / "Quiet":</strong> Pause speech immediately</div>
              <div>• <strong className="text-white">"Close" / "Exit":</strong> Exit cooking mode</div>
            </div>
          </div>
        )}

        {activeSection === 'steps' ? (
          <div className="space-y-6 my-auto">
            {/* Step Progress & Indicators */}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold uppercase tracking-wider text-emerald-400">
                Step {currentStep + 1} of {steps.length}
              </span>
              <span>Say "Next" or tap arrows</span>
            </div>

            {/* Giant Step Card for easy reading from across the kitchen counter */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
              <div className="flex items-start gap-4 sm:gap-6">
                <span className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-emerald-600 text-white font-black text-xl sm:text-3xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-900/50">
                  {currentStep + 1}
                </span>
                <div className="space-y-3 flex-1">
                  <p className="text-lg sm:text-2xl font-medium text-slate-100 leading-relaxed sm:leading-loose">
                    {steps[currentStep] || "Enjoy your meal!"}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-8">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
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
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition cursor-pointer ${
                    currentStep === idx
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-950 scale-110'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
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
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <List className="w-5 h-5 text-emerald-400" />
                <span>Ingredients for {recipe.title}</span>
              </h2>
              <button
                onClick={() => {
                  setActiveSection('steps');
                  speakCurrentStep(0);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Start Step 1
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {ingredients.map((ing, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center justify-between gap-3"
                >
                  <span className="font-semibold text-slate-200 text-sm">{ing.name}</span>
                  <span className="font-mono text-xs text-emerald-400 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700 shrink-0">
                    {ing.amount} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Big Bottom Action Controls */}
      <footer className="p-4 sm:p-6 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={() => {
            setActiveSection('steps');
            setCurrentStep(prev => {
              const back = Math.max(0, prev - 1);
              speakCurrentStep(back);
              return back;
            });
          }}
          disabled={currentStep === 0 && activeSection === 'steps'}
          className="px-4 sm:px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-white text-sm font-bold flex items-center gap-2 transition cursor-pointer shadow-lg"
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
          className="px-4 sm:px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-sm font-bold flex items-center gap-2 transition cursor-pointer border border-emerald-500/30 shadow-lg"
        >
          <RotateCcw className="w-5 h-5" />
          <span>Repeat Step</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (activeSection === 'ingredients') {
              setActiveSection('steps');
              setCurrentStep(0);
              speakCurrentStep(0);
            } else if (currentStep < steps.length - 1) {
              setCurrentStep(prev => {
                const next = prev + 1;
                speakCurrentStep(next);
                return next;
              });
            } else {
              onClose();
            }
          }}
          className="px-6 sm:px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-2 transition cursor-pointer shadow-xl shadow-emerald-950"
        >
          <span>{currentStep === steps.length - 1 ? 'Done Cooking' : 'Next Step'}</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
};
