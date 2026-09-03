import React, { useState } from 'react';
import {
  Key,
  ShieldCheck,
  ExternalLink,
  Save,
  X,
  Lock,
  Sparkles,
  Server
} from 'lucide-react';
import { UserCredentials } from '../../lib/types';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: UserCredentials;
  onSaveCredentials: (creds: UserCredentials) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  credentials,
  onSaveCredentials,
}) => {
  const [geminiKey, setGeminiKey] = useState(credentials.geminiApiKey || '');
  const [bybitKey, setBybitKey] = useState(credentials.bybitApiKey || '');
  const [bybitSecret, setBybitSecret] = useState(credentials.bybitApiSecret || '');
  const [isTestnet, setIsTestnet] = useState(credentials.isTestnet || false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCredentials({
      geminiApiKey: geminiKey.trim(),
      bybitApiKey: bybitKey.trim(),
      bybitApiSecret: bybitSecret.trim(),
      isTestnet,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in font-sans">
      <div className="bg-[#0d131f] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">API Keys & Settings</h2>
              <p className="text-xs text-slate-400">Configure Gemini Multimodal AI & Bybit API connection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Gemini API Key */}
          <div className="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-purple-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-yellow-300" />
                <span>Google Gemini API Key</span>
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px]"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
            />
            <p className="text-[10px] text-slate-400">
              Required for AI sidebar chat, chart vision analysis, and pre-trade critique.
            </p>
          </div>

          {/* Bybit API Key & Secret */}
          <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-blue-300 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-blue-400" />
                <span>Bybit Unified Trading API</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">Testnet:</span>
                <input
                  type="checkbox"
                  checked={isTestnet}
                  onChange={(e) => setIsTestnet(e.target.checked)}
                  className="accent-blue-500 rounded cursor-pointer"
                />
              </div>
            </div>

            <div>
              <span className="text-slate-400 text-[11px] block mb-1">Bybit API Key (Read & Trade)</span>
              <input
                type="text"
                placeholder="Bybit API Key"
                value={bybitKey}
                onChange={(e) => setBybitKey(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <span className="text-slate-400 text-[11px] block mb-1">Bybit API Secret</span>
              <input
                type="password"
                placeholder="Bybit API Secret"
                value={bybitSecret}
                onChange={(e) => setBybitSecret(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-[10px] text-slate-400">
              Only required for Live Trading execution. (Paper Trading works with simulated virtual balance without keys).
            </p>
          </div>

          {/* Security Banner */}
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Credentials are kept secure. Bybit requests are signed server-side using HMAC SHA256 and never exposed in browser payloads.
            </span>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
          >
            {savedSuccess ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>Settings Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Credentials</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
