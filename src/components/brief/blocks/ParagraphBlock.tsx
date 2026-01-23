import { GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditableContent } from '../EditableContent';
import { cn } from '@/lib/utils';
import type { BriefBlock } from '@/types/briefTypes';

interface ParagraphBlockProps {
  block: BriefBlock;
  onChange: (updates: Partial<BriefBlock>) => void;
  onDelete: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
  autoFocus?: boolean;
}

export function ParagraphBlock({
  block,
  onChange,
  onDelete,
  onKeyDown,
  dragHandleProps,
  isDragging,
  autoFocus,
}: ParagraphBlockProps) {
  return (
    <div
      className={cn(
        'group relative py-1',
        isDragging && 'opacity-50'
      )}
    >
      {/* Drag handle */}
      <div
        {...dragHandleProps}
        className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Paragraph content */}
      <EditableContent
        value={block.content}
        onChange={(content) => onChange({ content })}
        placeholder="Escribe algo o usa '/' para comandos..."
        className="text-base leading-relaxed"
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
      />

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-8 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onDelete}
      >
        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
}
