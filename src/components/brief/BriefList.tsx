import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Plus, MoreVertical, Copy, Trash2, BookTemplate, FolderOutput } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Brief, BriefTemplate } from '@/types/briefTypes';
import type { Project } from '@/types/taskTypes';

interface BriefListProps {
  briefs: Brief[];
  templates: BriefTemplate[];
  projects: Project[];
  allProjects?: Project[]; // All projects for duplicate to other project
  selectedBriefId: string | null;
  onSelectBrief: (briefId: string) => void;
  onCreateBrief: (projectId: string) => void;
  onCreateFromTemplate: (projectId: string, templateId: string) => void;
  onDuplicateBrief: (briefId: string) => void;
  onDuplicateBriefToProject?: (briefId: string, targetProjectId: string) => void;
  onDeleteBrief: (briefId: string) => void;
  onSaveAsTemplate: (briefId: string) => void;
  onSelectTemplate: (templateId: string) => void;
  onDeleteTemplate: (templateId: string) => void;
}

export function BriefList({
  briefs,
  templates,
  projects,
  allProjects,
  selectedBriefId,
  onSelectBrief,
  onCreateBrief,
  onCreateFromTemplate,
  onDuplicateBrief,
  onDuplicateBriefToProject,
  onDeleteBrief,
  onSaveAsTemplate,
  onSelectTemplate,
  onDeleteTemplate,
}: BriefListProps) {
  // Get other projects for duplicate submenu (exclude current project)
  const otherProjects = (allProjects || []).filter(p => !p.archived && !projects.some(cp => cp.id === p.id));
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(projects.map(p => p.id)));
  const [expandedTemplates, setExpandedTemplates] = useState(true);

  // Group briefs by project
  const briefsByProject = projects.reduce((acc, project) => {
    acc[project.id] = briefs.filter(b => b.projectId === project.id);
    return acc;
  }, {} as Record<string, Brief[]>);

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">Briefs</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* Projects Section */}
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground px-2 mb-2 uppercase tracking-wider">
            Proyectos
          </p>

          {projects.filter(p => !p.archived).map((project) => {
            const projectBriefs = briefsByProject[project.id] || [];
            const isExpanded = expandedProjects.has(project.id);

            return (
              <div key={project.id} className="mb-1">
                {/* Project Header */}
                <div className="flex items-center gap-1 group">
                  <button
                    onClick={() => toggleProject(project.id)}
                    className="flex items-center gap-2 flex-1 px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className={cn('w-2 h-2 rounded-full', project.color)} />
                    <span className="text-sm font-medium truncate">{project.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {projectBriefs.length}
                    </span>
                  </button>

                  {/* Add Brief Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onCreateBrief(project.id)}>
                        <FileText className="h-4 w-4 mr-2" />
                        Brief vacio
                      </DropdownMenuItem>
                      {templates.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <p className="text-xs text-muted-foreground px-2 py-1">
                            Desde template
                          </p>
                          {templates.map((template) => (
                            <DropdownMenuItem
                              key={template.id}
                              onClick={() => onCreateFromTemplate(project.id, template.id)}
                            >
                              <BookTemplate className="h-4 w-4 mr-2" />
                              {template.name}
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Project Briefs */}
                {isExpanded && (
                  <div className="ml-4 border-l border-border pl-2 mt-1 space-y-0.5">
                    {projectBriefs.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 px-2">
                        Sin briefs
                      </p>
                    ) : (
                      projectBriefs.map((brief) => (
                        <div key={brief.id} className="group flex items-center">
                          <button
                            onClick={() => onSelectBrief(brief.id)}
                            className={cn(
                              'flex items-center gap-2 flex-1 px-2 py-1.5 rounded-md text-left transition-colors text-sm',
                              selectedBriefId === brief.id
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            )}
                          >
                            <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{brief.title}</span>
                          </button>

                          {/* Brief Actions */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  'h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity',
                                  selectedBriefId === brief.id && 'opacity-100'
                                )}
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onDuplicateBrief(brief.id)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicar
                              </DropdownMenuItem>
                              {otherProjects.length > 0 && onDuplicateBriefToProject && (
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>
                                    <FolderOutput className="h-4 w-4 mr-2" />
                                    Duplicar a otro proyecto
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent>
                                    {otherProjects.map((proj) => (
                                      <DropdownMenuItem
                                        key={proj.id}
                                        onClick={() => onDuplicateBriefToProject(brief.id, proj.id)}
                                      >
                                        <div className={cn('w-2 h-2 rounded-full mr-2', proj.color)} />
                                        {proj.name}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                              )}
                              <DropdownMenuItem onClick={() => onSaveAsTemplate(brief.id)}>
                                <BookTemplate className="h-4 w-4 mr-2" />
                                Guardar como template
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onDeleteBrief(brief.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Templates Section */}
        {templates.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-1">
              <button
                onClick={() => setExpandedTemplates(!expandedTemplates)}
                className="flex items-center gap-2 flex-1 px-2 py-1.5 text-left"
              >
                {expandedTemplates ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Templates
                </span>
              </button>
            </div>

            {expandedTemplates && (
              <div className="space-y-0.5 ml-2">
                {templates.map((template) => (
                  <div key={template.id} className="group flex items-center">
                    <button
                      onClick={() => onSelectTemplate(template.id)}
                      className="flex items-center gap-2 flex-1 px-2 py-1.5 rounded-md hover:bg-muted text-left transition-colors text-sm"
                    >
                      <BookTemplate className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{template.name}</span>
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onDeleteTemplate(template.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar template
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
