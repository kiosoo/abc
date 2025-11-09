import { apiHandler } from './_lib/apiHandler.js';
import { User } from './_lib/types.js';
import { getAllUsers, updateUser, deleteUser as deleteUserFromDb } from './_lib/userManagement.js';

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
        const { id, tier, subscriptionExpiresAt, managedApiKeys } = req.body;
        if (!id) {
            res.status(400).json({ message: 'Yêu cầu ID người dùng' });
            return;
        }
        const updates: Partial<Omit<User, 'id' | 'password'>> = {};
        if (tier) updates.tier = tier;
        // Allow setting expiration to null
        if (subscriptionExpiresAt !== undefined) updates.subscriptionExpiresAt = subscriptionExpiresAt;
        if (managedApiKeys !== undefined) updates.managedApiKeys = managedApiKeys;


        const updatedUser = await updateUser(id, updates);
        if (updatedUser) {
            res.status(200).json(updatedUser);
        } else {
            res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }
    },
    DELETE: async (req, res, session) => {
        if (!session.isAdmin) {
            res.status(403).json({ message: 'Không có quyền truy cập' });
            return;
        }
        const { id } = req.body;
        if (!id) {
            res.status(400).json({ message: 'Yêu cầu ID người dùng' });
            return;
        }
        const success = await deleteUserFromDb(id);
        if (success) {
            res.status(200).json({ message: 'Đã xóa người dùng' });
        } else {
            res.status(404).json({ message: 'Không tìm thấy người dùng hoặc không thể xóa (ví dụ: tài khoản admin).' });
        }
    }
});