// DTOs para el módulo CRM / Pipeline de Ventas

// ==================== Deal Stage DTOs ====================
export interface DealStageDto {
  id: string;
  name: string;
  slug: string;
  position: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
  dealsCount?: number;
  totalValue?: number;
}

// ==================== Deal DTOs ====================
export interface CreateDealDto {
  name: string;
  company?: string;
  phone?: string;
  phoneCountryCode?: string;
  email?: string;
  stageId: string;
  estimatedValue?: number;
  currency?: string;
  serviceId?: string;
  serviceNotes?: string;
  source?: string;
  sourceDetail?: string;
  ownerId?: string;
  expectedCloseDate?: string;
  notes?: string;
  // CRM v2 fields
  probability?: number;
  priority?: string;
  nextFollowUp?: string;
  tags?: string[];
}

export interface UpdateDealDto {
  name?: string;
  company?: string;
  phone?: string;
  phoneCountryCode?: string;
  email?: string;
  stageId?: string;
  estimatedValue?: number;
  currency?: string;
  serviceId?: string;
  serviceNotes?: string;
  source?: string;
  sourceDetail?: string;
  ownerId?: string;
  firstContactAt?: string;
  meetingScheduledAt?: string;
  proposalSentAt?: string;
  expectedCloseDate?: string;
  notes?: string;
  // CRM v2 fields
  probability?: number;
  priority?: string;
  nextFollowUp?: string;
  tags?: string[];
}

export interface DealDto {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  phoneCountryCode: string;
  email?: string;
  stageId: string;
  stage?: DealStageDto;
  estimatedValue?: number;
  currency: string;
  serviceId?: string;
  service?: {
    id: string;
    name: string;
    icon: string;
  };
  serviceNotes?: string;
  source?: string;
  sourceDetail?: string;
  ownerId?: string;
  owner?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  firstContactAt?: string;
  meetingScheduledAt?: string;
  proposalSentAt?: string;
  expectedCloseDate?: string;
  closedAt?: string;
  lostReason?: string;
  lostNotes?: string;
  notes?: string;
  // CRM v2 fields
  probability?: number;
  priority?: string;
  nextFollowUp?: string;
  lastInteractionAt?: string;
  tags?: string[];
  daysSinceInteraction?: number;
  alerts?: DealAlert[];
  // Relations
  activities?: DealActivityDto[];
  reminders?: DealReminderDto[];
  nextReminder?: DealReminderDto;
  daysInStage?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ==================== Deal Alert DTO ====================
export interface DealAlert {
  type: 'follow_up_overdue' | 'high_value_dormant' | 'no_interaction' | 'meeting_reminder';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'urgent';
}

export interface ChangeStageDto {
  stageId: string;
  notes?: string;
}

export interface MarkAsLostDto {
  reason: string;
  notes?: string;
}

export interface MarkAsWonDto {
  finalValue: number;
  notes?: string;
}

// ==================== Deal Activity DTOs ====================
export type ActivityType = 'call' | 'whatsapp' | 'email' | 'meeting' | 'note' | 'stage_change';

export interface CreateActivityDto {
  type: ActivityType;
  title?: string;
  description?: string;
}

export interface DealActivityDto {
  id: string;
  dealId: string;
  type: ActivityType;
  title?: string;
  description?: string;
  fromStageId?: string;
  fromStage?: {
    id: string;
    name: string;
    color: string;
  };
  toStageId?: string;
  toStage?: {
    id: string;
    name: string;
    color: string;
  };
  performedBy: string;
  performedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  performedAt: string;
}

// ==================== Deal Reminder DTOs ====================
export interface CreateReminderDto {
  title: string;
  remindAt: string;
  assignedTo?: string;
}

export interface DealReminderDto {
  id: string;
  dealId: string;
  deal?: {
    id: string;
    name: string;
    company?: string;
  };
  title: string;
  remindAt: string;
  isCompleted: boolean;
  completedAt?: string;
  assignedTo?: string;
  assignedToUser?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdBy: string;
  createdAt: string;
}

// ==================== Metrics DTOs ====================
export interface PipelineMetricsDto {
  pipelineValue: number;
  activeDeals: number;
  stagesBreakdown: {
    stageId: string;
    stageName: string;
    stageColor: string;
    count: number;
    value: number;
  }[];
  dealsNeedingFollowUp: number;
}

export interface PerformanceMetricsDto {
  winRate: number;
  averageSalesCycle: number; // in days
  totalWon: number;
  totalLost: number;
  wonValue: number;
  lostReasons: {
    reason: string;
    count: number;
    percentage: number;
  }[];
}

// ==================== Constants ====================
export const LOST_REASONS = [
  { value: 'precio', label: 'Precio muy alto' },
  { value: 'competencia', label: 'Eligió competencia' },
  { value: 'timing', label: 'No es el momento' },
  { value: 'no_necesita', label: 'No necesita el servicio' },
  { value: 'sin_respuesta', label: 'No respondió' },
  { value: 'no_califica', label: 'No califica como cliente' },
  { value: 'otro', label: 'Otro' },
] as const;

export const DEAL_SOURCES = [
  { value: 'referido', label: 'Referido' },
  { value: 'pauta', label: 'Pauta publicitaria' },
  { value: 'web', label: 'Sitio web' },
  { value: 'redes_sociales', label: 'Redes sociales' },
  { value: 'evento', label: 'Evento/Networking' },
  { value: 'llamada_fria', label: 'Llamada en frío' },
  { value: 'otro', label: 'Otro' },
] as const;

export const ACTIVITY_TYPES = [
  { value: 'call', label: 'Llamada', icon: 'Phone' },
  { value: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle' },
  { value: 'email', label: 'Email', icon: 'Mail' },
  { value: 'meeting', label: 'Reunión', icon: 'Users' },
  { value: 'note', label: 'Nota', icon: 'FileText' },
  { value: 'stage_change', label: 'Cambio de etapa', icon: 'ArrowRight' },
] as const;

export const DEAL_PRIORITIES = [
  { value: 'baja', label: 'Baja', color: '#6B7280' },
  { value: 'media', label: 'Media', color: '#3B82F6' },
  { value: 'alta', label: 'Alta', color: '#F59E0B' },
  { value: 'urgente', label: 'Urgente', color: '#EF4444' },
] as const;
