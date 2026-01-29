import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Middleware para verificar que el usuario tiene rol "client"
export const requireClientRole = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  if (user.role !== 'client') {
    return res.status(403).json({ message: 'Acceso denegado - Solo clientes' });
  }

  next();
};

// Middleware para verificar que el usuario es admin (para gestión de clientes)
export const requireAdminRole = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  if (user.role !== 'admin') {
    return res.status(403).json({ message: 'Acceso denegado - Solo administradores' });
  }

  next();
};

// Middleware para obtener el clientId del usuario del portal
export const attachClientId = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  try {
    // Obtener el usuario con su portalClientId
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { portalClientId: true },
    });

    if (!dbUser?.portalClientId) {
      return res.status(403).json({ message: 'Usuario no asociado a ningún cliente' });
    }

    // Agregar clientId al request para uso posterior
    (req as any).portalClientId = dbUser.portalClientId;
    next();
  } catch (error) {
    console.error('Error al obtener clientId:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Middleware combinado: requiere rol client + obtiene clientId
export const portalAuth = [requireClientRole, attachClientId];
