import { useState } from 'react';
import { GripVertical, Trash2, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { BriefBlock } from '@/types/briefTypes';

interface LinkBlockProps {
  block: BriefBlock;
  onChange: (updates: Partial<BriefBlock>) => void;
  onDelete: () => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

export function LinkBlock({
  block,
  onChange,
  onDelete,
  dragHandleProps,
  isDragging,
}: LinkBlockProps) {
  const [isEditing, setIsEditing] = useState(!block.content);
  const [url, setUrl] = useState(block.content || '');
  const [title, setTitle] = useState(block.metadata?.title || '');

  const handleSave = () => {
    if (url.trim()) {
      let finalUrl = url.trim();
      // Add https:// if no protocol
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = 'https://' + finalUrl;
      }
      onChange({
        content: finalUrl,
        metadata: { title: title.trim() || finalUrl },
      });
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setUrl(block.content || '');
      setTitle(block.metadata?.title || '');
    }
  };

  return (
    <div
      className={cn(
        'group relative py-2',
        isDragging && 'opacity-50'
      )}
    >
      {/* Drag handle */}
      <div
        {...dragHandleProps}
        className="absolute -left-8 top-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {isEditing ? (
        <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input
              placeholder="https://ejemplo.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="flex-1"
            />
          </div>
          <Input
            placeholder="Titulo del enlace (opcional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsEditing(false);
                setUrl(block.content || '');
                setTitle(block.metadata?.title || '');
              }}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!url.trim()}>
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        <a
          href={block.content}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (!block.content) {
              e.preventDefault();
              setIsEditing(true);
            }
          }}
          className={cn(
            'flex items-center gap-3 p-3 border rounded-lg transition-colors',
            block.content
              ? 'hover:bg-muted/50 hover:border-primary/30'
              : 'bg-muted/30 cursor-pointer'
          )}
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <LinkIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">
              {block.metadata?.title || block.content || 'Agregar enlace'}
            </p>
            {block.content && (
              <p className="text-xs text-muted-foreground truncate">
                {block.content}
              </p>
            )}
          </div>
          {block.content && (
            <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
        </a>
      )}

      {/* Edit button */}
      {!isEditing && block.content && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-10 h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.preventDefault();
            setIsEditing(true);
          }}
        >
          Editar
        </Button>
      )}

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
