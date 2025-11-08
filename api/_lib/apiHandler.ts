import { getIronSession, SessionOptions, IronSession } from 'iron-session';
import { User, VercelRequest, VercelResponse } from '../../types';

// FIX: Define an explicit type for our session data.
// FIX: 'IronSessionData' is not an exported member of 'iron-session'.
// The session data type is defined with just the application-specific fields.
type AppSessionData = Partial<Omit<User, 'password'>>;

type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse,
  // The session object is an IronSession instance, not just the data.
  // This type provides the .save() and .destroy() methods.
  // FIX: Use the explicitly defined session type.
  session: IronSession<AppSessionData>
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

      // --- Session Options defined inside handler ---
      // This ensures environment variables are read at request time, not module load time,
      // preventing crashes in serverless environments.
      const sessionOptions: SessionOptions = {
        password: secret,
        cookieName: 'gemini-app-session',
        cookieOptions: {
          secure: process.env.NODE_ENV === 'production',
        },
      };

      // --- Centralized Session Management ---
      // FIX: Pass the explicit session data type to getIronSession.
      // FIX: Cast `req` and `res` to `any` to satisfy `getIronSession`'s type requirements,
      // as VercelRequest/VercelResponse are custom types not assignable to Node's IncomingMessage/ServerResponse.
      const session = await getIronSession<AppSessionData>(req as any, res as any, sessionOptions);

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