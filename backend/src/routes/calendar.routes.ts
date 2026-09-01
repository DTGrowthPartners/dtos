import { Router } from 'express';
import calendarController from '../controllers/calendar.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get all events (with filters)
router.get('/', calendarController.getEvents);

// Get upcoming events
router.get('/upcoming', calendarController.getUpcomingEvents);

// Get single event
// Antes de /:id: si no, "google" y "deal" se leen como un id de evento
router.get('/google/estado', calendarController.googleEstado);
router.post('/deal/:dealId/meeting', calendarController.createDealMeeting);

router.get('/:id', calendarController.getEvent);

// Create event
router.post('/', calendarController.createEvent);

// Update event
router.put('/:id', calendarController.updateEvent);

// Delete event
router.delete('/:id', calendarController.deleteEvent);

export default router;
