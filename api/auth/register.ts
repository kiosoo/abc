import { apiHandler } from '@/auth/apiHandler';
import { findUserByUsername, createUser } from '@/auth/userManagement';

export default apiHandler({
    POST: async (req, res, session) => {
        const { firstName, lastName, username, password } = req.body;

        if (!firstName || !lastName || !username || !password) {
            res.status(400).json({ message: 'Yêu cầu nhập đầy đủ các trường' });
            return;
        }

        if (await findUserByUsername(username)) {
            res.status(409).json({ message: 'Tên đăng nhập đã tồn tại' });
            return;
        }

        const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

        const newUser = await createUser({
            firstName,
            lastName,
            username,
            password,
        }, ip || null);
        
        // Populate session
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
    }
});