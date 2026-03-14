import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

export interface UsageLog {
  userId: string;
  model: string;
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: number;
  feature: string;
}

// Estimated costs per 1M tokens (very rough estimates for Gemini 3/2.5 series)
const COST_PER_1M_TOKENS: Record<string, { input: number; output: number }> = {
  'gemini-3-flash-preview': { input: 0.075, output: 0.30 },
  'gemini-3.1-pro-preview': { input: 1.25, output: 5.00 },
  'gemini-2.5-flash-image': { input: 0.10, output: 0.40 },
  'default': { input: 0.10, output: 0.40 }
};

export const usageService = {
  async logAIUsage(model: string, usage: { promptTokens: number; candidatesTokens: number }, feature: string) {
    if (!auth.currentUser) return;

    const pricing = COST_PER_1M_TOKENS[model] || COST_PER_1M_TOKENS['default'];
    const inputCost = (usage.promptTokens / 1000000) * pricing.input;
    const outputCost = (usage.candidatesTokens / 1000000) * pricing.output;
    const totalCost = inputCost + outputCost;

    const log: UsageLog = {
      userId: auth.currentUser.uid,
      model,
      promptTokens: usage.promptTokens,
      candidatesTokens: usage.candidatesTokens,
      totalTokens: usage.promptTokens + usage.candidatesTokens,
      cost: totalCost,
      timestamp: Date.now(),
      feature
    };

    try {
      await addDoc(collection(db, 'usage_logs'), log);
    } catch (error) {
      console.error('Failed to log usage', error);
    }
  }
};
