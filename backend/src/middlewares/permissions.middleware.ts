import { Request, Response, NextFunction } from 'express';

// Modulos disponibles en el sistema
export const MODULE_PERMISSIONS = [
  'dashboard',
  'crm',
  'terceros',
  'clientes',
  'servicios',
  'tareas',
  'equipo',
  'finanzas',
  'cuentas-cobro',
] as const;

export type ModulePermission = typeof MODULE_PERMISSIONS[number];

/**
 * Middleware para verificar permisos por modulo.
 * El admin tiene acceso a todos los modulos automaticamente.
 *
 * @param requiredModule - El modulo al que se quiere acceder
 */
export const permissionMiddleware = (requiredModule: ModulePermission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    // Admin tiene acceso a todo
    if (user.role === 'admin') {
      return next();
    }

    // Verificar si el usuario tiene el permiso del modulo
    const userPermissions = user.permissions || [];

    if (!userPermissions.includes(requiredModule)) {
      return res.status(403).json({
        message: 'No tienes acceso a este modulo',
        requiredPermission: requiredModule,
      });
    }

    next();
  };
};

/**
 * Middleware para verificar multiples permisos (OR - cualquiera de ellos).
 *
 * @param requiredModules - Array de modulos, se requiere acceso a al menos uno
 */
export const permissionMiddlewareOr = (requiredModules: ModulePermission[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    // Admin tiene acceso a todo
    if (user.role === 'admin') {
      return next();
    }

    const userPermissions = user.permissions || [];
    const hasAccess = requiredModules.some(module => userPermissions.includes(module));

    if (!hasAccess) {
      return res.status(403).json({
        message: 'No tienes acceso a ninguno de los modulos requeridos',
        requiredPermissions: requiredModules,
      });
    }

    next();
  };
};

/**
 * Helper para verificar permisos sin ser middleware
 */
export const hasPermission = (user: any, module: ModulePermission): boolean => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const userPermissions = user.permissions || [];
  return userPermissions.includes(module);
};

export default {
  permissionMiddleware,
  permissionMiddlewareOr,
  hasPermission,
  MODULE_PERMISSIONS,
};
