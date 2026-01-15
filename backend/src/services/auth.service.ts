import bcrypt from 'bcrypt';
import { generateToken, generateRefreshToken } from '../config/jwt';
import { PrismaClient } from '@prisma/client';
import { RegisterDto, LoginDto, TokenResponse, FirebaseRegisterDto, FirebaseLoginDto } from '../dtos/auth.dto';
import { admin } from '../app';

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

// Permisos por defecto para nuevos usuarios (todos excepto finanzas y equipo)
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

export class AuthService {
  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName } = registerDto;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Get or create default user role
    let userRole = await prisma.role.findFirst({
      where: { name: 'user' },
    });

    if (!userRole) {
      userRole = await prisma.role.create({
        data: {
          name: 'user',
          description: 'Usuario estándar',
          permissions: ['read:model', 'create:model', 'update:model'],
        },
      });
    }

    // Create user with default role and permissions
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        roleId: userRole.id,
        permissions: DEFAULT_USER_PERMISSIONS,
      },
      include: {
        role: true,
      },
    });

    return this.generateTokens(user);
  }

  async firebaseRegister(firebaseDto: FirebaseRegisterDto) {
    const { idToken, email, firstName, lastName } = firebaseDto;

    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    if (decodedToken.email !== email) {
      throw new Error('Email mismatch');
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Get or create default user role
    let userRole = await prisma.role.findFirst({
      where: { name: 'user' },
    });

    if (!userRole) {
      userRole = await prisma.role.create({
        data: {
          name: 'user',
          description: 'Usuario estándar',
          permissions: ['read:model', 'create:model', 'update:model'],
        },
      });
    }

    // Create user with Firebase UID and default permissions
    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        roleId: userRole.id,
        firebaseUid: decodedToken.uid,
        permissions: DEFAULT_USER_PERMISSIONS,
      },
      include: {
        role: true,
      },
    });

    return this.generateTokens(user);
  }

  async firebaseLogin(firebaseDto: FirebaseLoginDto) {
    const { idToken } = firebaseDto;

    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email } = decodedToken;

    if (!email) {
      throw new Error('No email in token');
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
      },
    });

    if (!user) {
      // Get or create default user role
      let userRole = await prisma.role.findFirst({
        where: { name: 'user' },
      });

      if (!userRole) {
        userRole = await prisma.role.create({
          data: {
            name: 'user',
            description: 'Usuario estándar',
            permissions: ['read:model', 'create:model', 'update:model'],
          },
        });
      }

      // Create user from Firebase with default permissions
      user = await prisma.user.create({
        data: {
          email,
          firstName: email.split('@')[0],
          lastName: '',
          roleId: userRole.id,
          firebaseUid: uid,
          permissions: DEFAULT_USER_PERMISSIONS,
        },
        include: {
          role: true,
        },
      });
    } else if (!user.firebaseUid) {
      // Update existing user with Firebase UID
      user = await prisma.user.update({
        where: { id: user.id },
        data: { firebaseUid: uid },
        include: { role: true },
      });
    }

    return this.generateTokens(user);
  }

  async login(loginDto: LoginDto): Promise<TokenResponse> {
    const { email, password } = loginDto;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
      },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if user has a password (not a Firebase-only user)
    if (!user.password) {
      throw new Error('Please use Firebase login for this account');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  private generateTokens(user: any): TokenResponse {
    // Los permisos del usuario tienen prioridad sobre los del rol
    const userPermissions = user.permissions && user.permissions.length > 0
      ? user.permissions
      : user.role.permissions || [];

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role.name,
      permissions: userPermissions,
    };

    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        photoUrl: user.photoUrl,
        role: user.role.name,
        permissions: userPermissions,
      },
    };
  }
}