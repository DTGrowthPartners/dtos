import { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  ExternalLink,
  GripVertical,
  Edit,
  Trash2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { NoteItem } from '@/types/taskTypes';

interface NoteItemCardProps {
  item: NoteItem;
  onEdit: (item: NoteItem) => void;
  onDelete: (itemId: string) => void;
  onDragStart: (e: React.DragEvent, itemId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onImageClick?: (imageUrl: string) => void;
  isDragging: boolean;
}

export default function NoteItemCard({
  item,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  onImageClick,
  isDragging,
}: NoteItemCardProps) {
  const [imageError, setImageError] = useState(false);

  const renderContent = () => {
    switch (item.type) {
      case 'text':
        return (
          <div className="space-y-1">
            {item.title && (
              <h4 className="font-medium text-sm">{item.title}</h4>
            )}
            <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
              {item.content}
            </p>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-1">
            {item.title && (
              <h4 className="font-medium text-sm mb-1">{item.title}</h4>
            )}
            {!imageError ? (
              <img
                src={item.content}
                alt={item.title || 'Nota imagen'}
                className="w-full max-h-64 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onImageClick?.(item.content);
                }}
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-32 bg-muted rounded flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
        );

      case 'link':
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <a
                href={item.content}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-medium text-blue-600 hover:underline truncate flex-1"
              >
                {item.title || item.content}
              </a>
              <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            </div>
            {item.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 pl-6">
                {item.description}
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const getTypeIcon = () => {
    switch (item.type) {
      case 'text':
        return <FileText className="h-3 w-3" />;
      case 'image':
        return <ImageIcon className="h-3 w-3" />;
      case 'link':
        return <LinkIcon className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
      onDragEnd={onDragEnd}
      className={`p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${
        isDragging ? 'opacity-50 scale-105' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <GripVertical className="h-4 w-4 cursor-grab" />
          <span className="flex items-center gap-1 text-xs bg-muted px-1.5 py-0.5 rounded">
            {getTypeIcon()}
          </span>
        </div>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onEdit(item)}
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {renderContent()}
    </Card>
  );
}
