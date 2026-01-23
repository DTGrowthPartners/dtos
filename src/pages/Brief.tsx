import { useState, useEffect, useCallback } from 'react';
import { FileText, Loader2, X } from 'lucide-react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BriefList } from '@/components/brief/BriefList';
import { BriefEditor } from '@/components/brief/BriefEditor';
import {
  loadAllBriefs,
  loadTemplates,
  createEmptyBrief,
  createBriefFromTemplate,
  duplicateBrief,
  deleteBrief,
  updateBrief,
  saveBriefAsTemplate,
  deleteTemplate,
  getBrief,
  getTemplate,
} from '@/lib/briefService';
import { loadProjects } from '@/lib/firestoreTaskService';
import { useAuthStore } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { Brief as BriefType, BriefTemplate } from '@/types/briefTypes';
import type { Project } from '@/types/taskTypes';

export default function Brief() {
  const [briefs, setBriefs] = useState<BriefType[]>([]);
  const [templates, setTemplates] = useState<BriefTemplate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(null);
  const [selectedBrief, setSelectedBrief] = useState<BriefType | null>(null);
  const [loading, setLoading] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Template dialog
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [briefToSaveAsTemplate, setBriefToSaveAsTemplate] = useState<string | null>(null);

  const { user } = useAuthStore();
  const { toast } = useToast();

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [briefsData, templatesData, projectsData] = await Promise.all([
          loadAllBriefs(),
          loadTemplates(),
          loadProjects(),
        ]);
        setBriefs(briefsData);
        setTemplates(templatesData);
        setProjects(projectsData);
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [toast]);

  // Load selected brief
  useEffect(() => {
    const loadSelectedBrief = async () => {
      if (!selectedBriefId) {
        setSelectedBrief(null);
        return;
      }

      try {
        const brief = await getBrief(selectedBriefId);
        setSelectedBrief(brief);
      } catch (error) {
        console.error('Error loading brief:', error);
        setSelectedBrief(null);
      }
    };

    loadSelectedBrief();
  }, [selectedBriefId]);

  // Handle create brief
  const handleCreateBrief = useCallback(async (projectId: string) => {
    if (!user) return;

    try {
      const briefId = await createEmptyBrief(projectId, 'Nuevo brief', user.id);
      const newBrief = await getBrief(briefId);
      if (newBrief) {
        setBriefs((prev) => [newBrief, ...prev]);
        setSelectedBriefId(briefId);
      }
      toast({
        title: 'Brief creado',
        description: 'Se ha creado un nuevo brief',
      });
    } catch (error) {
      console.error('Error creating brief:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear el brief',
        variant: 'destructive',
      });
    }
  }, [user, toast]);

  // Handle create from template
  const handleCreateFromTemplate = useCallback(async (projectId: string, templateId: string) => {
    if (!user) return;

    try {
      const template = await getTemplate(templateId);
      const briefId = await createBriefFromTemplate(
        templateId,
        projectId,
        template?.name || 'Brief desde template',
        user.id
      );
      const newBrief = await getBrief(briefId);
      if (newBrief) {
        setBriefs((prev) => [newBrief, ...prev]);
        setSelectedBriefId(briefId);
      }
      toast({
        title: 'Brief creado',
        description: 'Se ha creado el brief desde el template',
      });
    } catch (error) {
      console.error('Error creating brief from template:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear el brief',
        variant: 'destructive',
      });
    }
  }, [user, toast]);

  // Handle duplicate brief
  const handleDuplicateBrief = useCallback(async (briefId: string) => {
    try {
      const newBriefId = await duplicateBrief(briefId);
      const newBrief = await getBrief(newBriefId);
      if (newBrief) {
        setBriefs((prev) => [newBrief, ...prev]);
        setSelectedBriefId(newBriefId);
      }
      toast({
        title: 'Brief duplicado',
        description: 'Se ha creado una copia del brief',
      });
    } catch (error) {
      console.error('Error duplicating brief:', error);
      toast({
        title: 'Error',
        description: 'No se pudo duplicar el brief',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Handle delete brief
  const handleDeleteBrief = useCallback(async (briefId: string) => {
    try {
      await deleteBrief(briefId);
      setBriefs((prev) => prev.filter((b) => b.id !== briefId));
      if (selectedBriefId === briefId) {
        setSelectedBriefId(null);
        setSelectedBrief(null);
      }
      toast({
        title: 'Brief eliminado',
        description: 'El brief ha sido eliminado',
      });
    } catch (error) {
      console.error('Error deleting brief:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el brief',
        variant: 'destructive',
      });
    }
  }, [selectedBriefId, toast]);

  // Handle save brief
  const handleSaveBrief = useCallback(async (updates: Partial<BriefType>) => {
    if (!selectedBriefId) return;

    try {
      await updateBrief(selectedBriefId, updates);
      setBriefs((prev) =>
        prev.map((b) =>
          b.id === selectedBriefId ? { ...b, ...updates, updatedAt: Date.now() } : b
        )
      );
    } catch (error) {
      console.error('Error saving brief:', error);
      throw error;
    }
  }, [selectedBriefId]);

  // Handle save as template
  const handleSaveAsTemplate = useCallback((briefId: string) => {
    setBriefToSaveAsTemplate(briefId);
    setTemplateName('');
    setTemplateDialogOpen(true);
  }, []);

  const confirmSaveAsTemplate = useCallback(async () => {
    if (!briefToSaveAsTemplate || !templateName.trim()) return;

    setSavingTemplate(true);
    try {
      const brief = briefs.find((b) => b.id === briefToSaveAsTemplate);
      if (!brief) throw new Error('Brief not found');

      const templateId = await saveBriefAsTemplate(brief, templateName.trim());
      const newTemplate = await getTemplate(templateId);
      if (newTemplate) {
        setTemplates((prev) => [...prev, newTemplate]);
      }
      toast({
        title: 'Template creado',
        description: 'El brief se ha guardado como template',
      });
      setTemplateDialogOpen(false);
    } catch (error) {
      console.error('Error saving as template:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el template',
        variant: 'destructive',
      });
    } finally {
      setSavingTemplate(false);
    }
  }, [briefToSaveAsTemplate, templateName, briefs, toast]);

  // Handle delete template
  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    try {
      await deleteTemplate(templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      toast({
        title: 'Template eliminado',
        description: 'El template ha sido eliminado',
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el template',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Handle select template (show preview or info)
  const handleSelectTemplate = useCallback((templateId: string) => {
    // For now, just show a toast
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      toast({
        title: template.name,
        description: `Template con ${template.blocks.length} bloques`,
      });
    }
  }, [templates, toast]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <ResizablePanelGroup direction="horizontal">
        {/* Left Panel - Brief List */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          <BriefList
            briefs={briefs}
            templates={templates}
            projects={projects}
            selectedBriefId={selectedBriefId}
            onSelectBrief={setSelectedBriefId}
            onCreateBrief={handleCreateBrief}
            onCreateFromTemplate={handleCreateFromTemplate}
            onDuplicateBrief={handleDuplicateBrief}
            onDeleteBrief={handleDeleteBrief}
            onSaveAsTemplate={handleSaveAsTemplate}
            onSelectTemplate={handleSelectTemplate}
            onDeleteTemplate={handleDeleteTemplate}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - Brief Editor */}
        <ResizablePanel defaultSize={75}>
          {selectedBrief ? (
            <BriefEditor
              brief={selectedBrief}
              onSave={handleSaveBrief}
              onImageClick={setImagePreview}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <FileText className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Selecciona un brief</p>
              <p className="text-sm">o crea uno nuevo desde el panel izquierdo</p>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Image Preview Dialog */}
      {imagePreview && (
        <Dialog open={!!imagePreview} onOpenChange={() => setImagePreview(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
            <button
              onClick={() => setImagePreview(null)}
              className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full h-full object-contain"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Save as Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar como template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Nombre del template</Label>
              <Input
                id="templateName"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Ej: Instalacion Shopify POS"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTemplateDialogOpen(false)}
              disabled={savingTemplate}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmSaveAsTemplate}
              disabled={!templateName.trim() || savingTemplate}
            >
              {savingTemplate ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
