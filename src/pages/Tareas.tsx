import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit, Trash2, Calendar, Upload, X, MessageCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { convertImageToBase64, validateImage } from '@/lib/imageService';
import ImageModal from '@/components/ImageModal';
import CommentsModal from '@/components/CommentsModal';

interface TaskComment {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  color?: string;
  images?: string[];
  comments?: TaskComment[];
  createdAt: string;
}

const COLUMNS = [
  { id: 'pending', title: 'Pendiente', color: 'bg-blue-500' },
  { id: 'in_progress', title: 'En Progreso', color: 'bg-yellow-500' },
  { id: 'completed', title: 'Completado', color: 'bg-green-500' },
];

const PRIORITY_COLORS = {
  low: 'bg-blue-100 text-blue-800 border-blue-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  high: 'bg-red-100 text-red-800 border-red-300',
};

export default function Tareas() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const { toast } = useToast();

  // Image and Comments modals
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [selectedTaskForComments, setSelectedTaskForComments] = useState<Task | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'pending',
    priority: 'medium',
    dueDate: '',
    color: '',
    images: [] as string[],
  });

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const data = await apiClient.get<Task[]>('/api/tasks');
      setTasks(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las tareas',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const submissionData = {
      ...formData,
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
    };

    try {
      if (editingTask) {
        await apiClient.put(`/api/tasks/${editingTask.id}`, submissionData);
        toast({
          title: 'Tarea actualizada',
          description: 'La tarea se actualizó correctamente',
        });
      } else {
        await apiClient.post('/api/tasks', submissionData);
        toast({
          title: 'Tarea creada',
          description: 'La tarea se creó correctamente',
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchTasks();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al guardar la tarea',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      color: task.color || '',
      images: task.images || [],
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta tarea?')) return;

    try {
      await apiClient.delete(`/api/tasks/${id}`);
      toast({
        title: 'Tarea eliminada',
        description: 'La tarea se eliminó correctamente',
      });
      fetchTasks();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la tarea',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      status: 'pending',
      priority: 'medium',
      dueDate: '',
      color: '',
      images: [],
    });
    setEditingTask(null);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');

    if (taskId && draggedTask) {
      try {
        await apiClient.put(`/api/tasks/${taskId}`, { status: newStatus });
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId ? { ...task, status: newStatus } : task
          )
        );
        toast({
          title: 'Tarea actualizada',
          description: 'El estado de la tarea se actualizó correctamente',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudo actualizar la tarea',
          variant: 'destructive',
        });
      }
    }
    setDraggedTask(null);
  };

  // Image handlers
  const handleImageUpload = async (file: File) => {
    const validation = validateImage(file);
    if (!validation.valid) {
      toast({
        title: 'Error',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    if (formData.images.length >= 5) {
      toast({
        title: 'Error',
        description: 'Máximo 5 imágenes por tarea',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const base64 = await convertImageToBase64(file);
      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, base64],
      }));

      // If editing, update immediately
      if (editingTask) {
        const newImages = [...formData.images, base64];
        await apiClient.put(`/api/tasks/${editingTask.id}`, { images: newImages });
        fetchTasks();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al procesar la imagen',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          await handleImageUpload(file);
        }
        break;
      }
    }
  };

  // Comments handlers
  const handleAddComment = (task: Task) => {
    setSelectedTaskForComments(task);
    setCommentsModalOpen(true);
  };

  const handleSaveComment = async (taskId: string, comment: { text: string; author: string }) => {
    try {
      const response = await apiClient.post(`/api/tasks/${taskId}/comments`, comment);

      // Update local state
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, comments: [...(task.comments || []), response] }
            : task
        )
      );

      // Update selected task for comments modal
      if (selectedTaskForComments && selectedTaskForComments.id === taskId) {
        setSelectedTaskForComments({
          ...selectedTaskForComments,
          comments: [...(selectedTaskForComments.comments || []), response],
        });
      }

      toast({
        title: 'Comentario agregado',
        description: 'El comentario se agregó correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo agregar el comentario',
        variant: 'destructive',
      });
    }
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getTasksByColumn = (columnId: string) => {
    return filteredTasks.filter((task) => task.status === columnId);
  };

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestión de Tareas</h1>
          <p className="text-muted-foreground">Organiza tus tareas con drag and drop</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="w-full md:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nueva Tarea
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar tareas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 h-full min-w-max pb-4">
          {COLUMNS.map((column) => (
            <div
              key={column.id}
              className="flex-1 min-w-[300px] flex flex-col bg-muted/50 rounded-lg p-4"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                <h2 className="font-semibold text-lg">
                  {column.title}
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({getTasksByColumn(column.id).length})
                  </span>
                </h2>
              </div>

              {/* Tasks */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {getTasksByColumn(column.id).map((task) => (
                  <Card
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    className={`p-4 cursor-move hover:shadow-lg transition-all ${
                      draggedTask === task.id ? 'opacity-50' : ''
                    }`}
                    style={{
                      borderLeftWidth: '4px',
                      borderLeftColor: task.color || '#3b82f6',
                    }}
                  >
                    {/* Task Header */}
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm flex-1">{task.title}</h3>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(task);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(task.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Description */}
                    {task.description && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    {/* Images */}
                    {task.images && task.images.length > 0 && (
                      <div className="flex gap-1 mb-2 flex-wrap">
                        {task.images.slice(0, 3).map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt={`Image ${idx + 1}`}
                            className="w-12 h-12 object-cover rounded border cursor-pointer hover:scale-110 transition-transform"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedImage(img);
                              setImageModalOpen(true);
                            }}
                          />
                        ))}
                        {task.images.length > 3 && (
                          <div className="w-12 h-12 bg-muted border rounded flex items-center justify-center text-xs">
                            +{task.images.length - 3}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS]
                          }`}
                        >
                          {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                        </span>
                        {task.dueDate && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {task.images && task.images.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ImageIcon className="h-3 w-3" />
                            {task.images.length}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddComment(task);
                          }}
                        >
                          <MessageCircle className="h-3 w-3" />
                          {task.comments && task.comments.length > 0 && (
                            <span className="text-[10px]">{task.comments.length}</span>
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}

                {getTasksByColumn(column.id).length === 0 && (
                  <div className="h-32 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground text-sm">
                    Arrastra tareas aquí
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Task Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Editar Tarea' : 'Nueva Tarea'}</DialogTitle>
            <DialogDescription>
              {editingTask ? 'Actualiza la información de la tarea' : 'Completa los datos de la nueva tarea'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  placeholder="Título de la tarea"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Descripción de la tarea (puedes pegar imágenes aquí con Ctrl+V)"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  onPaste={handlePaste}
                  disabled={isLoading}
                  rows={3}
                />
              </div>

              {/* Images Section */}
              <div className="space-y-2">
                <Label>Imágenes ({formData.images.length}/5)</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.images.map((img, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={img}
                        alt={`Upload ${idx + 1}`}
                        className="w-20 h-20 object-cover rounded border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                        onClick={() => handleRemoveImage(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || formData.images.length >= 5}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Procesando...' : 'Subir Imagen'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  También puedes pegar imágenes desde el portapapeles (Ctrl+V) en la descripción
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Estado</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="in_progress">En Progreso</SelectItem>
                      <SelectItem value="completed">Completado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridad</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baja</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Fecha de vencimiento</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color personalizado</Label>
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  disabled={isLoading}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Guardando...' : editingTask ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Image Modal */}
      <ImageModal
        isOpen={imageModalOpen}
        onClose={() => {
          setImageModalOpen(false);
          setSelectedImage('');
        }}
        imageSrc={selectedImage}
        alt="Task image"
      />

      {/* Comments Modal */}
      <CommentsModal
        isOpen={commentsModalOpen}
        onClose={() => {
          setCommentsModalOpen(false);
          setSelectedTaskForComments(null);
        }}
        task={selectedTaskForComments}
        onSaveComment={handleSaveComment}
      />
    </div>
  );
}
