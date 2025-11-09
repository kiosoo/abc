import { apiHandler } from '../_lib/apiHandler.js';
import { findUserByUsername, updateUser, findUserById, ensureAdminExists } from '../_lib/userManagement.js';

export default apiHandler({
    POST: async (req, res, session) => {
        // Ensure the database is seeded with the admin user before proceeding.
        await ensureAdminExists();

        const { username, password } = req.body;
        const user = await findUserByUsername(username);

        if (!user || user.password !== password) {
            res.status(401).json({ message: 'Thông tin đăng nhập không hợp lệ' });
            return;
        }

        if (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) < new Date()) {
            res.status(403).json({ message: 'Gói của bạn đã hết hạn. Vui lòng liên hệ hỗ trợ.' });
            return;
        }

        const ipHeader = req.headers['x-forwarded-for'];
        const ip = Array.isArray(ipHeader) ? ipHeader[0] : (ipHeader?.split(',')[0].trim() || req.socket.remoteAddress);
        
        const newSessionToken = Date.now().toString(36) + Math.random().toString(36).substring(2);

        await updateUser(user.id, {
            lastLoginAt: new Date().toISOString(),
            ipAddress: ip || null,
            activeSessionToken: newSessionToken,
        });

        const updatedUser = await findUserById(user.id);

        if (!updatedUser) {
            res.status(404).json({ message: "Không tìm thấy người dùng sau khi cập nhật." });
            return;
        }

        // Populate session
        session.id = updatedUser.id;
        session.username = updatedUser.username;
        session.firstName = updatedUser.firstName;
        session.lastName = updatedUser.lastName;
        session.isAdmin = updatedUser.isAdmin;
        session.tier = updatedUser.tier;
        session.subscriptionExpiresAt = updatedUser.subscriptionExpiresAt;
        session.createdAt = updatedUser.createdAt;
        session.lastLoginAt = updatedUser.lastLoginAt;
        session.ipAddress = updatedUser.ipAddress;
        (session as any).activeSessionToken = newSessionToken; // Add token to session
        await session.save();

        const { password: _, ...userToSend } = updatedUser;
        res.status(200).json(userToSend);
    }
});