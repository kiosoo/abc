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

// Rate limit for Gemini API Free tier (15 RPM).
// This interval is used in the TTS processing loop to avoid exceeding the limit.
// We calculate the interval (4s) and add a 500ms buffer for safety.
export const TTS_REQUEST_INTERVAL_MS = (60 / 15) * 1000 + 500; // 4500ms

export const TIER_LIMITS: { [key in SubscriptionTier]: number } = {
  [SubscriptionTier.BASIC]: 1500,
  [SubscriptionTier.PRO]: 6000,
  [SubscriptionTier.ULTRA]: Infinity,
};