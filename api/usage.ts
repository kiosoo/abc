import { apiHandler } from './_lib/apiHandler.js';
import { logTtsUsage } from './_lib/userManagement.js';

export default apiHandler({
    POST: async (req, res, session) => {
        const { type } = req.query;

        if (type === 'tts') {
            if (!session.id) {
                res.status(401).json({ message: 'Chưa được xác thực' });
                return;
            }

            const { characterCount, requestCount } = req.body;
            if (typeof characterCount !== 'number' || characterCount < 0) {
                res.status(400).json({ message: 'Số ký tự không hợp lệ' });
                return;
            }
            if (requestCount && (typeof requestCount !== 'number' || requestCount < 0)) {
                res.status(400).json({ message: 'Số lượng yêu cầu không hợp lệ' });
                return;
            }

            const newUsage = await logTtsUsage(session.id, characterCount, requestCount || 0);
            res.status(200).json({ message: 'Mức sử dụng đã được ghi nhận', usage: newUsage });
            return;
        }

        res.status(400).json({ message: 'Loại sử dụng không hợp lệ' });
    }
});