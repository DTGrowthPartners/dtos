import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  getSummary,
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
} from '../controllers/fixedAsset.controller';

const router = Router();

router.use(authMiddleware);

router.get('/summary', getSummary);
router.get('/', getAssets);
router.get('/:id', getAssetById);
router.post('/', createAsset);
router.put('/:id', updateAsset);
router.delete('/:id', deleteAsset);

export default router;
