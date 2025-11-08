export enum SubscriptionTier {
  BASIC = 'Basic',
  PRO = 'Pro',
  ULTRA = 'Ultra',
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
  usage: {
    ttsCharacters: number;
  };
}

export interface Notification {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
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

export interface TimedWord {
    word: string;
    startTime: string;
    endTime: string;
}

export interface BugReport {
  id: string;
  userId: string;
  username: string;
  message: string;
  createdAt: string; // ISO 8601 date string
}
