import { apiHandler } from '@/auth/apiHandler';
import { User } from '@/types';
import { getAllUsers, updateUser } from '@/auth/userManagement';

export default apiHandler({
    GET: async (req, res, session) => {
        if (!session.isAdmin) {
            res.status(403).json({ message: 'Không có quyền truy cập' });
            return;
        }
        const users = await getAllUsers();
        res.status(200).json(users);
    },
    PATCH: async (req, res, session) => {
        if (!session.isAdmin) {
            res.status(403).json({ message: 'Không có quyền truy cập' });
            return;
        }
        const { id, tier, subscriptionExpiresAt } = req.body;
        if (!id) {
            res.status(400).json({ message: 'Yêu cầu ID người dùng' });
            return;
        }
        const updates: Partial<Omit<User, 'id' | 'password'>> = {};
        if (tier) updates.tier = tier;
        // Allow setting expiration to null
        if (subscriptionExpiresAt !== undefined) updates.subscriptionExpiresAt = subscriptionExpiresAt;

        const updatedUser = await updateUser(id, updates);
        if (updatedUser) {
            res.status(200).json(updatedUser);
        } else {
            res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }
    }
});