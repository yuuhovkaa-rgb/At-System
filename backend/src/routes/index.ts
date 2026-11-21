import { Router } from 'express';
import { adminRouter, academicRouter, monitorDashRouter, settingsRouter } from '../controllers/admin.controller';
import { announcementsRouter, notificationsRouter } from '../controllers/comms.controller';
import { attendanceRouter } from '../controllers/attendance.controller';
import { authRouter } from '../controllers/auth.controller';
import { classesRouter, monitorsRouter } from '../controllers/classes.controller';
import { reportsRouter } from '../controllers/reports.controller';
import { studentPortalRouter } from '../controllers/student.controller';
import { studentsRouter } from '../controllers/students.controller';

export const api = Router();
api.get('/health', (_req, res) => res.json({ ok: true }));
api.use('/auth', authRouter);
api.use('/students', studentsRouter);
api.use('/classes', classesRouter);
api.use('/monitors', monitorsRouter);
api.use('/attendance/reports', reportsRouter); // before /attendance so "reports" is never read as an id
api.use('/attendance', attendanceRouter);
api.use('/student', studentPortalRouter);
api.use('/admin', adminRouter);
api.use('/monitor', monitorDashRouter);
api.use('/settings', settingsRouter);
api.use('/academic-years', academicRouter);
api.use('/announcements', announcementsRouter);
api.use('/notifications', notificationsRouter);
