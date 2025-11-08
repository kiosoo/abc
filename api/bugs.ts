import { apiHandler } from '@/auth/apiHandler';
import { createBugReport, getAllBugReports } from '@/auth/bugReports';

export default apiHandler({
    POST: async (req, res, session) => {
        if (!session.id || !session.username) {
            res.status(401).json({ message: 'Chưa được xác thực' });
            return;
        }
        const { message } = req.body;
        if (!message) {
            res.status(400).json({ message: 'Yêu cầu nhập nội dung báo cáo' });
            return;
        }
        await createBugReport(session.id, session.username, message);
        res.status(201).json({ message: 'Báo cáo đã được gửi' });
    },
    GET: async (req, res, session) => {
        if (!session.isAdmin) {
            res.status(403).json({ message: 'Không có quyền truy cập' });
            return;
        }
        const reports = await getAllBugReports();
        res.status(200).json(reports);
    }
});