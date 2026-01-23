// ============= BRIEF TYPES =============

export type BriefBlockType =
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'paragraph'
  | 'checklist'
  | 'image'
  | 'link'
  | 'divider'
  | 'callout';

export type CalloutVariant = 'info' | 'warning' | 'success' | 'error';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface BriefBlock {
  id: string;
  type: BriefBlockType;
  content: string;
  items?: ChecklistItem[];      // Para checklist
  variant?: CalloutVariant;     // Para callout
  metadata?: Record<string, string>;  // Para datos adicionales (ej: titulo de link)
  order: number;
}

export interface Brief {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  blocks: BriefBlock[];
  isTemplate: boolean;
  templateId?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface BriefTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  blocks: Omit<BriefBlock, 'id'>[];
  createdAt: number;
  updatedAt?: number;
  createdBy: string;
}

// Helper types
export type NewBrief = Omit<Brief, 'id' | 'createdAt' | 'updatedAt'>;
export type NewBriefTemplate = Omit<BriefTemplate, 'id' | 'createdAt' | 'updatedAt'>;
export type NewBriefBlock = Omit<BriefBlock, 'id'>;

// Block options for command menu
export interface BlockOption {
  type: BriefBlockType;
  label: string;
  description: string;
  shortcut: string;
  icon: string;
}

export const BLOCK_OPTIONS: BlockOption[] = [
  { type: 'heading1', label: 'Encabezado 1', description: 'Título principal', shortcut: '/h1', icon: 'heading1' },
  { type: 'heading2', label: 'Encabezado 2', description: 'Subtítulo', shortcut: '/h2', icon: 'heading2' },
  { type: 'heading3', label: 'Encabezado 3', description: 'Sección', shortcut: '/h3', icon: 'heading3' },
  { type: 'paragraph', label: 'Texto', description: 'Párrafo de texto libre', shortcut: '/texto', icon: 'text' },
  { type: 'checklist', label: 'Lista de tareas', description: 'Lista con checkbox', shortcut: '/check', icon: 'checkSquare' },
  { type: 'image', label: 'Imagen', description: 'Screenshot o imagen', shortcut: '/img', icon: 'image' },
  { type: 'link', label: 'Enlace', description: 'Link externo', shortcut: '/link', icon: 'link' },
  { type: 'divider', label: 'Separador', description: 'Línea divisoria', shortcut: '/div', icon: 'minus' },
  { type: 'callout', label: 'Nota destacada', description: 'Información importante', shortcut: '/nota', icon: 'alertCircle' },
];
