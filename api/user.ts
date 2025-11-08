import { apiHandler } from './_lib/apiHandler.js';
import { findUserById } from './_lib/userManagement.js';

export default apiHandler({
    GET: async (req, res, session) => {
        if (session.id) {
            // Fetch the latest user data from the database to ensure it's fresh
            const user = await findUserById(session.id);
            if (user) {
                const { password, ...userToSend } = user;
                res.status(200).json(userToSend);
                return;
            } else {
                // User existed in session but not in DB (e.g., deleted)
                session.destroy();
                res.status(404).json({ message: "User not found" });
                return;
            }
        } else {
            res.status(200).json(null);
            return;
        }
    }
});