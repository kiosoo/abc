import { VoiceOption, SubscriptionTier } from '@/types';

export const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
export const LIVE_TRANSCRIPTION_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';

export const TTS_VOICES: VoiceOption[] = [
  { id: 'auto', name: 'Automatic (Recommended for Multilingual)' },
  { id: 'Kore', name: 'Kore (Female)' },
  { id: 'Puck', name: 'Puck (Male)' },
  { id: 'Charon', name: 'Charon (Male)' },
  { id: 'Fenrir', name: 'Fenrir (Male)' },
  { id: 'Zephyr', name: 'Zephyr (Female)' },
];

export const DEFAULT_VOICE = 'auto';

export const LONG_TEXT_CHUNK_SIZE = 2500; // Characters per chunk for TTS

export const TIER_LIMITS: { [key in SubscriptionTier]: number } = {
  [SubscriptionTier.BASIC]: 1500,
  [SubscriptionTier.PRO]: 6000,
  [SubscriptionTier.ULTRA]: Infinity,
};