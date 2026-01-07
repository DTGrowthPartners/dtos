import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/roles.middleware';

const router = Router();

// Protected routes
router.use(authMiddleware);

// Admin only routes
router.use(roleMiddleware(['admin']));

router.get('/', (req, res) => {
  res.json({ message: 'Users list (admin only)' });
});

router.get('/:id', (req, res) => {
  res.json({ message: 'Get user by ID' });
});

router.put('/:id', (req, res) => {
  res.json({ message: 'Update user' });
});

router.delete('/:id', (req, res) => {
  res.json({ message: 'Delete user' });
});

export default router;