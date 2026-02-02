import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  StickyNote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import NoteItemCard from './NoteItemCard';
import type { ProjectNoteColumn, NoteItem } from '@/types/taskTypes';

interface NoteColumnProps {
  column: ProjectNoteColumn;
  items: NoteItem[];
  onEditColumn: (column: ProjectNoteColumn) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddItem: (columnId: string) => void;
  onEditItem: (item: NoteItem) => void;
  onDeleteItem: (itemId: string) => void;
  onDropItem: (e: React.DragEvent, columnId: string) => void;
  onDragStartItem?: (itemId: string) => void;
  onDragEndItem?: () => void;
  onImageClick?: (imageUrl: string) => void;
  draggedItemId: string | null;
}

export default function NoteColumn({
  column,
  items,
  onEditColumn,
  onDeleteColumn,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onDropItem,
  onDragStartItem,
  onDragEndItem,
  onImageClick,
  draggedItemId,
}: NoteColumnProps) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('noteItemId', itemId);
    onDragStartItem?.(itemId);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const element = e.target as HTMLElement;
    element.style.opacity = '1';
    onDragEndItem?.();
  };

  return (
    <div
      className="w-[280px] md:w-[320px] lg:w-[350px] flex-shrink-0 flex flex-col bg-muted/30 rounded-lg p-3 md:p-4 border-2 border-dashed border-muted-foreground/20"
      onDragOver={handleDragOver}
      onDrop={(e) => onDropItem(e, column.id)}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-3 h-3 rounded-full ${column.color} flex-shrink-0`} />
          <StickyNote className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <h2 className="font-semibold text-base md:text-lg truncate">
            {column.name}
            <span className="ml-2 text-xs md:text-sm text-muted-foreground">
              ({items.length})
            </span>
          </h2>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditColumn(column)}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar columna
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDeleteColumn(column.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar columna
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Items */}
      <div className="space-y-3 flex-1 overflow-y-auto">
        {items.map((item) => (
          <NoteItemCard
            key={item.id}
            item={item}
            onEdit={onEditItem}
            onDelete={onDeleteItem}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onImageClick={onImageClick}
            isDragging={draggedItemId === item.id}
          />
        ))}

        {items.length === 0 && (
          <div className="h-24 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground text-sm">
            Arrastra notas aquí
          </div>
        )}
      </div>

      {/* Add Item Button */}
      <Button
        variant="ghost"
        className="w-full mt-3 justify-start text-muted-foreground hover:text-foreground"
        onClick={() => onAddItem(column.id)}
      >
        <Plus className="h-4 w-4 mr-2" />
        Agregar nota
      </Button>
    </div>
  );
}
