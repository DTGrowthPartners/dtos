import { Router } from 'express';
import { TaskController } from '../controllers/task.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const taskController = new TaskController();

router.use(authMiddleware);

router.post('/', taskController.create.bind(taskController));
router.get('/', taskController.findAll.bind(taskController));
router.put('/positions/update', taskController.updatePositions.bind(taskController));
router.get('/:id', taskController.findOne.bind(taskController));
router.put('/:id', taskController.update.bind(taskController));
router.delete('/:id', taskController.remove.bind(taskController));
router.post('/:id/comments', taskController.addComment.bind(taskController));

export default router;
