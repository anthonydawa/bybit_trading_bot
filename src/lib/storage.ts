import { AiChatMessage, Strategy, UserCredentials } from './types';

const KEYS = {
  CREDENTIALS: 'bybit_ai_credentials',
  ACTIVE_STRATEGY: 'bybit_ai_active_strategy',
  CHAT_MESSAGES: 'bybit_ai_chat_messages',
  FAVORITE_SYMBOLS: 'bybit_ai_favorites',
  CUSTOM_STRATEGIES: 'bybit_ai_custom_strategies',
};

export const getStoredCredentials = (): UserCredentials => {
  try {
    const saved = localStorage.getItem(KEYS.CREDENTIALS);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return {
    geminiApiKey: '',
    bybitApiKey: '',
    bybitApiSecret: '',
    isTestnet: false,
  };
};

export const saveStoredCredentials = (credentials: UserCredentials) => {
  try {
    localStorage.setItem(KEYS.CREDENTIALS, JSON.stringify(credentials));
  } catch (e) {}
};

export const getStoredActiveStrategy = (): Strategy | null => {
  try {
    const saved = localStorage.getItem(KEYS.ACTIVE_STRATEGY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return null;
};

export const saveStoredActiveStrategy = (strategy: Strategy | null) => {
  try {
    if (strategy) {
      localStorage.setItem(KEYS.ACTIVE_STRATEGY, JSON.stringify(strategy));
    } else {
      localStorage.removeItem(KEYS.ACTIVE_STRATEGY);
    }
  } catch (e) {}
};

export const getStoredChatMessages = (): AiChatMessage[] => {
  try {
    const saved = localStorage.getItem(KEYS.CHAT_MESSAGES);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [];
};

export const saveStoredChatMessages = (messages: AiChatMessage[]) => {
  try {
    // Keep max 50 recent messages
    const trimmed = messages.slice(-50);
    localStorage.setItem(KEYS.CHAT_MESSAGES, JSON.stringify(trimmed));
  } catch (e) {}
};

export const getFavoriteSymbols = (): string[] => {
  try {
    const saved = localStorage.getItem(KEYS.FAVORITE_SYMBOLS);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT', 'SUIUSDT'];
};

export const toggleFavoriteSymbol = (symbol: string): string[] => {
  const favorites = getFavoriteSymbols();
  let updated: string[];
  if (favorites.includes(symbol)) {
    updated = favorites.filter((s) => s !== symbol);
  } else {
    updated = [...favorites, symbol];
  }
  try {
    localStorage.setItem(KEYS.FAVORITE_SYMBOLS, JSON.stringify(updated));
  } catch (e) {}
  return updated;
};
