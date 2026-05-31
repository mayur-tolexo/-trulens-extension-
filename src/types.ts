export type Verdict = 'genuine' | 'mixed' | 'fake';

export interface Review {
  id: string;
  text: string;
  rating: number | null;          // 1–5
  author: string | null;
  verifiedPurchase: boolean | null;
  date: string | null;            // ISO if parseable
  reviewerReviewCount: number | null;
  isLocalGuide: boolean | null;
  helpfulCount: number | null;
  reviewerPhotoCount?: number | null;
}

export interface Signal {
  key: string;
  label: string;
  delta: number;                  // signed contribution
}

export interface ScoreResult {
  score: number;                  // 0–100
  verdict: Verdict;
  signals: Signal[];
}

export interface ProductSummary {
  score: number;
  verdict: Verdict;
  reviewCount: number;
  breakdown: { genuine: number; mixed: number; fake: number };
}

export type ProviderMode = 'proxy' | 'anthropic' | 'openai-compatible';

export interface Settings {
  enabled: boolean;
  perSite: { amazon: boolean; flipkart: boolean; googleMaps: boolean };
  providerMode: ProviderMode;
  apiKey: string;
  baseUrl: string;   // API base for 'anthropic' (default https://api.anthropic.com) and 'openai-compatible' modes
  model: string;     // model name
  proxyUrl: string;
  autoDeep: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  perSite: { amazon: true, flipkart: true, googleMaps: true },
  // Bring-your-own-key: AI deep-analysis stays dormant until the user adds a key.
  providerMode: 'openai-compatible',
  apiKey: '',
  baseUrl: 'https://api.minimax.io/v1',
  model: 'MiniMax-M2',
  proxyUrl: '',
  autoDeep: true
};

export interface DeepAnalysisResult {
  score: number;
  verdict: Verdict;
  reasoning: string;
}
