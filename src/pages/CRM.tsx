import { useState, useEffect } from 'react';
import { Plus, Search, Phone, Mail, Building2, DollarSign, Calendar, Clock, MessageCircle, ChevronRight, X, MoreHorizontal, Filter, TrendingUp, AlertTriangle, Tag, Gauge, CheckSquare, ImagePlus, Trash2, RotateCcw } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { convertImageToBase64 } from '@/lib/imageService';
import { ScheduleMeetingDialog } from '@/components/crm/ScheduleMeetingDialog';

// Source Icons
const ShopifyIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 256 292" className={className} preserveAspectRatio="xMidYMid">
    <path d="M223.774 57.34c-.201-1.46-1.48-2.268-2.537-2.357-1.055-.088-23.383-1.743-23.383-1.743s-15.507-15.395-17.209-17.099c-1.703-1.703-5.029-1.185-6.32-.805-.19.056-3.388 1.043-8.678 2.68-5.18-14.906-14.322-28.604-30.405-28.604-.444 0-.901.018-1.358.044C129.31 3.407 123.644.779 118.75.779c-37.465 0-55.364 46.835-60.976 70.635-14.558 4.511-24.9 7.718-26.221 8.133-8.126 2.549-8.383 2.805-9.45 10.462C21.3 95.806.038 260.235.038 260.235l165.678 31.042 89.77-19.42S223.973 58.8 223.775 57.34zM156.49 40.848l-14.019 4.339c.005-.988.01-1.96.01-3.023 0-9.264-1.286-16.723-3.349-22.636 8.287 1.04 13.806 10.469 17.358 21.32zm-27.638-19.483c2.304 5.773 3.802 14.058 3.802 25.238 0 .572-.005 1.095-.01 1.624-9.117 2.824-19.024 5.89-28.953 8.966 5.575-21.516 16.025-31.908 25.161-35.828zm-11.131-10.537c1.617 0 3.246.549 4.805 1.622-12.007 5.65-24.877 19.88-30.312 48.297l-22.886 7.088C75.694 46.16 90.81 10.828 117.72 10.828z" fill="#95BF46" />
    <path d="M221.237 54.983c-1.055-.088-23.383-1.743-23.383-1.743s-15.507-15.395-17.209-17.099c-.637-.634-1.496-.959-2.394-1.099l-12.527 256.233 89.762-19.418S223.972 58.8 223.774 57.34c-.201-1.46-1.48-2.268-2.537-2.357" fill="#5E8E3E" />
    <path d="M135.242 104.585l-11.069 32.926s-9.698-5.176-21.586-5.176c-17.428 0-18.305 10.937-18.305 13.693 0 15.038 39.2 20.8 39.2 56.024 0 27.713-17.577 45.558-41.277 45.558-28.44 0-42.984-17.7-42.984-17.7l7.615-25.16s14.95 12.835 27.565 12.835c8.243 0 11.596-6.49 11.596-11.232 0-19.616-32.16-20.491-32.16-52.724 0-27.129 19.472-53.382 58.778-53.382 15.145 0 22.627 4.338 22.627 4.338" fill="#FFF" />
  </svg>
);

const WordPressIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 122.52 122.523" className={className}>
    <g fill="#21759b">
      <path d="m8.708 61.26c0 20.802 12.089 38.779 29.619 47.298l-25.069-68.686c-2.916 6.536-4.55 13.769-4.55 21.388z" />
      <path d="m96.74 58.608c0-6.495-2.333-10.993-4.334-14.494-2.664-4.329-5.161-7.995-5.161-12.324 0-4.831 3.664-9.328 8.825-9.328.233 0 .454.029.681.042-9.35-8.566-21.807-13.796-35.489-13.796-18.36 0-34.513 9.42-43.91 23.688 1.233.037 2.395.063 3.382.063 5.497 0 14.006-.667 14.006-.667 2.833-.167 3.167 3.994.337 4.329 0 0-2.847.335-6.015.501l19.138 56.925 11.501-34.493-8.188-22.434c-2.83-.166-5.511-.501-5.511-.501-2.832-.166-2.5-4.496.332-4.329 0 0 8.679.667 13.843.667 5.496 0 14.006-.667 14.006-.667 2.835-.167 3.168 3.994.337 4.329 0 0-2.853.335-6.015.501l18.992 56.494 5.242-17.517c2.272-7.269 4.001-12.49 4.001-16.989z" />
      <path d="m62.184 65.857-15.768 45.819c4.708 1.384 9.687 2.141 14.846 2.141 6.12 0 11.989-1.058 17.452-2.979-.141-.225-.269-.464-.374-.724z" />
      <path d="m107.376 36.046c.226 1.674.354 3.471.354 5.404 0 5.333-.996 11.328-3.996 18.824l-16.053 46.413c15.624-9.111 26.133-26.038 26.133-45.426.001-9.137-2.333-17.729-6.438-25.215z" />
      <path d="m61.262 0c-33.779 0-61.262 27.481-61.262 61.26 0 33.783 27.483 61.263 61.262 61.263 33.778 0 61.265-27.48 61.265-61.263-.001-33.779-27.487-61.26-61.265-61.26zm0 119.715c-32.23 0-58.453-26.223-58.453-58.455 0-32.23 26.222-58.451 58.453-58.451 32.229 0 58.45 26.221 58.45 58.451 0 32.232-26.221 58.455-58.45 58.455z" />
    </g>
  </svg>
);

const SlackIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 2447.6 2452.5" className={className}>
    <g clipRule="evenodd" fillRule="evenodd">
      <path d="m897.4 0c-135.3.1-244.8 109.9-244.7 245.2-.1 135.3 109.5 245.1 244.8 245.2h244.8v-245.1c.1-135.3-109.5-245.1-244.9-245.3.1 0 .1 0 0 0m0 654h-652.6c-135.3.1-244.9 109.9-244.8 245.2-.2 135.3 109.4 245.1 244.7 245.3h652.7c135.3-.1 244.9-109.9 244.8-245.2.1-135.4-109.5-245.2-244.8-245.3z" fill="#36c5f0" />
      <path d="m2447.6 899.2c.1-135.3-109.5-245.1-244.8-245.2-135.3.1-244.9 109.9-244.8 245.2v245.3h244.8c135.3-.1 244.9-109.9 244.8-245.3zm-652.7 0v-654c.1-135.2-109.4-245-244.7-245.2-135.3.1-244.9 109.9-244.8 245.2v654c-.2 135.3 109.4 245.1 244.7 245.3 135.3-.1 244.9-109.9 244.8-245.3z" fill="#2eb67d" />
      <path d="m1550.1 2452.5c135.3-.1 244.9-109.9 244.8-245.2.1-135.3-109.5-245.1-244.8-245.2h-244.8v245.2c-.1 135.2 109.5 245 244.8 245.2zm0-654.1h652.7c135.3-.1 244.9-109.9 244.8-245.2.2-135.3-109.4-245.1-244.7-245.3h-652.7c-135.3.1-244.9 109.9-244.8 245.2-.1 135.4 109.4 245.2 244.7 245.3z" fill="#ecb22e" />
      <path d="m0 1553.2c-.1 135.3 109.5 245.1 244.8 245.2 135.3-.1 244.9-109.9 244.8-245.2v-245.2h-244.8c-135.3.1-244.9 109.9-244.8 245.2zm652.7 0v654c-.2 135.3 109.4 245.1 244.7 245.3 135.3-.1 244.9-109.9 244.8-245.2v-653.9c.2-135.3-109.4-245.1-244.7-245.3-135.4 0-244.9 109.8-244.8 245.1 0 0 0 .1 0 0" fill="#e01e5a" />
    </g>
  </svg>
);

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg fill="none" viewBox="0 0 360 362" className={className}>
    <path fill="#25D366" fillRule="evenodd" d="M307.546 52.566C273.709 18.684 228.706.017 180.756 0 81.951 0 1.538 80.404 1.504 179.235c-.017 31.594 8.242 62.432 23.928 89.609L0 361.736l95.024-24.925c26.179 14.285 55.659 21.805 85.655 21.814h.077c98.788 0 179.21-80.413 179.244-179.244.017-47.898-18.608-92.926-52.454-126.807v-.008Zm-126.79 275.788h-.06c-26.73-.008-52.952-7.194-75.831-20.765l-5.44-3.231-56.391 14.791 15.05-54.981-3.542-5.638c-14.912-23.721-22.793-51.139-22.776-79.286.035-82.14 66.867-148.973 149.051-148.973 39.793.017 77.198 15.53 105.328 43.695 28.131 28.157 43.61 65.596 43.593 105.398-.035 82.149-66.867 148.982-148.982 148.982v.008Zm81.719-111.577c-4.478-2.243-26.497-13.073-30.606-14.568-4.108-1.496-7.09-2.243-10.073 2.243-2.982 4.487-11.568 14.577-14.181 17.559-2.613 2.991-5.226 3.361-9.704 1.117-4.477-2.243-18.908-6.97-36.02-22.226-13.313-11.878-22.304-26.54-24.916-31.027-2.613-4.486-.275-6.91 1.959-9.136 2.011-2.011 4.478-5.234 6.721-7.847 2.244-2.613 2.983-4.486 4.478-7.469 1.496-2.991.748-5.603-.369-7.847-1.118-2.243-10.073-24.289-13.812-33.253-3.636-8.732-7.331-7.546-10.073-7.692-2.613-.13-5.595-.155-8.586-.155-2.991 0-7.839 1.118-11.947 5.604-4.108 4.486-15.677 15.324-15.677 37.361s16.047 43.344 18.29 46.335c2.243 2.991 31.585 48.225 76.51 67.632 10.684 4.615 19.029 7.374 25.535 9.437 10.727 3.412 20.49 2.931 28.208 1.779 8.604-1.289 26.498-10.838 30.228-21.298 3.73-10.46 3.73-19.433 2.613-21.298-1.117-1.865-4.108-2.991-8.586-5.234l.008-.017Z" clipRule="evenodd" />
  </svg>
);

const MetaIcon = ({ className }: { className?: string }) => (
  <svg preserveAspectRatio="xMidYMid" viewBox="0 0 256 171" className={className}>
    <defs>
      <linearGradient id="meta__a" x1="13.878%" x2="89.144%" y1="55.934%" y2="58.694%">
        <stop offset="0%" stopColor="#0064E1" />
        <stop offset="40%" stopColor="#0064E1" />
        <stop offset="83%" stopColor="#0073EE" />
        <stop offset="100%" stopColor="#0082FB" />
      </linearGradient>
      <linearGradient id="meta__b" x1="54.315%" x2="54.315%" y1="82.782%" y2="39.307%">
        <stop offset="0%" stopColor="#0082FB" />
        <stop offset="100%" stopColor="#0064E0" />
      </linearGradient>
    </defs>
    <path fill="#0081FB" d="M27.651 112.136c0 9.775 2.146 17.28 4.95 21.82 3.677 5.947 9.16 8.466 14.751 8.466 7.211 0 13.808-1.79 26.52-19.372 10.185-14.092 22.186-33.874 30.26-46.275l13.675-21.01c9.499-14.591 20.493-30.811 33.1-41.806C161.196 4.985 172.298 0 183.47 0c18.758 0 36.625 10.87 50.3 31.257C248.735 53.584 256 81.707 256 110.729c0 17.253-3.4 29.93-9.187 39.946-5.591 9.686-16.488 19.363-34.818 19.363v-27.616c15.695 0 19.612-14.422 19.612-30.927 0-23.52-5.484-49.623-17.564-68.273-8.574-13.23-19.684-21.313-31.907-21.313-13.22 0-23.859 9.97-35.815 27.75-6.356 9.445-12.882 20.956-20.208 33.944l-8.066 14.289c-16.203 28.728-20.307 35.271-28.408 46.07-14.2 18.91-26.324 26.076-42.287 26.076-18.935 0-30.91-8.2-38.325-20.556C2.973 139.413 0 126.202 0 111.148l27.651.988Z" />
    <path fill="url(#meta__a)" d="M21.802 33.206C34.48 13.666 52.774 0 73.757 0 85.91 0 97.99 3.597 110.605 13.897c13.798 11.261 28.505 29.805 46.853 60.368l6.58 10.967c15.881 26.459 24.917 40.07 30.205 46.49 6.802 8.243 11.565 10.7 17.752 10.7 15.695 0 19.612-14.422 19.612-30.927l24.393-.766c0 17.253-3.4 29.93-9.187 39.946-5.591 9.686-16.488 19.363-34.818 19.363-11.395 0-21.49-2.475-32.654-13.007-8.582-8.083-18.615-22.443-26.334-35.352l-22.96-38.352C118.528 64.08 107.96 49.73 101.845 43.23c-6.578-6.988-15.036-15.428-28.532-15.428-10.923 0-20.2 7.666-27.963 19.39L21.802 33.206Z" />
    <path fill="url(#meta__b)" d="M73.312 27.802c-10.923 0-20.2 7.666-27.963 19.39-10.976 16.568-17.698 41.245-17.698 64.944 0 9.775 2.146 17.28 4.95 21.82L9.027 149.482C2.973 139.413 0 126.202 0 111.148 0 83.772 7.514 55.24 21.802 33.206 34.48 13.666 52.774 0 73.757 0l-.445 27.802Z" />
  </svg>
);

