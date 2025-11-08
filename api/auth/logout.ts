import { apiHandler } from '@/auth/apiHandler';

export default apiHandler({
    POST: async (req, res, session) => {
        session.destroy();
        res.status(200).json({ message: 'Logged out successfully' });
    }
});