
// FIX: Define base interfaces for VercelRequest and VercelResponse to avoid
// dependency on unresolved 'http' module from Node.js types.
interface BaseVercelRequest {
  method?: string;
  url?: string;
  headers: { [key: string]: string | string[] | undefined };
  socket: { remoteAddress?: string };
}

interface BaseVercelResponse {
  setHeader(name: string, value: string | number | readonly string[]): this;
}

export enum SubscriptionTier {
  BASIC = 'Basic',
  PRO = 'Pro',
  ULTRA = 'Ultra',
  STAR = 'Star',
  SUPER_STAR = 'Super Star',
  VVIP = 'VVIP',
}

export interface ManagedApiKeyEntry {
  key: string;
  usage: {
    count: number;
    date: string; // YYYY-MM-DD
  };
}

export interface User {
  id: string;
  username: string;
  password?: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  tier: SubscriptionTier;
  subscriptionExpiresAt: string | null; // ISO 8601 date string
  createdAt: string; // ISO 8601 date string
  lastLoginAt: string | null; // ISO 8601 date string
  ipAddress: string | null;
  activeSessionToken?: string | null;
  managedApiKeys?: ManagedApiKeyEntry[];
  usage: {
    ttsCharacters: number;
    usageDate?: string; // YYYY-MM-DD
  };
}

export interface Notification {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface LogEntry {
  id: number;
  message: string;
  type: 'system' | 'info' | 'success' | 'error';
  timestamp: string;
}


export enum ChatMode {
  STANDARD = 'standard',
  THINKING = 'thinking',
  SEARCH = 'search',
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  sources?: { uri: string; title: string }[];
}

export interface VoiceOption {
  id: string;
  name: string;
}

// FIX: Add missing TimedWord interface to resolve import error.
export interface TimedWord {
    word: string;
    startTime: string;
    endTime: string;
}

export interface VercelRequest extends BaseVercelRequest {
  body: any;
  query: { [key: string]: string | string[] | undefined };
  cookies: { [key: string]: string | undefined };
}

export interface VercelResponse extends BaseVercelResponse {
  status(code: number): this;
  json(data: any): this;
  send(body: any): this;
}

// New types for API Key Pool management
export interface ApiKeyUsage {
  count: number;
  date: string; // YYYY-MM-DD
}

export interface ApiKeyEntry {
  key: string;
  usage: ApiKeyUsage;
}