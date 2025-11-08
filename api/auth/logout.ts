import { apiHandler } from '../_lib/apiHandler.js';

export default apiHandler({
    POST: async (req, res, session) => {
        session.destroy();
        res.status(200).json({ message: 'Logged out successfully' });
    }
});