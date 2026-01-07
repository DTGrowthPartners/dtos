import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterDto, LoginDto, FirebaseRegisterDto, FirebaseLoginDto } from '../dtos/auth.dto';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const registerDto: RegisterDto = req.body;
      const result = await authService.register(registerDto);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
  
  async firebaseRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const firebaseDto: FirebaseRegisterDto = req.body;
      const result = await authService.firebaseRegister(firebaseDto);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
  
  async firebaseLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const firebaseDto: FirebaseLoginDto = req.body;
      const result = await authService.firebaseLogin(firebaseDto);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const loginDto: LoginDto = req.body;
      const result = await authService.login(loginDto);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      // Implement refresh token logic
      res.json({ message: 'Refresh token implementation pending' });
    } catch (error) {
      next(error);
    }
  }
  
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      // Implement logout logic (e.g., blacklist token)
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }
}