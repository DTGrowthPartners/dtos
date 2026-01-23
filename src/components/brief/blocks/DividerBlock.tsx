import { GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BriefBlock } from '@/types/briefTypes';

interface DividerBlockProps {
  block: BriefBlock;
  onDelete: () => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

export function DividerBlock({
  block,
  onDelete,
  dragHandleProps,
  isDragging,
}: DividerBlockProps) {
  return (
    <div
      className={cn(
        'group relative flex items-center py-4',
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

      {/* Divider line */}
      <div className="flex-1 border-t border-border" />

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
