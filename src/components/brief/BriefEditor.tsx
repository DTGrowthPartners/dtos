import { useState, useEffect, useCallback, useRef } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Plus, Save, Check, Loader2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { BriefCommandMenu } from './BriefCommandMenu';
import { HeadingBlock } from './blocks/HeadingBlock';
import { ParagraphBlock } from './blocks/ParagraphBlock';
import { ChecklistBlock } from './blocks/ChecklistBlock';
import { ImageBlock } from './blocks/ImageBlock';
import { LinkBlock } from './blocks/LinkBlock';
import { DividerBlock } from './blocks/DividerBlock';
import { CalloutBlock } from './blocks/CalloutBlock';
import type { Brief, BriefBlock, BriefBlockType } from '@/types/briefTypes';
import { generateBlockId } from '@/lib/briefService';

interface BriefEditorProps {
  brief: Brief;
  onSave: (updates: Partial<Brief>) => Promise<void>;
  onImageClick?: (imageUrl: string) => void;
}

export function BriefEditor({ brief, onSave, onImageClick }: BriefEditorProps) {
  const [title, setTitle] = useState(brief.title);
  const [blocks, setBlocks] = useState<BriefBlock[]>(brief.blocks);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [commandMenuPosition, setCommandMenuPosition] = useState({ top: 0, left: 0 });
  const [commandMenuQuery, setCommandMenuQuery] = useState('');
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const editorRef = useRef<HTMLDivElement>(null);

  // Update local state when brief changes
  useEffect(() => {
    setTitle(brief.title);
    setBlocks(brief.blocks);
  }, [brief.id]);

  // Auto-save with debounce
  const triggerAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await onSave({ title, blocks });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (error) {
        console.error('Error auto-saving brief:', error);
      } finally {
        setSaving(false);
      }
    }, 2000);
  }, [title, blocks, onSave]);

  // Trigger auto-save when content changes
  useEffect(() => {
    triggerAutoSave();
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [title, blocks, triggerAutoSave]);

  // Handle drag and drop
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const newBlocks = Array.from(blocks);
    const [removed] = newBlocks.splice(result.source.index, 1);
    newBlocks.splice(result.destination.index, 0, removed);

    // Update order property
    const updatedBlocks = newBlocks.map((block, index) => ({
      ...block,
      order: index,
    }));

    setBlocks(updatedBlocks);
  };

  // Handle block changes
  const handleBlockChange = (blockId: string, updates: Partial<BriefBlock>) => {
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId ? { ...block, ...updates } : block
      )
    );
  };

  // Delete block
  const handleDeleteBlock = (blockId: string) => {
    setBlocks((prev) => prev.filter((block) => block.id !== blockId));
  };

  // Add new block
  const addBlock = (type: BriefBlockType, afterIndex?: number) => {
    const newBlock: BriefBlock = {
      id: generateBlockId(),
      type,
      content: '',
      order: blocks.length,
      ...(type === 'checklist' && { items: [] }),
      ...(type === 'callout' && { variant: 'info' }),
    };

    if (afterIndex !== undefined && afterIndex >= 0) {
      const newBlocks = [...blocks];
      newBlocks.splice(afterIndex + 1, 0, newBlock);
      setBlocks(newBlocks.map((b, i) => ({ ...b, order: i })));
    } else {
      setBlocks([...blocks, newBlock]);
    }

    setCommandMenuOpen(false);
    setCommandMenuQuery('');
  };

  // Handle "/" command detection
  const handleBlockKeyDown = (e: React.KeyboardEvent, blockIndex: number) => {
    const target = e.target as HTMLElement;
    const text = target.innerText || '';

    // Check for "/" at the start of empty content
    if (e.key === '/' && (text === '' || text === '/')) {
      e.preventDefault();
      setActiveBlockIndex(blockIndex);

      // Get position for menu
      const rect = target.getBoundingClientRect();
      setCommandMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
      setCommandMenuOpen(true);
      setCommandMenuQuery('');
    }

    // Handle Enter to create new paragraph after current block
    if (e.key === 'Enter' && !e.shiftKey) {
      const block = blocks[blockIndex];
      // Only for paragraph and heading blocks
      if (['paragraph', 'heading1', 'heading2', 'heading3'].includes(block.type)) {
        // Don't interfere with normal line breaks
        if (!text.trim()) {
          e.preventDefault();
          addBlock('paragraph', blockIndex);
        }
      }
    }

    // Close command menu on Escape
    if (e.key === 'Escape' && commandMenuOpen) {
      setCommandMenuOpen(false);
      setCommandMenuQuery('');
    }
  };

  // Render block based on type
  const renderBlock = (block: BriefBlock, index: number, dragHandleProps: Record<string, unknown>) => {
    const commonProps = {
      block,
      onChange: (updates: Partial<BriefBlock>) => handleBlockChange(block.id, updates),
      onDelete: () => handleDeleteBlock(block.id),
      onKeyDown: (e: React.KeyboardEvent) => handleBlockKeyDown(e, index),
      dragHandleProps,
    };

    switch (block.type) {
      case 'heading1':
      case 'heading2':
      case 'heading3':
        return <HeadingBlock {...commonProps} />;
      case 'paragraph':
        return <ParagraphBlock {...commonProps} />;
      case 'checklist':
        return <ChecklistBlock {...commonProps} />;
      case 'image':
        return <ImageBlock {...commonProps} onImageClick={onImageClick} />;
      case 'link':
        return <LinkBlock {...commonProps} />;
      case 'divider':
        return <DividerBlock {...commonProps} />;
      case 'callout':
        return <CalloutBlock {...commonProps} />;
      default:
        return <ParagraphBlock {...commonProps} />;
    }
  };

  return (
    <div ref={editorRef} className="h-full flex flex-col">
      {/* Header with title and save status */}
      <div className="flex items-center gap-4 p-4 border-b">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titulo del brief..."
          className="flex-1 text-xl font-semibold border-none shadow-none focus-visible:ring-0 px-0"
        />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {saving && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Guardando...</span>
            </>
          )}
          {saved && !saving && (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-green-500">Guardado</span>
            </>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-8 px-12">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="blocks">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-1"
                >
                  {blocks.map((block, index) => (
                    <Draggable key={block.id} draggableId={block.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(snapshot.isDragging && 'z-50')}
                        >
                          {renderBlock(block, index, provided.dragHandleProps || {})}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* Add Block Button */}
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                const button = e.currentTarget;
                const rect = button.getBoundingClientRect();
                const menuHeight = 320;
                // Show above if there's room, otherwise show below
                const showAbove = rect.top > menuHeight + 20;
                setCommandMenuPosition({
                  top: showAbove ? rect.top - menuHeight : rect.bottom + 8,
                  left: rect.left,
                });
                setActiveBlockIndex(blocks.length - 1);
                setCommandMenuOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar bloque
            </Button>
            <span className="text-xs text-muted-foreground">
              o escribe <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">/</kbd> para ver opciones
            </span>
          </div>
        </div>
      </div>

      {/* Command Menu */}
      <BriefCommandMenu
        isOpen={commandMenuOpen}
        onClose={() => {
          setCommandMenuOpen(false);
          setCommandMenuQuery('');
        }}
        onSelect={(type) => addBlock(type, activeBlockIndex ?? undefined)}
        position={commandMenuPosition}
        searchQuery={commandMenuQuery}
      />
    </div>
  );
}
