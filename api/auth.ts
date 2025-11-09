import { apiHandler } from './_lib/apiHandler.js';
import { findUserByUsername, updateUser, findUserById, ensureAdminExists, createUser } from './_lib/userManagement.js';

export default apiHandler({
    POST: async (req, res, session) => {
        const { action } = req.body;

        switch (action) {
            case 'login': {
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
                (session as any).activeSessionToken = newSessionToken;
                await session.save();

                const { password: _, ...userToSend } = updatedUser;
                res.status(200).json(userToSend);
                return;
            }
            case 'register': {
                const { firstName, lastName, username, password } = req.body;

                if (!firstName || !lastName || !username || !password) {
                    res.status(400).json({ message: 'Yêu cầu nhập đầy đủ các trường' });
                    return;
                }

                if (await findUserByUsername(username)) {
                    res.status(409).json({ message: 'Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác.' });
                    return;
                }

                const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

                const newUser = await createUser({
                    firstName,
                    lastName,
                    username,
                    password,
                }, ip || null);
                
                session.id = newUser.id;
                session.username = newUser.username;
                session.firstName = newUser.firstName;
                session.lastName = newUser.lastName;
                session.isAdmin = newUser.isAdmin;
                session.tier = newUser.tier;
                session.subscriptionExpiresAt = newUser.subscriptionExpiresAt;
                session.createdAt = newUser.createdAt;
                session.lastLoginAt = newUser.lastLoginAt;
                session.ipAddress = newUser.ipAddress;
                await session.save();

                const { password: _, ...userToSend } = newUser;
                res.status(201).json(userToSend);
                return;
            }
            case 'logout': {
                session.destroy();
                res.status(200).json({ message: 'Logged out successfully' });
                return;
            }
            default:
                res.status(400).json({ message: 'Hành động không hợp lệ' });
                return;
        }
    }
});