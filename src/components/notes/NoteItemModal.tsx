import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Upload,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { convertImageToBase64, validateImage } from '@/lib/imageService';
import { useToast } from '@/hooks/use-toast';
import type { NoteItem, NoteItemType } from '@/types/taskTypes';

interface NoteItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<NoteItem, 'id' | 'createdAt' | 'updatedAt' | 'order'>, keepOpen?: boolean) => void;
  editingItem?: NoteItem | null;
  columnId: string;
  projectId: string;
  isSaving: boolean;
}

export default function NoteItemModal({
  isOpen,
  onClose,
  onSave,
  editingItem,
  columnId,
  projectId,
  isSaving,
}: NoteItemModalProps) {
  const [type, setType] = useState<NoteItemType>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (editingItem) {
      setType(editingItem.type);
      setTitle(editingItem.title || '');
      setContent(editingItem.content);
      setDescription(editingItem.description || '');
    } else {
      setType('text');
      setTitle('');
      setContent('');
      setDescription('');
    }
  }, [editingItem, isOpen]);

  const handleSubmit = (e: React.FormEvent, keepOpen = false) => {
    e.preventDefault();
    if (!content.trim()) {
      toast({
        title: 'Error',
        description: 'El contenido es requerido',
        variant: 'destructive',
      });
      return;
    }

    onSave({
      type,
      title: title.trim() || undefined,
      content: content.trim(),
      description: description.trim() || undefined,
      columnId,
      projectId,
    }, keepOpen);

    // If keeping open, reset the form for next item
    if (keepOpen) {
      setTitle('');
      setContent('');
      setDescription('');
      // Keep the same type for convenience
    }
  };

  const handleSaveAndAddAnother = (e: React.MouseEvent) => {
    e.preventDefault();
    handleSubmit(e as any, true);
  };

  const handleImageUpload = async (file: File) => {
    const validation = validateImage(file);
    if (!validation.valid) {
      toast({
        title: 'Error',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const base64 = await convertImageToBase64(file);
      setContent(base64);
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description: 'Error al procesar la imagen',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (type !== 'image') return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          await handleImageUpload(file);
        }
        break;
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleImageUpload(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = () => {
    setContent('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]" onPaste={handlePaste}>
        <DialogHeader>
          <DialogTitle>
            {editingItem ? 'Editar nota' : 'Nueva nota'}
          </DialogTitle>
          <DialogDescription>
            {editingItem
              ? 'Modifica el contenido de tu nota.'
              : 'Agrega una nota de texto, imagen o enlace.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Tabs
            value={type}
            onValueChange={(v) => {
              setType(v as NoteItemType);
              // Clear content when switching types (except when editing)
              if (!editingItem) {
                setContent('');
                setDescription('');
              }
            }}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="text" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Texto
              </TabsTrigger>
              <TabsTrigger value="image" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Imagen
              </TabsTrigger>
              <TabsTrigger value="link" className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                Enlace
              </TabsTrigger>
            </TabsList>

            <div className="py-4 space-y-4">
              {/* Title field - common for all types */}
              <div className="grid gap-2">
                <Label htmlFor="title">Título (opcional)</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Título de la nota..."
                />
              </div>

              {/* TEXT TYPE */}
              <TabsContent value="text" className="mt-0 space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="text-content">Contenido</Label>
                  <Textarea
                    id="text-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Escribe tu nota aquí..."
                    rows={5}
                  />
                </div>
              </TabsContent>

              {/* IMAGE TYPE */}
              <TabsContent value="image" className="mt-0 space-y-4">
                <div className="grid gap-2">
                  <Label>Imagen</Label>
                  {content ? (
                    <div className="relative">
                      <img
                        src={content}
                        alt="Preview"
                        className="w-full max-h-64 object-contain rounded border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={removeImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary transition-colors bg-muted/50"
                    >
                      {uploading ? (
                        <p className="text-sm text-muted-foreground">Cargando...</p>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Haz clic para subir o pega una imagen
                          </p>
                          <p className="text-xs text-muted-foreground">
                            PNG, JPG o GIF (máx. 5MB)
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </TabsContent>

              {/* LINK TYPE */}
              <TabsContent value="link" className="mt-0 space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="link-url">URL</Label>
                  <Input
                    id="link-url"
                    type="url"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="https://ejemplo.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="link-description">Descripción (opcional)</Label>
                  <Textarea
                    id="link-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Breve descripción del enlace..."
                    rows={2}
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            {!editingItem && (
              <Button
                type="button"
                variant="secondary"
                disabled={!content.trim() || isSaving || uploading}
                onClick={handleSaveAndAddAnother}
              >
                {isSaving ? 'Guardando...' : 'Guardar y agregar otro'}
              </Button>
            )}
            <Button type="submit" disabled={!content.trim() || isSaving || uploading}>
              {isSaving ? 'Guardando...' : editingItem ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
