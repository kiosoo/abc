import { User, SubscriptionTier } from '../../types';

// WARNING: This user object is now only for seeding the database if the admin doesn't exist.
// User data is stored in Vercel KV.
export const ADMIN_USER_SEED: Omit<User, 'id'> = {
    username: 'admin',
    password: 'hieplovoi1', // In a real app, hash this!
    firstName: 'Admin',
    lastName: 'User',
    isAdmin: true,
    tier: SubscriptionTier.ULTRA,
    subscriptionExpiresAt: null, // Admin never expires
    createdAt: new Date('2023-01-01T00:00:00.000Z').toISOString(),
    lastLoginAt: null,
    ipAddress: '127.0.0.1',
    usage: {
      ttsCharacters: 0,
    },
};