import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface EditableContentProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  singleLine?: boolean;
}

export function EditableContent({
  value,
  onChange,
  placeholder = '',
  className,
  onKeyDown,
  onFocus,
  onBlur,
  disabled = false,
  autoFocus = false,
  singleLine = false,
}: EditableContentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef(value);

  // Sync content when value changes externally
  useEffect(() => {
    if (ref.current && value !== lastValueRef.current) {
      // Only update if the value actually changed from outside
      const currentContent = ref.current.innerText;
      if (currentContent !== value) {
        ref.current.innerText = value;
      }
      lastValueRef.current = value;
    }
  }, [value]);

  // Auto focus on mount
  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      // Move cursor to end
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [autoFocus]);

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.innerText;
    lastValueRef.current = text;
    onChange(text);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Prevent Enter in single line mode
    if (singleLine && e.key === 'Enter') {
      e.preventDefault();
      return;
    }
    onKeyDown?.(e);
  }, [onKeyDown, singleLine]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    // Paste as plain text
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  return (
    <div
      ref={ref}
      contentEditable={!disabled}
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onPaste={handlePaste}
      data-placeholder={placeholder}
      className={cn(
        'outline-none min-h-[1.5em] whitespace-pre-wrap break-words',
        'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    />
  );
}