// Types
interface DealStage {
  id: string;
  name: string;
  slug: string;
  position: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
  _count?: { deals: number };
}

interface DealAlert {
  type: 'follow_up_overdue' | 'high_value_dormant' | 'no_interaction' | 'meeting_reminder';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'urgent';
}

interface Deal {
  id: string;
  name: string;
  company?: string;
  logo?: string;
  phone?: string;
  phoneCountryCode: string;
  email?: string;
  stageId: string;
  stage?: DealStage;
  estimatedValue?: number;
  currency: string;
  serviceId?: string;
  service?: { id: string; name: string; icon: string };
  serviceNotes?: string;
  source?: string;
  sourceDetail?: string;
  ownerId?: string;
  owner?: { id: string; firstName: string; lastName: string; email: string };
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
  activities?: DealActivity[];
  reminders?: DealReminder[];
  nextReminder?: DealReminder;
  daysInStage?: number;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface DealActivity {
  id: string;
  dealId: string;
  type: string;
  title?: string;
  description?: string;
  fromStage?: { id: string; name: string; color: string };
  toStage?: { id: string; name: string; color: string };
  performedByUser?: { id: string; firstName: string; lastName: string };
  performedAt: string;
}

interface DealReminder {
  id: string;
  dealId: string;
  title: string;
  remindAt: string;
  isCompleted: boolean;
}

interface PipelineMetrics {
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

interface Service {
  id: string;
  name: string;
  icon: string;
}

const LOST_REASONS = [
  { value: 'precio', label: 'Precio muy alto' },
  { value: 'competencia', label: 'Eligio competencia' },
  { value: 'timing', label: 'No es el momento' },
  { value: 'no_necesita', label: 'No necesita el servicio' },
  { value: 'sin_respuesta', label: 'No respondio' },
  { value: 'no_califica', label: 'No califica como cliente' },
  { value: 'otro', label: 'Otro' },
];

const DEAL_SOURCES = [
  { value: 'referido', label: 'Referido', icon: null },
  { value: 'pauta', label: 'Pauta publicitaria', icon: null },
  { value: 'web', label: 'Sitio web', icon: null },
  { value: 'redes_sociales', label: 'Redes sociales', icon: null },
  { value: 'shopify', label: 'Shopify', icon: ShopifyIcon },
  { value: 'wordpress', label: 'WordPress', icon: WordPressIcon },
  { value: 'slack', label: 'Slack', icon: SlackIcon },
  { value: 'whatsapp', label: 'WhatsApp', icon: WhatsAppIcon },
  { value: 'meta', label: 'Meta Ads', icon: MetaIcon },
  { value: 'evento', label: 'Evento/Networking', icon: null },
  { value: 'llamada_fria', label: 'Llamada en frio', icon: null },
  { value: 'otro', label: 'Otro', icon: null },
];

const DEAL_PRIORITIES = [
  { value: 'baja', label: 'Baja', color: '#6B7280' },
  { value: 'media', label: 'Media', color: '#3B82F6' },
  { value: 'alta', label: 'Alta', color: '#F59E0B' },
  { value: 'urgente', label: 'Urgente', color: '#EF4444' },
];

const getAlertSeverityColor = (severity: string) => {
  switch (severity) {
    case 'urgent': return 'bg-red-500 text-white';
    case 'high': return 'bg-orange-500 text-white';
    case 'medium': return 'bg-yellow-500 text-black';
    default: return 'bg-gray-500 text-white';
  }
};

const getPriorityBadge = (priority: string) => {
  const p = DEAL_PRIORITIES.find(pr => pr.value === priority);
  return p ? { label: p.label, color: p.color } : { label: priority, color: '#6B7280' };
};

const formatCurrency = (value: number, currency: string = 'COP') => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatRelativeDate = (date: string) => {
  const now = new Date();
  const target = new Date(date);
  const diff = target.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Hoy';
  if (days === 1) return 'Manana';
  if (days === -1) return 'Ayer';
  if (days > 0) return `En ${days} dias`;
  return `Hace ${Math.abs(days)} dias`;
};

const getWhatsAppUrl = (phone: string, countryCode: string, stageName: string, dealName: string) => {
  const messages: Record<string, string> = {
    'nuevo': `Hola ${dealName}! Soy de DT Growth Partners, vi que estas interesado en nuestros servicios. Tienes un momento para conversar?`,
    'contactado': `Hola ${dealName}! Siguiendo nuestra conversacion, te gustaria agendar una llamada para conocer mas sobre como podemos ayudarte?`,
    'reunion': `Hola ${dealName}! Te confirmo nuestra reunion. Todo bien para la fecha acordada?`,
    'propuesta': `Hola ${dealName}! Te comparto la propuesta que conversamos. Tienes alguna pregunta?`,
    'negociacion': `Hola ${dealName}! Has podido revisar la propuesta? Estoy pendiente de cualquier duda.`,
  };
  const message = messages[stageName] || `Hola ${dealName}!`;
  const fullPhone = `${countryCode}${phone}`.replace(/[^0-9+]/g, '');
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
};

export default function CRM() {
  const [stages, setStages] = useState<DealStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLostDialogOpen, setIsLostDialogOpen] = useState(false);
  const [isWonDialogOpen, setIsWonDialogOpen] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isMeetingDialogOpen, setIsMeetingDialogOpen] = useState(false);
  const [isTrashDialogOpen, setIsTrashDialogOpen] = useState(false);
  const [deletedDeals, setDeletedDeals] = useState<Deal[]>([]);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [dealToClose, setDealToClose] = useState<Deal | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    logo: '',
    phone: '',
    phoneCountryCode: '+57',
    email: '',
    stageId: '',
    estimatedValue: '',
    currency: 'COP',
    serviceId: '',
    serviceNotes: '',
    source: '',
    sourceDetail: '',
    expectedCloseDate: '',
    notes: '',
    // CRM v2 fields
    probability: 50,
    priority: 'media',
    nextFollowUp: '',
    tags: '',
  });

  const [lostFormData, setLostFormData] = useState({
    reason: '',
    notes: '',
  });

  const [wonFormData, setWonFormData] = useState({
    finalValue: '',
    notes: '',
  });

  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [stagesData, dealsData, servicesData, metricsData] = await Promise.all([
        apiClient.get<DealStage[]>('/api/crm/stages'),
        apiClient.get<Deal[]>('/api/crm/deals'),
        apiClient.get<Service[]>('/api/services'),
        apiClient.get<PipelineMetrics>('/api/crm/metrics/pipeline'),
      ]);
      setStages(stagesData);
      setDeals(dealsData);
      setServices(servicesData);
      setMetrics(metricsData);
      if (stagesData.length > 0 && !formData.stageId) {
        setFormData(prev => ({ ...prev, stageId: stagesData[0].id }));
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el pipeline',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadDealDetail = async (dealId: string) => {
    try {
      const deal = await apiClient.get<Deal>(`/api/crm/deals/${dealId}`);
      setSelectedDeal(deal);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el detalle del deal',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        estimatedValue: formData.estimatedValue ? parseFloat(formData.estimatedValue) : undefined,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        probability: formData.probability,
        nextFollowUp: formData.nextFollowUp || undefined,
      };

      if (editingDeal) {
        await apiClient.patch(`/api/crm/deals/${editingDeal.id}`, payload);
        toast({ title: 'Deal actualizado', description: 'El prospecto se actualizo correctamente' });
      } else {
        await apiClient.post('/api/crm/deals', payload);
        toast({ title: 'Deal creado', description: 'El prospecto se agrego al pipeline' });
      }

      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el deal',
        variant: 'destructive',
      });
    }
  };

  const handleChangeStage = async (dealId: string, newStageId: string) => {
    try {
      await apiClient.patch(`/api/crm/deals/${dealId}/stage`, { stageId: newStageId });
      toast({ title: 'Etapa actualizada' });
      loadData();
      if (selectedDeal?.id === dealId) {
        loadDealDetail(dealId);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cambiar la etapa',
        variant: 'destructive',
      });
    }
  };

  const handleMarkAsLost = async () => {
    if (!dealToClose) return;
    try {
      await apiClient.post(`/api/crm/deals/${dealToClose.id}/lost`, lostFormData);
      toast({ title: 'Deal marcado como perdido' });
      setIsLostDialogOpen(false);
      setDealToClose(null);
      setLostFormData({ reason: '', notes: '' });
      loadData();
      if (selectedDeal?.id === dealToClose.id) {
        setSelectedDeal(null);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo marcar como perdido',
        variant: 'destructive',
      });
    }
  };

  const handleMarkAsWon = async () => {
    if (!dealToClose) return;
    try {
      await apiClient.post(`/api/crm/deals/${dealToClose.id}/won`, {
        finalValue: parseFloat(wonFormData.finalValue),
        notes: wonFormData.notes,
      });
      toast({ title: 'Deal ganado!', description: 'Felicidades por cerrar el deal!' });
      setIsWonDialogOpen(false);
      setDealToClose(null);
      setWonFormData({ finalValue: '', notes: '' });
      loadData();
      if (selectedDeal?.id === dealToClose.id) {
        setSelectedDeal(null);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo marcar como ganado',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (dealId: string) => {
    if (!confirm('Estas seguro de eliminar este prospecto?')) return;
    try {
      // Close the panel first if this is the selected deal
      if (selectedDeal?.id === dealId) {
        setSelectedDeal(null);
      }
      await apiClient.delete(`/api/crm/deals/${dealId}`);
      toast({ title: 'Deal eliminado' });
      // Reload data separately to avoid showing error if reload fails
      loadData().catch(() => {
        // Silent catch - data will refresh on next interaction
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el deal',
        variant: 'destructive',
      });
    }
  };

  const handleCreateTask = async () => {
    if (!selectedDeal || !taskFormData.title) return;
    try {
      // Create task with deal context in title/description
      const taskPayload = {
        title: taskFormData.title,
        description: `[CRM - ${selectedDeal.name}${selectedDeal.company ? ` / ${selectedDeal.company}` : ''}]\n${taskFormData.description || ''}`.trim(),
        priority: taskFormData.priority,
        dueDate: taskFormData.dueDate || undefined,
        status: 'pending',
      };

      await apiClient.post('/api/tasks', taskPayload);

      // Log activity on the deal
      await apiClient.post(`/api/crm/deals/${selectedDeal.id}/activities`, {
        type: 'note',
        title: 'Tarea creada',
        description: taskFormData.title,
      });

      toast({ title: 'Tarea creada', description: 'La tarea se agrego correctamente' });
      setIsTaskDialogOpen(false);
      setTaskFormData({ title: '', description: '', priority: 'medium', dueDate: '' });
      loadDealDetail(selectedDeal.id);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo crear la tarea',
        variant: 'destructive',
      });
    }
  };

  const handleLogActivity = async (dealId: string, type: string, title: string) => {
    try {
      await apiClient.post(`/api/crm/deals/${dealId}/activities`, { type, title });
      toast({ title: 'Actividad registrada' });
      if (selectedDeal?.id === dealId) {
        loadDealDetail(dealId);
      }
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  // ==================== Trash Functions ====================
  const loadDeletedDeals = async () => {
    try {
      const data = await apiClient.get<Deal[]>('/api/crm/trash');
      setDeletedDeals(data);
    } catch (error) {
      console.error('Error loading deleted deals:', error);
    }
  };

  const handleRestoreDeal = async (dealId: string) => {
    try {
      await apiClient.post(`/api/crm/trash/${dealId}/restore`);
      toast({ title: 'Prospecto restaurado', description: 'El prospecto ha sido restaurado al pipeline' });
      loadDeletedDeals();
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo restaurar el prospecto',
        variant: 'destructive',
      });
    }
  };

  const handlePermanentDelete = async (dealId: string) => {
    if (!confirm('¿Estás seguro? Esta acción no se puede deshacer.')) return;
    try {
      await apiClient.delete(`/api/crm/trash/${dealId}`);
      toast({ title: 'Prospecto eliminado permanentemente' });
      loadDeletedDeals();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el prospecto',
        variant: 'destructive',
      });
    }
  };

  const handleEmptyTrash = async () => {
    if (!confirm('¿Estás seguro de vaciar la papelera? Esta acción eliminará todos los prospectos permanentemente.')) return;
    try {
      const result = await apiClient.delete<{ deleted: number; message: string }>('/api/crm/trash');
      toast({ title: 'Papelera vaciada', description: result.message });
      loadDeletedDeals();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo vaciar la papelera',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (deal: Deal) => {
    setEditingDeal(deal);
    setFormData({
      name: deal.name,
      company: deal.company || '',
      logo: deal.logo || '',
      phone: deal.phone || '',
      phoneCountryCode: deal.phoneCountryCode,
      email: deal.email || '',
      stageId: deal.stageId,
      estimatedValue: deal.estimatedValue?.toString() || '',
      currency: deal.currency,
      serviceId: deal.serviceId || '',
      serviceNotes: deal.serviceNotes || '',
      source: deal.source || '',
      sourceDetail: deal.sourceDetail || '',
      expectedCloseDate: deal.expectedCloseDate?.split('T')[0] || '',
      notes: deal.notes || '',
      // CRM v2 fields
      probability: deal.probability ?? 50,
      priority: deal.priority || 'media',
      nextFollowUp: deal.nextFollowUp?.split('T')[0] || '',
      tags: deal.tags?.join(', ') || '',
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      company: '',
      logo: '',
      phone: '',
      phoneCountryCode: '+57',
      email: '',
      stageId: stages[0]?.id || '',
      estimatedValue: '',
      currency: 'COP',
      serviceId: '',
      serviceNotes: '',
      source: '',
      sourceDetail: '',
      expectedCloseDate: '',
      notes: '',
      // CRM v2 fields
      probability: 50,
      priority: 'media',
      nextFollowUp: '',
      tags: '',
    });
    setEditingDeal(null);
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const newStageId = destination.droppableId;
    const dealId = draggableId;

    // Optimistic UI update
    const updatedDeals = deals.map((deal) => {
      if (deal.id === dealId) {
        return { ...deal, stageId: newStageId };
      }
      return deal;
    });

    setDeals(updatedDeals);

    try {
      await apiClient.patch(`/api/crm/deals/${dealId}/stage`, { stageId: newStageId });
      // Silent success or maybe a small toast
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo mover el prospecto',
        variant: 'destructive',
      });
      loadData(); // Revert on error
    }
  };

  const filteredDeals = deals.filter((deal) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      deal.name.toLowerCase().includes(searchLower) ||
      deal.company?.toLowerCase().includes(searchLower) ||
      deal.email?.toLowerCase().includes(searchLower)
    );
  });

  const getDealsByStage = (stageId: string) => {
    return filteredDeals.filter((deal) => deal.stageId === stageId);
  };

  const activeStages = stages.filter((s) => !s.isWon && !s.isLost);
  const wonStage = stages.find((s) => s.isWon);
  const lostStage = stages.find((s) => s.isLost);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM / Pipeline de Ventas</h1>
          <p className="text-muted-foreground">Gestiona tus prospectos y oportunidades</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => { loadDeletedDeals(); setIsTrashDialogOpen(true); }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Papelera
          </Button>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Prospecto
          </Button>
        </div>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Deals Activos</span>
              </div>
              <p className="text-2xl font-bold">{metrics.activeDeals}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Ingresos Esperados</span>
              </div>
              <p className="text-2xl font-bold">
                {formatCurrency(
                  deals
                    .filter(d => {
                      const dealStage = stages.find(s => s.id === d.stageId);
                      return dealStage?.slug === 'propuesta' || dealStage?.slug === 'negociacion';
                    })
                    .reduce((sum, d) => sum + (d.estimatedValue || 0), 0)
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Necesitan Seguimiento</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600">{metrics.dealsNeedingFollowUp}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Ganados</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {getDealsByStage(wonStage?.id || '').length}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar prospectos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 min-w-max">
            {activeStages.map((stage) => {
              const stageDeals = getDealsByStage(stage.id);
              const stageValue = stageDeals.reduce((sum, d) => sum + (d.estimatedValue || 0), 0);

              return (
                <div
                  key={stage.id}
                  className="w-80 flex-shrink-0 bg-muted/30 rounded-lg p-3"
                >
                  {/* Stage Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <h3 className="font-semibold">{stage.name}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {stageDeals.length}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(stageValue)}
                    </span>
                  </div>

                  {/* Deals */}
                  <Droppable droppableId={stage.id}>
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-3 min-h-[100px]"
                      >
                        {stageDeals.map((deal, index) => {
                          const priorityInfo = getPriorityBadge(deal.priority || 'media');
                          const hasUrgentAlert = deal.alerts?.some(a => a.severity === 'urgent');

                          return (
                            <Draggable key={deal.id} draggableId={deal.id} index={index}>
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                >
                                  <Card
                                    className={`cursor-pointer hover:shadow-md transition-shadow ${hasUrgentAlert ? 'border-red-400 border-2' : ''}`}
                                    onClick={() => loadDealDetail(deal.id)}
                                  >
                                    <CardContent className="p-3">
                                      {/* Alerts Banner */}
                                      {deal.alerts && deal.alerts.length > 0 && (
                                        <div className="mb-2 -mt-1 -mx-1">
                                          {deal.alerts.slice(0, 2).map((alert, idx) => (
                                            <div key={idx} className={`text-xs px-2 py-0.5 ${getAlertSeverityColor(alert.severity)} ${idx === 0 ? 'rounded-t' : ''}`}>
                                              <AlertTriangle className="h-3 w-3 inline mr-1" />
                                              {alert.message}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          {deal.logo && (
                                            <img src={deal.logo} alt="" className="h-8 w-8 rounded-md object-cover flex-shrink-0" />
                                          )}
                                          <div>
                                            <h4 className="font-medium text-sm">{deal.name}</h4>
                                            {deal.company && (
                                              <p className="text-xs text-muted-foreground">{deal.company}</p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          {deal.priority && deal.priority !== 'media' && (
                                            <Badge
                                              variant="outline"
                                              className="text-xs"
                                              style={{ borderColor: priorityInfo.color, color: priorityInfo.color }}
                                            >
                                              {priorityInfo.label}
                                            </Badge>
                                          )}
                                          {deal.daysInStage && deal.daysInStage > 5 && deal.daysInStage !== 0 && (
                                            <Badge variant="outline" className="text-xs text-yellow-600">
                                              {deal.daysInStage}d
                                            </Badge>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 mb-2">
                                        {deal.estimatedValue && deal.estimatedValue > 0 && (
                                          <span className="text-xs font-medium text-green-600">
                                            {formatCurrency(deal.estimatedValue, deal.currency)}
                                          </span>
                                        )}
                                        {deal.probability !== undefined && deal.probability !== 50 && deal.probability > 0 && (
                                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                            <Gauge className="h-3 w-3" />
                                            {deal.probability}%
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center flex-wrap gap-1 mb-3">
                                        {deal.source && (
                                          <Badge variant="outline" className="text-xs bg-slate-100 dark:bg-slate-800">
                                            {(() => {
                                              const sourceInfo = DEAL_SOURCES.find(s => s.value === deal.source);
                                              const SourceIcon = sourceInfo?.icon;
                                              return (
                                                <>
                                                  {SourceIcon && <SourceIcon className="h-3 w-3 mr-1" />}
                                                  {sourceInfo?.label || deal.source}
                                                </>
                                              );
                                            })()}
                                          </Badge>
                                        )}
                                        {deal.service && (
                                          <Badge variant="secondary" className="text-xs">
                                            {deal.service.name}
                                          </Badge>
                                        )}
                                        {deal.tags && deal.tags.slice(0, 2).map((tag, idx) => (
                                          <Badge key={idx} variant="outline" className="text-xs">
                                            <Tag className="h-2 w-2 mr-0.5" />
                                            {tag}
                                          </Badge>
                                        ))}
                                      </div>

                                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        {deal.phone && (
                                          <a
                                            href={getWhatsAppUrl(deal.phone, deal.phoneCountryCode, stage.slug, deal.name.split(' ')[0])}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() => handleLogActivity(deal.id, 'whatsapp', 'Mensaje WhatsApp')}
                                            className="flex items-center gap-1 px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded transition-colors"
                                          >
                                            <MessageCircle className="h-3 w-3" />
                                            WhatsApp
                                          </a>
                                        )}
                                        {deal.phone && (
                                          <a
                                            href={`tel:${deal.phoneCountryCode}${deal.phone}`}
                                            onClick={() => handleLogActivity(deal.id, 'call', 'Llamada')}
                                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded transition-colors"
                                          >
                                            <Phone className="h-3 w-3" />
                                          </a>
                                        )}
                                      </div>

                                      {(deal.nextReminder || deal.nextFollowUp) && (
                                        <div className="mt-2 pt-2 border-t flex items-center gap-1 text-xs text-muted-foreground">
                                          <Clock className="h-3 w-3" />
                                          <span>
                                            {deal.nextFollowUp
                                              ? `Seguimiento: ${formatRelativeDate(deal.nextFollowUp)}`
                                              : deal.nextReminder && formatRelativeDate(deal.nextReminder.remindAt)
                                            }
                                          </span>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                        {stageDeals.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            Sin prospectos
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Deal Detail Sheet */}
      <Sheet open={!!selectedDeal} onOpenChange={(open) => !open && setSelectedDeal(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedDeal && (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {selectedDeal.logo ? (
                      <img src={selectedDeal.logo} alt="" className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <SheetTitle>{selectedDeal.name}</SheetTitle>
                      {selectedDeal.company && (
                        <p className="text-sm text-muted-foreground">{selectedDeal.company}</p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(selectedDeal)}>
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => { setDealToClose(selectedDeal); setWonFormData({ finalValue: selectedDeal.estimatedValue?.toString() || '', notes: '' }); setIsWonDialogOpen(true); }}
                        className="text-green-600"
                      >
                        Marcar como Ganado
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { setDealToClose(selectedDeal); setIsLostDialogOpen(true); }}
                        className="text-red-600"
                      >
                        Marcar como Perdido
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(selectedDeal.id)}
                        className="text-destructive"
                      >
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Stage Selector */}
                <div>
                  <Label className="text-xs text-muted-foreground">Etapa</Label>
                  <Select
                    value={selectedDeal.stageId}
                    onValueChange={(value) => handleChangeStage(selectedDeal.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activeStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Contact Info */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Informacion de Contacto</h4>
                  {selectedDeal.phone && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedDeal.phoneCountryCode} {selectedDeal.phone}</span>
                      </div>
                      <div className="flex gap-1">
                        <a
                          href={getWhatsAppUrl(selectedDeal.phone, selectedDeal.phoneCountryCode, selectedDeal.stage?.slug || '', selectedDeal.name.split(' ')[0])}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleLogActivity(selectedDeal.id, 'whatsapp', 'Mensaje WhatsApp')}
                        >
                          <Button size="sm" className="bg-green-500 hover:bg-green-600">
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </a>
                        <a href={`tel:${selectedDeal.phoneCountryCode}${selectedDeal.phone}`}>
                          <Button size="sm" variant="outline">
                            <Phone className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  )}
                  {selectedDeal.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedDeal.email}</span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Deal Info */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Oportunidad</h4>
                  {selectedDeal.estimatedValue && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>Valor estimado: {formatCurrency(selectedDeal.estimatedValue, selectedDeal.currency)}</span>
                    </div>
                  )}
                  {selectedDeal.service && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>Servicio: {selectedDeal.service.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm group">
                    <button
                      onClick={() => {
                        const newDate = prompt(
                          'Fecha de cierre esperado (YYYY-MM-DD):',
                          selectedDeal.expectedCloseDate
                            ? new Date(selectedDeal.expectedCloseDate).toISOString().split('T')[0]
                            : new Date().toISOString().split('T')[0]
                        );
                        if (newDate) {
                          apiClient.put(`/api/crm/deals/${selectedDeal.id}`, {
                            expectedCloseDate: newDate
                          }).then(() => {
                            loadDealDetail(selectedDeal.id);
                            toast({ title: 'Fecha actualizada' });
                          }).catch(() => {
                            toast({ title: 'Error', description: 'No se pudo actualizar la fecha', variant: 'destructive' });
                          });
                        }
                      }}
                      className="flex items-center gap-2 hover:text-primary cursor-pointer"
                    >
                      <Calendar className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      <span>
                        Cierre esperado: {selectedDeal.expectedCloseDate
                          ? new Date(selectedDeal.expectedCloseDate).toLocaleDateString('es-CO')
                          : 'Sin fecha'}
                      </span>
                    </button>
                  </div>
                  {selectedDeal.source && (
                    <div className="flex items-center gap-2 text-sm">
                      {(() => {
                        const sourceInfo = DEAL_SOURCES.find(s => s.value === selectedDeal.source);
                        const SourceIcon = sourceInfo?.icon;
                        return SourceIcon ? <SourceIcon className="h-4 w-4" /> : <Filter className="h-4 w-4 text-muted-foreground" />;
                      })()}
                      <span>Fuente: {DEAL_SOURCES.find(s => s.value === selectedDeal.source)?.label || selectedDeal.source}</span>
                      {selectedDeal.sourceDetail && <span className="text-muted-foreground">({selectedDeal.sourceDetail})</span>}
                    </div>
                  )}
                  {selectedDeal.notes && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Notas:</p>
                      <p>{selectedDeal.notes}</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Quick Actions */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Acciones Rapidas</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsTaskDialogOpen(true)}
                      className="flex items-center gap-2"
                    >
                      <CheckSquare className="h-4 w-4" />
                      Crear Tarea
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsMeetingDialogOpen(true)}
                      className="flex items-center gap-2"
                    >
                      <Calendar className="h-4 w-4" />
                      Agendar Cita
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Activity Timeline */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Actividad Reciente</h4>
                  <ScrollArea className="h-64">
                    {selectedDeal.activities && selectedDeal.activities.length > 0 ? (
                      <div className="space-y-3">
                        {selectedDeal.activities.map((activity) => (
                          <div key={activity.id} className="flex gap-3 text-sm">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                              {activity.type === 'whatsapp' && <MessageCircle className="h-4 w-4 text-green-500" />}
                              {activity.type === 'call' && <Phone className="h-4 w-4 text-blue-500" />}
                              {activity.type === 'email' && <Mail className="h-4 w-4 text-purple-500" />}
                              {activity.type === 'stage_change' && <ChevronRight className="h-4 w-4 text-orange-500" />}
                              {activity.type === 'note' && <Building2 className="h-4 w-4 text-gray-500" />}
                              {activity.type === 'meeting' && <Calendar className="h-4 w-4 text-pink-500" />}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{activity.title}</p>
                              {activity.description && (
                                <p className="text-muted-foreground">{activity.description}</p>
                              )}
                              {activity.type === 'stage_change' && activity.fromStage && activity.toStage && (
                                <div className="flex items-center gap-1 text-xs mt-1">
                                  <Badge variant="outline" style={{ borderColor: activity.fromStage.color }}>
                                    {activity.fromStage.name}
                                  </Badge>
                                  <ChevronRight className="h-3 w-3" />
                                  <Badge variant="outline" style={{ borderColor: activity.toStage.color }}>
                                    {activity.toStage.name}
                                  </Badge>
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(activity.performedAt).toLocaleString('es-CO')}
                                {activity.performedByUser && ` - ${activity.performedByUser.firstName}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Sin actividad registrada
                      </p>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDeal ? 'Editar Prospecto' : 'Nuevo Prospecto'}</DialogTitle>
            <DialogDescription>
              {editingDeal ? 'Actualiza la informacion del prospecto' : 'Agrega un nuevo prospecto al pipeline'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* Logo Upload */}
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/50 flex-shrink-0">
                  {formData.logo ? (
                    <>
                      <img src={formData.logo} alt="Logo" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, logo: '' })}
                        className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-white rounded-full flex items-center justify-center hover:bg-destructive/90"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center h-full w-full hover:bg-muted/80 transition-colors">
                      <ImagePlus className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">Logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const base64 = await convertImageToBase64(file);
                              setFormData({ ...formData, logo: base64 });
                            } catch (error) {
                              console.error('Error converting image:', error);
                            }
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre del contacto *</Label>
                    <Input
                      id="name"
                      placeholder="Juan Perez"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Empresa</Label>
                    <Input
                      id="company"
                      placeholder="Mi Empresa S.A.S"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phoneCountryCode">Codigo</Label>
                  <Select
                    value={formData.phoneCountryCode}
                    onValueChange={(value) => setFormData({ ...formData, phoneCountryCode: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+57">+57 (CO)</SelectItem>
                      <SelectItem value="+1">+1 (US)</SelectItem>
                      <SelectItem value="+34">+34 (ES)</SelectItem>
                      <SelectItem value="+52">+52 (MX)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="phone">Telefono</Label>
                  <Input
                    id="phone"
                    placeholder="300 123 4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="juan@empresa.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estimatedValue">Valor estimado mensual</Label>
                  <Input
                    id="estimatedValue"
                    type="number"
                    placeholder="2500000"
                    value={formData.estimatedValue}
                    onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Moneda</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COP">COP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceId">Servicio de interes</Label>
                <Select
                  value={formData.serviceId}
                  onValueChange={(value) => setFormData({ ...formData, serviceId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="source">Fuente</Label>
                  <Select
                    value={formData.source}
                    onValueChange={(value) => setFormData({ ...formData, source: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Como llego" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEAL_SOURCES.map((source) => (
                        <SelectItem key={source.value} value={source.value}>
                          <div className="flex items-center gap-2">
                            {source.icon && <source.icon className="h-4 w-4" />}
                            {source.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sourceDetail">Detalle de fuente</Label>
                  <Input
                    id="sourceDetail"
                    placeholder="Ej: Referido por Juan"
                    value={formData.sourceDetail}
                    onChange={(e) => setFormData({ ...formData, sourceDetail: e.target.value })}
                  />
                </div>
              </div>

              {/* CRM v2 Fields */}
              <div className="grid grid-cols-2 gap-4">
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
                      {DEAL_PRIORITIES.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: priority.color }} />
                            {priority.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nextFollowUp">Proximo seguimiento</Label>
                  <Input
                    id="nextFollowUp"
                    type="date"
                    value={formData.nextFollowUp}
                    onChange={(e) => setFormData({ ...formData, nextFollowUp: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="probability">Probabilidad de cierre: {formData.probability}%</Label>
                <Slider
                  value={[formData.probability]}
                  onValueChange={(value) => setFormData({ ...formData, probability: value[0] })}
                  max={100}
                  step={5}
                  className="py-2"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Etiquetas (separadas por coma)</Label>
                <Input
                  id="tags"
                  placeholder="vip, urgente, descuento"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expectedCloseDate">Fecha esperada de cierre</Label>
                <Input
                  id="expectedCloseDate"
                  type="date"
                  value={formData.expectedCloseDate}
                  onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  placeholder="Notas adicionales sobre el prospecto..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingDeal ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lost Dialog */}
      <Dialog open={isLostDialogOpen} onOpenChange={setIsLostDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Perdido</DialogTitle>
            <DialogDescription>
              Indica la razon por la que se perdio este deal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Razon *</Label>
              <Select
                value={lostFormData.reason}
                onValueChange={(value) => setLostFormData({ ...lostFormData, reason: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar razon" />
                </SelectTrigger>
                <SelectContent>
                  {LOST_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notas adicionales</Label>
              <Textarea
                placeholder="Detalles adicionales..."
                value={lostFormData.notes}
                onChange={(e) => setLostFormData({ ...lostFormData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsLostDialogOpen(false); setDealToClose(null); }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleMarkAsLost} disabled={!lostFormData.reason}>
              Marcar como Perdido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Won Dialog */}
      <Dialog open={isWonDialogOpen} onOpenChange={setIsWonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Ganado</DialogTitle>
            <DialogDescription>
              Felicidades! Confirma el valor final del deal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Valor final *</Label>
              <Input
                type="number"
                placeholder="2500000"
                value={wonFormData.finalValue}
                onChange={(e) => setWonFormData({ ...wonFormData, finalValue: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Detalles del cierre..."
                value={wonFormData.notes}
                onChange={(e) => setWonFormData({ ...wonFormData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsWonDialogOpen(false); setDealToClose(null); }}>
              Cancelar
            </Button>
            <Button className="bg-green-500 hover:bg-green-600" onClick={handleMarkAsWon} disabled={!wonFormData.finalValue}>
              Confirmar Ganado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Tarea</DialogTitle>
            <DialogDescription>
              {selectedDeal && `Crear una tarea relacionada con ${selectedDeal.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Titulo *</Label>
              <Input
                placeholder="Ej: Enviar propuesta, Llamar para seguimiento..."
                value={taskFormData.title}
                onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descripcion</Label>
              <Textarea
                placeholder="Detalles adicionales de la tarea..."
                value={taskFormData.description}
                onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select
                  value={taskFormData.priority}
                  onValueChange={(value) => setTaskFormData({ ...taskFormData, priority: value })}
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
              <div className="space-y-2">
                <Label>Fecha limite</Label>
                <Input
                  type="date"
                  value={taskFormData.dueDate}
                  onChange={(e) => setTaskFormData({ ...taskFormData, dueDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsTaskDialogOpen(false); setTaskFormData({ title: '', description: '', priority: 'medium', dueDate: '' }); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTask} disabled={!taskFormData.title}>
              <CheckSquare className="h-4 w-4 mr-2" />
              Crear Tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Meeting Dialog */}
      <ScheduleMeetingDialog
        open={isMeetingDialogOpen}
        onOpenChange={setIsMeetingDialogOpen}
        dealId={selectedDeal?.id}
        dealName={selectedDeal?.name}
        contactEmail={selectedDeal?.email}
        onSuccess={async (event) => {
          // Log the activity
          if (selectedDeal) {
            try {
              await apiClient.post(`/api/crm/deals/${selectedDeal.id}/activities`, {
                type: 'meeting',
                description: `Cita agendada: ${event.title}${event.meetLink ? ` - ${event.meetLink}` : ''}`,
              });
              loadDealDetail(selectedDeal.id);
            } catch (error) {
              console.error('Error logging meeting activity:', error);
            }
          }
        }}
      />

      {/* Trash Dialog (Papelera) */}
      <Dialog open={isTrashDialogOpen} onOpenChange={setIsTrashDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Papelera
            </DialogTitle>
            <DialogDescription>
              Prospectos eliminados. Puedes restaurarlos o eliminarlos permanentemente.
            </DialogDescription>
          </DialogHeader>

          {deletedDeals.length > 0 ? (
            <div className="space-y-3 py-4">
              {deletedDeals.map((deal) => (
                <div
                  key={deal.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    {deal.logo ? (
                      <img src={deal.logo} alt="" className="h-10 w-10 rounded-md object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{deal.name}</p>
                      {deal.company && (
                        <p className="text-sm text-muted-foreground">{deal.company}</p>
                      )}
                      {deal.deletedAt && (
                        <p className="text-xs text-muted-foreground">
                          Eliminado: {new Date(deal.deletedAt).toLocaleDateString('es-CO')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreDeal(deal.id)}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Restaurar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handlePermanentDelete(deal.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>La papelera está vacía</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTrashDialogOpen(false)}>
              Cerrar
            </Button>
            {deletedDeals.length > 0 && (
              <Button variant="destructive" onClick={handleEmptyTrash}>
                Vaciar Papelera
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
