import { useState, useEffect } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Task } from '@/types/taskTypes';

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onSaveComment: (taskId: string, comment: { text: string; author: string }) => void;
}

export default function CommentsModal({
  isOpen,
  onClose,
  task,
  onSaveComment,
}: CommentsModalProps) {
  const [newComment, setNewComment] = useState('');
  const [author, setAuthor] = useState('Usuario');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNewComment('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await onSaveComment(task.id, {
        text: newComment.trim(),
        author: author || 'Usuario',
      });
      setNewComment('');
    } catch (error) {
      console.error('Error saving comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: number | string) => {
    return new Date(date).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getColorFromName = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md md:max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-800 bg-slate-800/50">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <MessageCircle size={18} className="text-blue-500" />
            Comentarios - {task.title}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 md:p-6 max-h-[60vh] overflow-y-auto">
          {/* Existing Comments */}
          {task.comments && task.comments.length > 0 ? (
            <div className="space-y-4 mb-6">
              {task.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${getColorFromName(
                        comment.author
                      )}`}
                    >
                      {getInitials(comment.author)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-200">
                          {comment.author}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {comment.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay comentarios aún</p>
            </div>
          )}

          {/* Add New Comment */}
          <form onSubmit={handleSubmit} className="border-t border-slate-800 pt-4">
            {/* Author Input */}
            <div className="mb-3">
              <Label htmlFor="author" className="text-xs text-slate-400 mb-2">
                Tu nombre:
              </Label>
              <Input
                id="author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Nombre..."
                className="bg-slate-950 border-slate-800 text-slate-200"
              />
            </div>

            <div className="flex gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${getColorFromName(
                  author
                )} flex-shrink-0`}
              >
                {getInitials(author)}
              </div>
              <div className="flex-1">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escribe un comentario..."
                  rows={3}
                  className="bg-slate-950 border-slate-800 text-slate-200 resize-none"
                  disabled={isSubmitting}
                />
                <div className="flex justify-end mt-2">
                  <Button
                    type="submit"
                    disabled={!newComment.trim() || isSubmitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
                  >
                    <Send size={14} className="mr-2" />
                    {isSubmitting ? 'Enviando...' : 'Enviar'}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
