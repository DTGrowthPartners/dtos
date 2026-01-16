import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/lib/auth';

// Declare VanillaTilt for TypeScript
declare global {
  interface Window {
    VanillaTilt: {
      init: (element: HTMLElement, options?: Record<string, unknown>) => void;
    };
  }
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);

  // Initialize vanilla-tilt effect (very subtle)
  useEffect(() => {
    if (cardRef.current && window.VanillaTilt) {
      window.VanillaTilt.init(cardRef.current, {
        max: 3,
        speed: 600,
        glare: false,
        scale: 1,
        perspective: 1500,
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await authService.login(email, password);
      toast({
        title: 'Inicio de sesión exitoso',
        description: 'Bienvenido de nuevo',
      });
      navigate('/dashboard');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Credenciales inválidas',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src="https://dtgrowthpartners.com/images/fondo-seccion-DT-OS2.mp4" type="video/mp4" />
      </video>

      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black/40 z-10" />

      {/* Login Card */}
      <div className="relative z-20 w-full max-w-md p-4">
        <div
          ref={cardRef}
          className="backdrop-blur-xl bg-slate-900/60 border border-slate-700/50 rounded-2xl shadow-2xl p-8"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-4" style={{ transform: 'translateZ(30px)' }}>
            <img
              src="https://dtgrowthpartners.com/assets/DT-GROWTH-LOGO-DYCI6Arf.png"
              alt="DT Growth Partners"
              className="h-12 object-contain"
            />
          </div>

          {/* Header */}
          <div className="text-center mb-8" style={{ transform: 'translateZ(20px)' }}>
            <h1 className="text-3xl font-bold text-white mb-2">
              DT<span className="text-sky-400">OS</span>
            </h1>
            <p className="text-slate-300">
              Ingresa tus credenciales para acceder
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6" style={{ transform: 'translateZ(15px)' }}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-sky-400 focus:ring-sky-400/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-sky-400 focus:ring-sky-400/20 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-slate-400 hover:text-white"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-5 rounded-lg transition-all duration-200 shadow-lg shadow-sky-500/25"
              disabled={isLoading}
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>

            <div className="text-sm text-center text-slate-400">
              ¿No tienes cuenta?{' '}
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto text-sky-400 hover:text-sky-300"
                onClick={() => navigate('/register')}
                disabled={isLoading}
              >
                Regístrate
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
