import { GripVertical, Trash2, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EditableContent } from '../EditableContent';
import type { BriefBlock } from '@/types/briefTypes';

interface CalloutBlockProps {
  block: BriefBlock;
  onChange: (updates: Partial<BriefBlock>) => void;
  onDelete: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

const variantConfig = {
  info: {
    icon: Info,
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    iconColor: 'text-blue-500',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    iconColor: 'text-yellow-500',
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    iconColor: 'text-green-500',
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    iconColor: 'text-red-500',
  },
};

export function CalloutBlock({
  block,
  onChange,
  onDelete,
  onKeyDown,
  dragHandleProps,
  isDragging,
}: CalloutBlockProps) {
  const variant = block.variant || 'info';
  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleVariantChange = (newVariant: 'info' | 'warning' | 'success' | 'error') => {
    onChange({ variant: newVariant });
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

      <div
        className={cn(
          'flex gap-3 p-4 rounded-lg border',
          config.bgColor,
          config.borderColor
        )}
      >
        {/* Icon button to change variant */}
        <div className="relative group/icon">
          <button
            onClick={() => {
              // Cycle through variants
              const variants: ('info' | 'warning' | 'success' | 'error')[] = ['info', 'warning', 'success', 'error'];
              const currentIndex = variants.indexOf(variant);
              const nextIndex = (currentIndex + 1) % variants.length;
              handleVariantChange(variants[nextIndex]);
            }}
            className={cn(
              'flex-shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-black/10',
              config.iconColor
            )}
            title="Cambiar tipo de nota"
          >
            <Icon className="h-5 w-5" />
          </button>

          {/* Variant selector on hover */}
          <div className="absolute left-0 top-full mt-1 hidden group-hover/icon:flex gap-1 p-1 bg-popover border rounded-lg shadow-lg z-10">
            {Object.entries(variantConfig).map(([key, cfg]) => {
              const VariantIcon = cfg.icon;
              return (
                <button
                  key={key}
                  onClick={() => handleVariantChange(key as 'info' | 'warning' | 'success' | 'error')}
                  className={cn(
                    'p-1.5 rounded transition-colors hover:bg-muted',
                    cfg.iconColor,
                    variant === key && 'bg-muted'
                  )}
                  title={key}
                >
                  <VariantIcon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>

        <EditableContent
          value={block.content}
          onChange={(content) => onChange({ content })}
          onKeyDown={onKeyDown}
          placeholder="Escribe una nota..."
          className="flex-1 text-sm"
        />
      </div>

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
