import { VoiceOption, SubscriptionTier } from '@/types';

export const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
export const LIVE_TRANSCRIPTION_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';

export const TTS_VOICES: VoiceOption[] = [
  { id: 'auto', name: 'Tự động (Đa ngôn ngữ)' },
  { id: 'Kore', name: 'Giọng Nữ - Trầm ấm' },
  { id: 'Puck', name: 'Giọng Nam - Thân thiện' },
  { id: 'Charon', name: 'Giọng Nam - Trầm' },
  { id: 'Fenrir', name: 'Giọng Nam - Năng động' },
  { id: 'Zephyr', name: 'Giọng Nữ - Nhẹ nhàng' },
];

export const DEFAULT_VOICE = 'auto';

// Increased chunk size to optimize API calls. The model limit is 5000 chars.
export const LONG_TEXT_CHUNK_SIZE = 4800; // Characters per chunk for TTS

// Business rule: Each API key is limited to 15 requests per day for quota calculation.
export const TTS_DAILY_API_LIMIT = 15;

export const TIER_LIMITS: { [key in SubscriptionTier]: number } = {
  [SubscriptionTier.BASIC]: 1500,
  [SubscriptionTier.PRO]: 6000,
  [SubscriptionTier.ULTRA]: Infinity,
  // Star gets 2 managed keys: ~140k chars daily limit
  [SubscriptionTier.STAR]: 140000,
  // Super Star gets 4 managed keys: ~280k chars daily limit
  [SubscriptionTier.SUPER_STAR]: 280000,
  // VVIP gets 10 managed keys: ~700k chars daily limit
  [SubscriptionTier.VVIP]: 700000,
};

export const TIER_COLORS: { [key in SubscriptionTier]: string } = {
    [SubscriptionTier.BASIC]: 'text-gray-400',
    [SubscriptionTier.PRO]: 'text-cyan-400',
    [SubscriptionTier.ULTRA]: 'text-teal-400',
    [SubscriptionTier.STAR]: 'text-blue-400',
    [SubscriptionTier.SUPER_STAR]: 'text-purple-400',
    [SubscriptionTier.VVIP]: 'text-yellow-400',
};