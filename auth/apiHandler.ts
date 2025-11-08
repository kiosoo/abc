import { getIronSession, SessionOptions, IronSessionData, IronSession } from 'iron-session';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { User } from '@/types';

// This extends the IronSessionData interface to have the properties of User
declare module 'iron-session' {
  interface IronSessionData extends Partial<Omit<User, 'password'>> {}
}

export const sessionOptions: SessionOptions = {
  password: process.env.SECRET_COOKIE_PASSWORD as string,
  cookieName: 'gemini-app-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};

type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse,
  // The session object is an IronSession instance, not just the data.
  // This type provides the .save() and .destroy() methods.
  session: IronSession<IronSessionData>
) => Promise<void>;

interface Handlers {
  [key: string]: ApiHandler;
}

export function apiHandler(handlers: Handlers) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      // --- Centralized Pre-flight Checks ---
      const secret = process.env.SECRET_COOKIE_PASSWORD;
      if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN || !secret) {
        const message = "Server configuration error: Missing required environment variables.";
        console.error(message);
        return res.status(500).json({ message });
      }
      if (secret.length < 32) {
        const message = "Server configuration error: SECRET_COOKIE_PASSWORD must be at least 32 characters long.";
        console.error(message);
        return res.status(500).json({ message });
      }

      // --- Centralized Session Management ---
      // The generic type is not needed here because we are using module augmentation for IronSessionData.
      // getIronSession will return an object of type IronSession<IronSessionData>.
      const session = await getIronSession(req, res, sessionOptions);

      // --- Method Routing ---
      const handler = req.method ? handlers[req.method] : undefined;
      if (!handler) {
        const allowedMethods = Object.keys(handlers).join(', ');
        res.setHeader('Allow', allowedMethods);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
      }

      // --- Execute Handler with Error Boundary ---
      await handler(req, res, session);

    } catch (error) {
      console.error(`Unhandled error in API handler for ${req.url}:`, error);
      const message = error instanceof Error ? error.message : "An unexpected internal server error occurred.";
      // This is the safety net that prevents server crashes and ensures JSON is always returned.
      return res.status(500).json({ message });
    }
  };
}