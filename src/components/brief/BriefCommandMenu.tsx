import { useEffect, useRef, useState } from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  Text,
  CheckSquare,
  Image,
  Link,
  Minus,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BLOCK_OPTIONS, type BriefBlockType } from '@/types/briefTypes';

interface BriefCommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: BriefBlockType) => void;
  position?: { top: number; left: number };
  searchQuery?: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  heading1: Heading1,
  heading2: Heading2,
  heading3: Heading3,
  text: Text,
  checkSquare: CheckSquare,
  image: Image,
  link: Link,
  minus: Minus,
  alertCircle: AlertCircle,
};

export function BriefCommandMenu({
  isOpen,
  onClose,
  onSelect,
  position,
  searchQuery = '',
}: BriefCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter options based on search query
  const filteredOptions = BLOCK_OPTIONS.filter((option) => {
    const query = searchQuery.toLowerCase().replace('/', '');
    return (
      option.label.toLowerCase().includes(query) ||
      option.shortcut.toLowerCase().includes('/' + query) ||
      option.description.toLowerCase().includes(query)
    );
  });

  // Reset selection when options change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredOptions[selectedIndex]) {
            onSelect(filteredOptions[selectedIndex].type);
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredOptions, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (menuRef.current) {
      const selectedElement = menuRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-72 max-h-80 overflow-y-auto bg-popover border rounded-lg shadow-lg"
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
      }}
    >
      <div className="p-2">
        <p className="text-xs font-medium text-muted-foreground px-2 py-1">
          Bloques disponibles
        </p>
        {filteredOptions.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground text-center">
            No se encontraron bloques
          </p>
        ) : (
          <div className="space-y-0.5">
            {filteredOptions.map((option, index) => {
              const Icon = iconMap[option.icon] || Text;
              return (
                <button
                  key={option.type}
                  data-index={index}
                  onClick={() => {
                    onSelect(option.type);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors',
                    index === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{option.label}</p>
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {option.shortcut}
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {option.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
