import { apiHandler } from '../_lib/apiHandler';
import { logTtsUsage } from '../_lib/userManagement';

export default apiHandler({
    POST: async (req, res, session) => {
        if (!session.id) {
            res.status(401).json({ message: 'Chưa được xác thực' });
            return;
        }

        const { characterCount } = req.body;
        if (typeof characterCount !== 'number' || characterCount < 0) {
            res.status(400).json({ message: 'Số ký tự không hợp lệ' });
            return;
        }

        await logTtsUsage(session.id, characterCount);
        res.status(200).json({ message: 'Mức sử dụng đã được ghi nhận' });
    }
});