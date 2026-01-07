import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Protected routes
router.use(authMiddleware);

router.get('/', (req, res) => {
  res.json({ message: 'Models list' });
});

router.post('/', (req, res) => {
  res.json({ message: 'Create model' });
});

router.get('/:id', (req, res) => {
  res.json({ message: 'Get model by ID' });
});

router.put('/:id', (req, res) => {
  res.json({ message: 'Update model' });
});

router.delete('/:id', (req, res) => {
  res.json({ message: 'Delete model' });
});

export default router;