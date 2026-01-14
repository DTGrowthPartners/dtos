import { useState, useRef, useEffect } from 'react';
import { User, Camera, Save, Mail, Shield, Download, QrCode, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import QRCode from 'qrcode';

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '3007189383');
  const [photoUrl, setPhotoUrl] = useState<string | null>(user?.photoUrl || null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(user?.photoUrl || null);
  const [isSaving, setIsSaving] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Generate QR code with vCard data
  useEffect(() => {
    const generateQR = async () => {
      const vCard = `BEGIN:VCARD
VERSION:3.0
N:${lastName};${firstName}
FN:${firstName} ${lastName}
TEL;TYPE=CELL:+57${phone}
EMAIL:${user?.email || ''}
ORG:DT Growth Partners
END:VCARD`;

      try {
        const dataUrl = await QRCode.toDataURL(vCard, {
          width: 200,
          margin: 2,
          color: {
            dark: '#1a1a2e',
            light: '#ffffff',
          },
        });
        setQrDataUrl(dataUrl);
      } catch (error) {
        console.error('Error generating QR:', error);
      }
    };

    if (firstName || lastName || user?.email || phone) {
      generateQR();
    }
  }, [firstName, lastName, phone, user?.email]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Error',
          description: 'Por favor selecciona un archivo de imagen',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'Error',
          description: 'La imagen no puede superar los 5MB',
          variant: 'destructive',
        });
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPhotoPreview(base64);
        setPhotoUrl(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({
        title: 'Error',
        description: 'Nombre y apellido son requeridos',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);

      const updatedUser = await apiClient.put<{ user: typeof user }>('/api/users/profile/me', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        photoUrl: photoUrl,
      });

      if (updatedUser.user) {
        setUser(updatedUser.user);
      }

      toast({
        title: 'Perfil actualizado',
        description: 'Tus datos han sido guardados correctamente',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el perfil',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.download = `contacto-${firstName}-${lastName}.png`.toLowerCase().replace(/\s+/g, '-');
    link.href = qrDataUrl;
    link.click();
  };

  const getInitials = () => {
    const first = firstName?.charAt(0) || user?.firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || user?.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || 'U';
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mi Perfil</h1>
        <p className="text-muted-foreground text-sm">Administra tu informacion personal</p>
      </div>

      {/* Profile Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        {/* Photo Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-4 border-primary/20">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Foto de perfil"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl font-bold text-primary">{getInitials()}</span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg"
              title="Cambiar foto"
            >
              <Camera className="h-5 w-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Haz clic en el icono de camara para cambiar tu foto
          </p>
        </div>

        {/* Form Section */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nombre</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Tu nombre"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Apellido</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Tu apellido"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Phone field */}
          <div className="space-y-2">
            <Label htmlFor="phone">Telefono</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="3007189383"
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">Este numero aparecera en tu codigo QR</p>
          </div>

          {/* Read-only fields */}
          <div className="space-y-2">
            <Label htmlFor="email">Correo electronico</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="pl-10 bg-muted"
              />
            </div>
            <p className="text-xs text-muted-foreground">El correo no puede ser modificado</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rol</Label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="role"
                value={user?.role || 'Usuario'}
                disabled
                className="pl-10 bg-muted capitalize"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="min-w-[120px]"
            >
              {isSaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </div>

      {/* QR Code Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
            <QrCode className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Codigo QR de Contacto</h3>
            <p className="text-sm text-muted-foreground">
              Escanea este codigo con cualquier telefono para agregar tu informacion de contacto automaticamente
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* QR Code Display */}
          <div className="p-4 bg-white rounded-xl shadow-sm border">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-muted-foreground">
                Generando...
              </div>
            )}
          </div>

          {/* Download Button */}
          <div className="flex flex-col gap-3">
            <Button onClick={handleDownloadQR} disabled={!qrDataUrl} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Descargar QR (PNG)
            </Button>
            <p className="text-xs text-muted-foreground text-center sm:text-left">
              Formato vCard compatible con<br />iOS y Android
            </p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Informacion del perfil</h3>
            <p className="text-sm text-muted-foreground">
              Tu foto y nombre seran visibles para otros miembros del equipo.
              El correo electronico es utilizado para iniciar sesion y no puede ser cambiado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
