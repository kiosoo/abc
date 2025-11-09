import { apiHandler } from './_lib/apiHandler.js';
import { getProjectsForUser, createProject, deleteProject } from './_lib/userManagement.js';

export default apiHandler({
    GET: async (req, res, session) => {
        if (!session.id) {
            res.status(401).json({ message: 'Chưa được xác thực' });
            return;
        }
        const projects = await getProjectsForUser(session.id);
        res.status(200).json(projects);
    },
    POST: async (req, res, session) => {
        if (!session.id) {
            res.status(401).json({ message: 'Chưa được xác thực' });
            return;
        }
        const { name, text, voice } = req.body;
        if (!name || !text || !voice) {
            res.status(400).json({ message: 'Thiếu thông tin dự án' });
            return;
        }
        const newProject = await createProject(session.id, { name, text, voice });
        res.status(201).json(newProject);
    },
    DELETE: async (req, res, session) => {
        if (!session.id) {
            res.status(401).json({ message: 'Chưa được xác thực' });
            return;
        }
        const { projectId } = req.body;
        if (!projectId) {
            res.status(400).json({ message: 'Thiếu ID dự án' });
            return;
        }
        const success = await deleteProject(session.id, projectId);
        if (success) {
            res.status(200).json({ message: 'Đã xóa dự án' });
        } else {
            res.status(404).json({ message: 'Không tìm thấy dự án hoặc không có quyền xóa' });
        }
    }
});