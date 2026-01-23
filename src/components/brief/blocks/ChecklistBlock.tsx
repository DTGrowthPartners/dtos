import { useState, useRef, useEffect } from 'react';
import { GripVertical, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { BriefBlock, ChecklistItem } from '@/types/briefTypes';

interface ChecklistBlockProps {
  block: BriefBlock;
  onChange: (updates: Partial<BriefBlock>) => void;
  onDelete: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
  autoFocus?: boolean;
}

export function ChecklistBlock({
  block,
  onChange,
  onDelete,
  onKeyDown,
  dragHandleProps,
  isDragging,
  autoFocus,
}: ChecklistBlockProps) {
  const items = block.items || [];
  const [focusedIndex, setFocusedIndex] = useState<number | null>(autoFocus ? 0 : null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (focusedIndex !== null && inputRefs.current[focusedIndex]) {
      inputRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, items.length]);

  const toggleItem = (itemId: string) => {
    const updated = items.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    onChange({ items: updated });
  };

  const updateItemText = (itemId: string, text: string) => {
    const updated = items.map(item =>
      item.id === itemId ? { ...item, text } : item
    );
    onChange({ items: updated });
  };

  const addItem = (afterIndex?: number) => {
    const newItem: ChecklistItem = {
      id: crypto.randomUUID(),
      text: '',
      checked: false,
    };

    const insertIndex = afterIndex !== undefined ? afterIndex + 1 : items.length;
    const updated = [
      ...items.slice(0, insertIndex),
      newItem,
      ...items.slice(insertIndex),
    ];

    onChange({ items: updated });
    setFocusedIndex(insertIndex);
  };

  const removeItem = (itemId: string) => {
    if (items.length <= 1) return; // Keep at least one item
    const index = items.findIndex(i => i.id === itemId);
    const updated = items.filter(item => item.id !== itemId);
    onChange({ items: updated });

    // Focus previous item or next if first
    if (index > 0) {
      setFocusedIndex(index - 1);
    } else if (updated.length > 0) {
      setFocusedIndex(0);
    }
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, itemId: string, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem(index);
    } else if (e.key === 'Backspace' && items[index].text === '') {
      e.preventDefault();
      removeItem(itemId);
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      setFocusedIndex(index - 1);
    } else if (e.key === 'ArrowDown' && index < items.length - 1) {
      e.preventDefault();
      setFocusedIndex(index + 1);
    } else {
      onKeyDown(e);
    }
  };

  // Initialize with one empty item if empty
  useEffect(() => {
    if (items.length === 0) {
      addItem();
    }
  }, []);

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

      {/* Checklist items */}
      <div className="space-y-1">
        {items.map((item, index) => (
          <div key={item.id} className="flex items-start gap-2 group/item">
            <Checkbox
              checked={item.checked}
              onCheckedChange={() => toggleItem(item.id)}
              className="mt-1"
            />
            <input
              ref={el => inputRefs.current[index] = el}
              type="text"
              value={item.text}
              onChange={(e) => updateItemText(item.id, e.target.value)}
              onKeyDown={(e) => handleItemKeyDown(e, item.id, index)}
              onFocus={() => setFocusedIndex(index)}
              placeholder="Tarea..."
              className={cn(
                'flex-1 bg-transparent border-none outline-none text-base',
                item.checked && 'line-through text-muted-foreground'
              )}
            />
            {items.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover/item:opacity-100 transition-opacity"
                onClick={() => removeItem(item.id)}
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Add item button */}
      <Button
        variant="ghost"
        size="sm"
        className="mt-1 h-7 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => addItem()}
      >
        <Plus className="h-3 w-3 mr-1" />
        Agregar item
      </Button>

      {/* Delete block button */}
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
