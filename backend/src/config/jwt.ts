import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

export const generateToken = (payload: object, expiresIn: string = JWT_EXPIRES_IN): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
};

export const generateRefreshToken = (payload: object): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
};

export const JWT_CONFIG = {
  secret: JWT_SECRET,
  expiresIn: JWT_EXPIRES_IN,
  refreshExpiresIn: JWT_REFRESH_EXPIRES_IN,
};