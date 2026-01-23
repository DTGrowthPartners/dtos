import { GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditableContent } from '../EditableContent';
import { cn } from '@/lib/utils';
import type { BriefBlock } from '@/types/briefTypes';

interface HeadingBlockProps {
  block: BriefBlock;
  onChange: (content: string) => void;
  onDelete: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
  autoFocus?: boolean;
}

const HEADING_STYLES = {
  heading1: 'text-3xl font-bold',
  heading2: 'text-2xl font-semibold',
  heading3: 'text-xl font-medium',
};

const HEADING_PLACEHOLDERS = {
  heading1: 'Encabezado 1',
  heading2: 'Encabezado 2',
  heading3: 'Encabezado 3',
};

export function HeadingBlock({
  block,
  onChange,
  onDelete,
  onKeyDown,
  dragHandleProps,
  isDragging,
  autoFocus,
}: HeadingBlockProps) {
  const headingType = block.type as 'heading1' | 'heading2' | 'heading3';

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
        className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Heading content */}
      <EditableContent
        value={block.content}
        onChange={onChange}
        placeholder={HEADING_PLACEHOLDERS[headingType]}
        className={cn(HEADING_STYLES[headingType])}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        singleLine
      />

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-8 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onDelete}
      >
        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
}
