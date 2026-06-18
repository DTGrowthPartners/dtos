import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/auth.middleware';
import propuestasController from '../controllers/propuestas.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authMiddleware);

// POST /api/propuestas/generate — genera una propuesta a partir de una transcripción
router.post('/generate', propuestasController.generate);

// POST /api/propuestas/extract — extrae texto de un archivo (.txt/.md/.pdf/.docx)
router.post('/extract', upload.single('file'), propuestasController.extract);

export default router;
