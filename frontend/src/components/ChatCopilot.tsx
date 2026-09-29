import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Sparkles, Trash2, Bot, User, CheckCircle2, ArrowRight,
  Mic, MicOff, MessageSquare, Plus, ChevronDown, Edit2, Check
} from 'lucide-react';
import { ChatMessage, MealPlan, GroceryList, ConversationSummary, Conversation } from '../types';
import {
  sendChatMessage,
  fetchConversations,
  fetchConversation,
  createConversation,
  deleteConversation,
  renameConversation
} from '../services/api';
import { useSpeechRecognition } from '../services/useSpeechRecognition';

interface ChatCopilotProps {
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
  onMessageSent,
  onRefresh
}) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConvList, setShowConvList] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isListening, isSupported, toggleListening, stopListening } = useSpeechRecognition({
    onTranscriptChange: (text) => setInput(text),
    getCurrentText: () => input
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load conversations on mount
  const loadConversations = async () => {
    try {
      const list = await fetchConversations();
      setConversations(list);
      if (list.length > 0) {
        const firstId = list[0].id;
        setActiveConvId(firstId);
        const fullConv = await fetchConversation(firstId);
        setMessages(fullConv.messages);
      } else {
        const newC = await createConversation();
        setConversations([{
          id: newC.id,
          title: newC.title,
          created_at: newC.created_at,
          updated_at: newC.updated_at,
          message_count: 0,
          last_message_preview: "New chat"
        }]);
        setActiveConvId(newC.id);
        setMessages([]);
      }
    } catch (e) {
      console.error("Failed to load conversations:", e);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const handleSelectConversation = async (convId: string) => {
    if (convId === activeConvId) {
      setShowConvList(false);
      return;
    }
    setActiveConvId(convId);
    setShowConvList(false);
    try {
      const fullConv = await fetchConversation(convId);
      setMessages(fullConv.messages);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNewConversation = async () => {
    try {
      const newC = await createConversation();
      setConversations(prev => [
        {
          id: newC.id,
          title: newC.title,
          created_at: newC.created_at,
          updated_at: newC.updated_at,
          message_count: 0,
          last_message_preview: "New chat"
        },
        ...prev
      ]);
      setActiveConvId(newC.id);
      setMessages([]);
      setShowConvList(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (window.confirm("Delete this conversation?")) {
      try {
        await deleteConversation(convId);
        const remaining = conversations.filter(c => c.id !== convId);
        setConversations(remaining);
        if (activeConvId === convId) {
          if (remaining.length > 0) {
            handleSelectConversation(remaining[0].id);
          } else {
            handleNewConversation();
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleStartRename = (e: React.MouseEvent, conv: ConversationSummary) => {
    e.stopPropagation();
    setRenamingId(conv.id);
    setRenameInput(conv.title);
  };

  const handleSaveRename = async (convId: string) => {
    if (!renameInput.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await renameConversation(convId, renameInput.trim());
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: renameInput.trim() } : c));
    } catch (e) {
      console.error(e);
    } finally {
      setRenamingId(null);
    }
  };

  const handleSend = async (textToSend?: string) => {
    if (isListening) {
      stopListening();
    }
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    // 1. Immediately show user message on screen!
    const tempUserMsg: ChatMessage = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, tempUserMsg]);
    setInput('');
    setLoading(true);
    setTimeout(scrollToBottom, 30);

    try {
      const res = await sendChatMessage(text, activeConvId);

      const asstMsg: ChatMessage = {
        id: 'asst-' + (Date.now() + 1),
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toISOString(),
        applied_actions: res.actions_performed
      };

      setMessages(prev => [...prev, asstMsg]);
      onMessageSent([...messages, tempUserMsg, asstMsg], res.meal_plan, res.grocery_list);

      // Refresh conversations list to update title & message previews
      const updatedList = await fetchConversations();
      setConversations(updatedList);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: 'err-' + (Date.now() + 1),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.message}. Make sure your backend service is running.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const activeConv = conversations.find(c => c.id === activeConvId);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-115px)] max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden relative">
      {/* Header bar with Conversation Switcher */}
      <div className="px-3 sm:px-4 py-2.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between gap-2 z-10">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowConvList(!showConvList)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-200/70 transition cursor-pointer text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800 truncate max-w-[160px] sm:max-w-xs">
                  {activeConv?.title || "AI Chat"}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">Switch conversation thread</p>
            </div>
          </button>

          {/* Conversations Dropdown / Drawer */}
          {showConvList && (
            <div className="absolute top-12 left-0 w-72 sm:w-80 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-50 animate-fadeIn">
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Chat History
                </span>
                <button
                  type="button"
                  onClick={handleNewConversation}
                  className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Chat</span>
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1">
                {conversations.map((c) => {
                  const isActive = c.id === activeConvId;
                  const isRenaming = renamingId === c.id;

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectConversation(c.id)}
                      className={`group p-2 rounded-xl text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                        isActive
                          ? 'bg-emerald-50/80 text-emerald-900 font-semibold'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                        {isRenaming ? (
                          <input
                            type="text"
                            value={renameInput}
                            onChange={(e) => setRenameInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(c.id);
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs px-2 py-0.5 rounded border border-emerald-400 w-full focus:outline-hidden"
                            autoFocus
                          />
                        ) : (
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs">{c.title}</p>
                            <p className="text-[10px] text-slate-400 truncate font-normal">
                              {c.last_message_preview}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                        {isRenaming ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveRename(c.id);
                            }}
                            className="p-1 text-emerald-600 hover:bg-emerald-100 rounded"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleStartRename(e, c)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded"
                            title="Rename"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteConversation(e, c.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* New Chat Top Button */}
        <button
          type="button"
          onClick={handleNewConversation}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          title="Start fresh conversation"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Chat</span>
        </button>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
              <Bot className="w-7 h-7" />
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-bold text-slate-900">What are we craving this week?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Tell me what ingredients you have, dietary goals, or how many nights you want to cook. I'll tailor the recipes and update your grocery list live.
              </p>
            </div>

            {/* Quick Inspiration Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg mt-3">
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="text-left p-2.5 text-xs text-slate-700 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-xl transition flex items-center justify-between group cursor-pointer"
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
              <div className="flex gap-3 justify-start items-center animate-fadeIn">
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
        {isListening && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
              <span className="font-medium">Listening... speak naturally. Text appends to your input.</span>
            </div>
            <button
              type="button"
              onClick={stopListening}
              className="text-xs font-semibold text-rose-800 hover:underline cursor-pointer"
            >
              Stop
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1 flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type dinner ideas, constraints, or speak..."
              className="w-full bg-slate-100 focus:bg-white border border-transparent focus:border-emerald-500 rounded-xl pl-4 pr-11 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden transition shadow-inner"
              disabled={loading}
            />
            {isSupported && (
              <button
                type="button"
                onClick={toggleListening}
                disabled={loading}
                title={isListening ? "Stop listening" : "Voice-to-text dictation (appends speech)"}
                className={`absolute right-2 p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                  isListening
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-300 ring-2 ring-rose-400 animate-pulse'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-xs transition flex items-center justify-center shrink-0 cursor-pointer"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
