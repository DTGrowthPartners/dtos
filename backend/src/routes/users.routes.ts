import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/roles.middleware';
import bcrypt from 'bcrypt';
import { admin } from '../app';

const router = Router();
const prisma = new PrismaClient();

// Default permissions for new users
const DEFAULT_USER_PERMISSIONS = [
  'dashboard',
  'clientes',
  'servicios',
  'campanas',
  'tareas',
  'reportes',
  'productos',
  'cuentas-cobro',
  'crm',
  'terceros',
];

// Protected routes
router.use(authMiddleware);

// Get team members for chat (any authenticated user)
router.get('/team', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
      },
      orderBy: {
        firstName: 'asc',
      },
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ message: 'Error al obtener equipo' });
  }
});

// Update own profile (any authenticated user) - must be before /:id routes
router.put('/profile/me', async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { firstName, lastName, phone, address, photoUrl } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: phone || undefined,
        address: address !== undefined ? address : undefined,
        photoUrl: photoUrl !== undefined ? photoUrl : undefined,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        photoUrl: true,
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
        phone: user.phone,
        address: user.address,
        photoUrl: user.photoUrl,
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
        photoUrl: true,
        permissions: true,
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
  let firebaseUser = null;

  try {
    const { email, password, firstName, lastName, roleId } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'La contraseña es requerida' });
    }

    // Check if email already exists in database
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'El correo ya esta registrado' });
    }

    // First, create user in Firebase Authentication
    try {
      firebaseUser = await admin.auth().createUser({
        email,
        password,
        displayName: `${firstName || ''} ${lastName || ''}`.trim(),
      });
    } catch (firebaseError: any) {
      console.error('Firebase create user error:', firebaseError);
      if (firebaseError.code === 'auth/email-already-exists') {
        return res.status(400).json({ message: 'El correo ya esta registrado en Firebase' });
      }
      throw firebaseError;
    }

    // Hash password for local storage (backup)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in database with Firebase UID
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: firstName || '',
        lastName: lastName || '',
        roleId,
        firebaseUid: firebaseUser.uid,
        permissions: DEFAULT_USER_PERMISSIONS,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roleId: true,
        firebaseUid: true,
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

    // If database creation failed but Firebase user was created, delete the Firebase user
    if (firebaseUser) {
      try {
        await admin.auth().deleteUser(firebaseUser.uid);
        console.log('Rolled back Firebase user creation');
      } catch (rollbackError) {
        console.error('Error rolling back Firebase user:', rollbackError);
      }
    }

    res.status(500).json({ message: 'Error al crear usuario' });
  }
});

// Update user (admin only)
router.put('/:id', roleMiddleware(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, firstName, lastName, roleId, permissions } = req.body;

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
    if (permissions !== undefined) updateData.permissions = permissions;

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
        permissions: true,
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

    // Use transaction to clean up all references before deleting user
    await prisma.$transaction(async (tx) => {
      // Delete user's notifications
      await tx.notification.deleteMany({
        where: { OR: [{ recipientId: id }, { senderId: id }] },
      });

      // Delete user's reminders
      await tx.dealReminder.deleteMany({
        where: { OR: [{ assignedTo: id }, { createdBy: id }] },
      });

      // Delete user's deal activities
      await tx.dealActivity.deleteMany({
        where: { performedBy: id },
      });

      // Unassign deals owned by user (set to null)
      await tx.deal.updateMany({
        where: { ownerId: id },
        data: { ownerId: null },
      });

      // Delete deals created by user (or unassign)
      await tx.deal.deleteMany({
        where: { createdBy: id },
      });

      // Delete tasks created by user
      await tx.task.deleteMany({
        where: { createdBy: id },
      });

      // Delete models created by user
      await tx.model.deleteMany({
        where: { createdBy: id },
      });

      // Delete client shares for this user
      await tx.clientShare.deleteMany({
        where: { userId: id },
      });

      // Delete services created by user (set null or delete)
      await tx.service.updateMany({
        where: { createdBy: id },
        data: { createdBy: null },
      });

      // Delete clients created by user
      // First, delete related ClientServices
      const userClients = await tx.client.findMany({
        where: { createdBy: id },
        select: { id: true },
      });
      const clientIds = userClients.map(c => c.id);

      if (clientIds.length > 0) {
        await tx.clientService.deleteMany({
          where: { clientId: { in: clientIds } },
        });
        await tx.clientShare.deleteMany({
          where: { clientId: { in: clientIds } },
        });
        await tx.tercero.updateMany({
          where: { clientId: { in: clientIds } },
          data: { clientId: null },
        });
        await tx.account.deleteMany({
          where: { clientId: { in: clientIds } },
        });
        await tx.client.deleteMany({
          where: { createdBy: id },
        });
      }

      // Finally delete the user
      await tx.user.delete({
        where: { id },
      });
    });

    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
});

export default router;
