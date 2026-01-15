import { Router } from 'express';
import calendarController from '../controllers/calendar.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Calendar events CRUD
router.get('/', calendarController.getEvents);
router.get('/:eventId', calendarController.getEvent);
router.post('/', calendarController.createEvent);
router.put('/:eventId', calendarController.updateEvent);
router.delete('/:eventId', calendarController.deleteEvent);

// Events by client/deal
router.get('/client/:clientId', calendarController.getEventsByClient);
router.get('/deal/:dealId', calendarController.getEventsByDeal);

// Schedule meeting for a deal
router.post('/deal/:dealId/meeting', calendarController.scheduleMeeting);

export default router;
