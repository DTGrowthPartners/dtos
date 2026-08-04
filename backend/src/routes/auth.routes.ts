import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const authController = new AuthController();
const prisma = new PrismaClient();

// GET /api/auth/me — usuario fresco desde la BD (permisos al día sin re-login).
// La app lo llama al cargar cuando Firebase no tiene sesión local: sin esto, los
// cambios de permisos solo aplicaban tras logout/login.
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { role: true },
    });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    const permissions = user.permissions && user.permissions.length > 0
      ? user.permissions
      : user.role.permissions || [];
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      photoUrl: user.photoUrl,
      role: user.role.name,
      permissions,
    });
  } catch (e: any) {
    res.status(500).json({ message: e?.message || 'Error obteniendo usuario' });
  }
});

router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/firebase-register', authController.firebaseRegister.bind(authController));
router.post('/firebase-login', authController.firebaseLogin.bind(authController));
router.post('/refresh', authController.refreshToken.bind(authController));
router.post('/logout', authController.logout.bind(authController));

export default router;