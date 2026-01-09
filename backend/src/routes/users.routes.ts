import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/roles.middleware';
import bcrypt from 'bcryptjs';

const router = Router();
const prisma = new PrismaClient();

// Protected routes
router.use(authMiddleware);

// Update own profile (any authenticated user) - must be before /:id routes
router.put('/profile/me', async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { firstName, lastName } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roleId: true,
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Error al actualizar perfil' });
  }
});

// Get all users (admin only)
router.get('/', roleMiddleware(['admin']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roleId: true,
        firebaseUid: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            name: true,
            permissions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

// Get all roles (admin only)
router.get('/roles', roleMiddleware(['admin']), async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ message: 'Error al obtener roles' });
  }
});

// Get user by ID (admin only)
router.get('/:id', roleMiddleware(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roleId: true,
        firebaseUid: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            name: true,
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
});

// Create user (admin only)
router.post('/', roleMiddleware(['admin']), async (req, res) => {
  try {
    const { email, password, firstName, lastName, roleId } = req.body;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'El correo ya esta registrado' });
    }

    // Hash password if provided
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: firstName || '',
        lastName: lastName || '',
        roleId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roleId: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error al crear usuario' });
  }
});

// Update user (admin only)
router.put('/:id', roleMiddleware(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, firstName, lastName, roleId } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Check if email is taken by another user
    if (email && email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email },
      });

      if (emailTaken) {
        return res.status(400).json({ message: 'El correo ya esta en uso' });
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (email) updateData.email = email;
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (roleId) updateData.roleId = roleId;

    // Hash password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roleId: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
});

// Delete user (admin only)
router.delete('/:id', roleMiddleware(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Prevent self-deletion
    if (currentUser?.userId === id) {
      return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta' });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
});

export default router;
