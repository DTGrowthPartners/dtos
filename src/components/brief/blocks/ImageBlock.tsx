import { useState, useRef } from 'react';
import { GripVertical, Trash2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { convertImageToBase64, validateImage } from '@/lib/imageService';
import { useToast } from '@/hooks/use-toast';
import type { BriefBlock } from '@/types/briefTypes';

interface ImageBlockProps {
  block: BriefBlock;
  onChange: (updates: Partial<BriefBlock>) => void;
  onDelete: () => void;
  onImageClick?: (imageUrl: string) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

export function ImageBlock({
  block,
  onChange,
  onDelete,
  onImageClick,
  dragHandleProps,
  isDragging,
}: ImageBlockProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
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
      onChange({ content: base64 });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description: 'No se pudo procesar la imagen',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleUpload(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await handleUpload(file);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          await handleUpload(file);
        }
        break;
      }
    }
  };

  const removeImage = () => {
    onChange({ content: '' });
  };

  return (
    <div
      className={cn(
        'group relative py-2',
        isDragging && 'opacity-50'
      )}
      onPaste={handlePaste}
    >
      {/* Drag handle */}
      <div
        {...dragHandleProps}
        className="absolute -left-8 top-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {block.content ? (
        // Image preview
        <div className="relative group/image">
          <img
            src={block.content}
            alt="Brief image"
            className="max-w-full max-h-[400px] object-contain rounded-lg border bg-muted cursor-pointer"
            onClick={() => onImageClick?.(block.content)}
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover/image:opacity-100 transition-opacity"
            onClick={removeImage}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        // Upload zone
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            'w-full h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50 bg-muted/30'
          )}
        >
          {uploading ? (
            <p className="text-sm text-muted-foreground">Procesando imagen...</p>
          ) : (
            <>
              {dragOver ? (
                <ImageIcon className="h-8 w-8 text-primary" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                {dragOver ? 'Suelta la imagen aqui' : 'Haz clic o arrastra una imagen'}
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG o GIF (max. 5MB)
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

      {/* Delete block button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-8 top-4 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onDelete}
      >
        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
}
