import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Camera,
  Trash2,
  ChevronRight,
  Bot,
  User,
  Zap,
  Loader2,
  X
} from 'lucide-react';
import { AiChatMessage, Strategy } from '../../lib/types';
import { VoiceInput } from './VoiceInput';

interface AiSidebarProps {
  onClose?: () => void;
  messages: AiChatMessage[];
  onSendMessage: (prompt: string, includeScreenshot: boolean) => Promise<void>;
  isGenerating: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
  onClearChat: () => void;
  onCaptureScreenshot: () => Promise<string | null>;
  activeStrategy: Strategy | null;
  symbol: string;
  timeframe: string;
}

const GEMINI_MODELS = [
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', desc: 'Fast & Balanced Multimodal' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', desc: 'Ultra-fast High Throughput' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', desc: 'Deep Quantitative Reasoning' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Reliable Core Engine' },
];

export const AiSidebar: React.FC<AiSidebarProps> = ({
  onClose,
  messages,
  onSendMessage,
  isGenerating,
  selectedModel,
  onModelChange,
  onClearChat,
  onCaptureScreenshot,
  activeStrategy,
  symbol,
  timeframe,
}) => {
  const [inputText, setInputText] = useState('');
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !previewImage) return;

    const text = inputText.trim();
    setInputText('');
    setPreviewImage(null);
    await onSendMessage(text, includeScreenshot);
  };

  const handleVoiceTranscription = (text: string) => {
    setInputText((prev) => (prev ? `${prev} ${text}` : text));
  };

  const quickPrompts = [
    { label: '📊 Analyze Market Bias', prompt: `Analyze current market structure, trend direction, and key S/R zones on ${symbol} ${timeframe}.` },
    { label: '⚖️ Strategy Alignment', prompt: `Check if current ${symbol} price action satisfies the rules of our active strategy: ${activeStrategy?.name || 'EMA Trend'}.` },
    { label: '🎯 Find Optimal SL/TP', prompt: `Suggest an optimal entry zone, Stop Loss, and Take Profit target with at least 1:2 R:R on ${symbol}.` },
    { label: '🚨 Check Divergences', prompt: `Scan for RSI or MACD bullish/bearish divergences on the ${symbol} ${timeframe} chart.` },
  ];

  return (
    <div className="flex flex-col w-full h-full bg-[#0d131f] border-l border-slate-800 font-sans text-xs select-none overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/70 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 text-white shadow-md shadow-blue-500/20">
            <Sparkles className="w-4 h-4 text-yellow-300" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-white text-xs">Gemini Copilot</h3>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-mono">
                Vision
              </span>
            </div>
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 font-mono transition-colors"
            >
              <span>{GEMINI_MODELS.find((m) => m.id === selectedModel)?.name || 'Gemini 3.7 Flash'}</span>
              <span className="text-[8px] text-blue-400">▼</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onClearChat}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all"
            title="Clear conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              title="Minimize AI Copilot"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Model Picker Dropdown */}
      {showModelPicker && (
        <div className="p-2 border-b border-slate-800 bg-slate-900/90 space-y-1 animate-fade-in shrink-0">
          <div className="text-[10px] uppercase text-slate-500 font-bold px-2 py-0.5">Select Model</div>
          {GEMINI_MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onModelChange(m.id);
                setShowModelPicker(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-all ${
                selectedModel === m.id
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="font-medium">{m.name}</div>
              <div className="text-[10px] text-slate-400">{m.desc}</div>
            </button>
          ))}
        </div>
      )}

      {/* Message Thread */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-2 text-slate-400">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs">AI Copilot Ready</h4>
              <p className="text-[10px] text-slate-500 mt-0.5 max-w-[200px]">
                I see your chart canvas, indicators, strategy, and respond via voice or text.
              </p>
            </div>

            {/* Quick Prompts */}
            <div className="w-full space-y-1 pt-2">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-semibold">
                Quick Actions
              </span>
              {quickPrompts.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(qp.prompt, true)}
                  className="w-full text-left p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/50 text-[10px] transition-all flex items-center justify-between group"
                >
                  <span>{qp.label}</span>
                  <Zap className="w-3 h-3 text-slate-500 group-hover:text-yellow-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isBot = msg.role === 'assistant';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  {isBot ? (
                    <>
                      <Bot className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] font-bold text-blue-400">Gemini</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] font-bold text-slate-400">You</span>
                      <User className="w-3 h-3 text-slate-400" />
                    </>
                  )}
                  <span className="text-[9px] text-slate-500">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-xl max-w-[95%] leading-relaxed ${
                    isBot
                      ? 'bg-slate-900 border border-slate-800 text-slate-200 shadow-md'
                      : 'bg-blue-600 text-white rounded-br-sm'
                  }`}
                >
                  {msg.image && (
                    <img
                      src={msg.image}
                      alt="Chart Snapshot"
                      className="rounded-lg mb-2 max-h-36 w-full object-cover border border-slate-700/60"
                    />
                  )}
                  <div className="whitespace-pre-wrap font-sans text-xs">
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {isGenerating && (
          <div className="flex items-center gap-2 text-slate-400 p-2">
            <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            <span className="text-xs text-slate-400 font-medium animate-pulse">
              Gemini is analyzing chart canvas...
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input & Vision Controls */}
      <div className="p-2.5 border-t border-slate-800 bg-slate-900/90 space-y-2 shrink-0">
        {includeScreenshot && (
          <div className="flex items-center justify-between px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-[10px] text-blue-300">
            <span className="flex items-center gap-1">
              <Camera className="w-3 h-3 text-blue-400" />
              <span>Vision: {symbol} {timeframe}</span>
            </span>
            <button
              onClick={() => setIncludeScreenshot(false)}
              className="text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIncludeScreenshot(!includeScreenshot)}
            className={`p-2 rounded-xl border transition-all ${
              includeScreenshot
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                : 'bg-slate-800/80 text-slate-400 hover:text-white border-slate-700/60'
            }`}
            title={includeScreenshot ? 'Chart Vision Enabled' : 'Enable Chart Vision'}
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          <VoiceInput onTranscription={handleVoiceTranscription} disabled={isGenerating} />

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask AI or speak..."
            disabled={isGenerating}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all text-xs"
          />

          <button
            type="submit"
            disabled={isGenerating || (!inputText.trim() && !includeScreenshot)}
            className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white shadow-lg shadow-blue-600/20 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
