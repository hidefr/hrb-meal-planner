import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Trash2, Bot, User, CheckCircle2, ArrowRight } from 'lucide-react';
import { ChatMessage, MealPlan, GroceryList } from '../types';
import { sendChatMessage, clearChatHistory } from '../services/api';

interface ChatCopilotProps {
  messages: ChatMessage[];
  onMessageSent: (newHistory: ChatMessage[], newPlan: MealPlan, newGrocery: GroceryList) => void;
  onRefresh: () => void;
}

const QUICK_PROMPTS = [
  "✨ Plan 4 easy dinners for this week",
  "⏱️ Keep dinners under 30 minutes and one-pot",
  "🥗 We want healthy, high-protein & fresh veggies",
  "🥑 Low-carb comfort meals",
  "🔄 Swap Wednesday for a simple pasta",
  "🛒 Add oat milk, sourdough bread and eggs to grocery list"
];

export const ChatCopilot: React.FC<ChatCopilotProps> = ({
  messages,
  onMessageSent,
  onRefresh
}) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    const updatedMessages = [...messages, tempUserMsg];
    // temporarily trigger scroll
    setTimeout(scrollToBottom, 50);

    try {
      const res = await sendChatMessage(text);
      const asstMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toISOString(),
        applied_actions: res.actions_performed
      };
      onMessageSent([...updatedMessages, asstMsg], res.meal_plan, res.grocery_list);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.message}. Make sure your Hermes agent / backend is running.`,
        timestamp: new Date().toISOString()
      };
      onMessageSent([...updatedMessages, errorMsg], {} as any, {} as any);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm("Clear chat history? (Your meal plan and grocery list will stay intact)")) {
      await clearChatHistory();
      onRefresh();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header bar */}
      <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">AI Meal Planning Copilot</h2>
            <p className="text-[11px] text-slate-500">Converse naturally — I update your plan & grocery list live</p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs flex items-center gap-1 transition"
            title="Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Clear Chat</span>
          </button>
        )}
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
              <Bot className="w-8 h-8" />
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-semibold text-slate-900">What are we craving this week?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Tell me what ingredients you have, dietary goals, or how many nights you want to cook. I'll tailor the recipes and generate your grocery list.
              </p>
            </div>

            {/* Quick Inspiration Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg mt-4">
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="text-left p-2.5 text-xs text-slate-700 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-xl transition flex items-center justify-between group"
                >
                  <span className="truncate mr-2">{prompt}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-tr-xs'
                      : 'bg-slate-100/90 text-slate-800 rounded-tl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Actions performed badges */}
                  {msg.applied_actions && msg.applied_actions.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Live Updates Applied:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {msg.applied_actions.map((act, i) => (
                          <span
                            key={i}
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100/80 text-emerald-900 border border-emerald-200"
                          >
                            {act}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <span
                    className={`block text-[10px] mt-1 text-right ${
                      msg.role === 'user' ? 'text-emerald-100' : 'text-slate-400'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start items-center">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-slate-100 rounded-2xl rounded-tl-xs px-4 py-3 text-sm text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.4s]"></span>
                  <span className="text-xs ml-1 text-slate-600 font-medium">TasteCraft is thinking & planning...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input bar */}
      <div className="p-3 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type dinner ideas, constraints, or grocery additions..."
            className="flex-1 bg-slate-100 focus:bg-white border border-transparent focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition shadow-inner"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-sm transition flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
