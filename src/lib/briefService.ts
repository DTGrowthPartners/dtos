import { db } from './firebase';
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import type {
  Brief,
  BriefTemplate,
  NewBrief,
  NewBriefTemplate,
  BriefBlock,
} from '@/types/briefTypes';

const BRIEFS_COLLECTION = 'briefs';
const BRIEF_TEMPLATES_COLLECTION = 'brief_templates';

// Helper to sanitize payload (remove undefined values)
const sanitizePayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = { ...payload };
  Object.keys(sanitized).forEach((k) => {
    if (sanitized[k] === undefined) delete sanitized[k];
  });
  return sanitized;
};

// ============= BRIEFS =============

export const loadBriefs = async (projectId?: string): Promise<Brief[]> => {
  try {
    let q;
    if (projectId) {
      q = query(
        collection(db, BRIEFS_COLLECTION),
        where('projectId', '==', projectId),
        where('isTemplate', '==', false)
      );
    } else {
      q = query(
        collection(db, BRIEFS_COLLECTION),
        where('isTemplate', '==', false)
      );
    }
    const snapshot = await getDocs(q);
    const briefs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Brief));
    // Sort by updatedAt descending (client side to avoid composite index)
    return briefs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (error) {
    console.error('Error loading briefs:', error);
    return [];
  }
};

export const loadAllBriefs = async (): Promise<Brief[]> => {
  try {
    const q = query(
      collection(db, BRIEFS_COLLECTION),
      where('isTemplate', '==', false)
    );
    const snapshot = await getDocs(q);
    const briefs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Brief));
    return briefs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (error) {
    console.error('Error loading all briefs:', error);
    return [];
  }
};

export const getBrief = async (id: string): Promise<Brief | null> => {
  try {
    const docRef = doc(db, BRIEFS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Brief;
    }
    return null;
  } catch (error) {
    console.error('Error getting brief:', error);
    return null;
  }
};

export const createBrief = async (brief: NewBrief): Promise<string> => {
  const now = Date.now();
  const payload = sanitizePayload({
    ...brief,
    createdAt: now,
    updatedAt: now,
  });
  const docRef = await addDoc(collection(db, BRIEFS_COLLECTION), payload);
  return docRef.id;
};

export const updateBrief = async (id: string, updates: Partial<Brief>): Promise<void> => {
  const briefRef = doc(db, BRIEFS_COLLECTION, id);
  const payload = sanitizePayload({
    ...updates,
    updatedAt: Date.now(),
  });
  await updateDoc(briefRef, payload);
};

export const deleteBrief = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, BRIEFS_COLLECTION, id));
};

// ============= BRIEF TEMPLATES =============

export const loadTemplates = async (): Promise<BriefTemplate[]> => {
  try {
    const snapshot = await getDocs(collection(db, BRIEF_TEMPLATES_COLLECTION));
    const templates = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as BriefTemplate));
    return templates.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (error) {
    console.error('Error loading templates:', error);
    return [];
  }
};

export const getTemplate = async (id: string): Promise<BriefTemplate | null> => {
  try {
    const docRef = doc(db, BRIEF_TEMPLATES_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as BriefTemplate;
    }
    return null;
  } catch (error) {
    console.error('Error getting template:', error);
    return null;
  }
};

export const createTemplate = async (template: NewBriefTemplate): Promise<string> => {
  const now = Date.now();
  const payload = sanitizePayload({
    ...template,
    createdAt: now,
    updatedAt: now,
  });
  const docRef = await addDoc(collection(db, BRIEF_TEMPLATES_COLLECTION), payload);
  return docRef.id;
};

export const updateTemplate = async (id: string, updates: Partial<BriefTemplate>): Promise<void> => {
  const templateRef = doc(db, BRIEF_TEMPLATES_COLLECTION, id);
  const payload = sanitizePayload({
    ...updates,
    updatedAt: Date.now(),
  });
  await updateDoc(templateRef, payload);
};

export const deleteTemplate = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, BRIEF_TEMPLATES_COLLECTION, id));
};

// ============= HELPERS =============

// Generate unique ID for blocks
export const generateBlockId = (): string => {
  return crypto.randomUUID();
};

// Create a brief from a template
export const createBriefFromTemplate = async (
  templateId: string,
  projectId: string,
  title: string,
  createdBy: string
): Promise<string> => {
  const template = await getTemplate(templateId);
  if (!template) {
    throw new Error('Template not found');
  }

  // Create blocks with new IDs
  const blocks: BriefBlock[] = template.blocks.map((block, index) => ({
    ...block,
    id: generateBlockId(),
    order: index,
  }));

  const newBrief: NewBrief = {
    title,
    description: template.description,
    projectId,
    blocks,
    isTemplate: false,
    templateId,
    createdBy,
  };

  return createBrief(newBrief);
};

// Save an existing brief as a template
export const saveBriefAsTemplate = async (
  brief: Brief,
  templateName: string,
  category?: string
): Promise<string> => {
  // Remove IDs from blocks for template
  const blocks = brief.blocks.map(({ id, ...block }) => block);

  const template: NewBriefTemplate = {
    name: templateName,
    description: brief.description,
    category,
    blocks,
    createdBy: brief.createdBy,
  };

  return createTemplate(template);
};

// Create empty brief
export const createEmptyBrief = async (
  projectId: string,
  title: string,
  createdBy: string
): Promise<string> => {
  const newBrief: NewBrief = {
    title,
    projectId,
    blocks: [
      {
        id: generateBlockId(),
        type: 'paragraph',
        content: '',
        order: 0,
      },
    ],
    isTemplate: false,
    createdBy,
  };

  return createBrief(newBrief);
};

// Duplicate a brief
export const duplicateBrief = async (
  briefId: string,
  newTitle?: string
): Promise<string> => {
  const original = await getBrief(briefId);
  if (!original) {
    throw new Error('Brief not found');
  }

  // Create new blocks with new IDs
  const blocks: BriefBlock[] = original.blocks.map((block, index) => ({
    ...block,
    id: generateBlockId(),
    order: index,
  }));

  const newBrief: NewBrief = {
    title: newTitle || `${original.title} (copia)`,
    description: original.description,
    projectId: original.projectId,
    blocks,
    isTemplate: false,
    createdBy: original.createdBy,
  };

  return createBrief(newBrief);
};

// Duplicate a brief to another project
export const duplicateBriefToProject = async (
  briefId: string,
  targetProjectId: string,
  newTitle?: string
): Promise<string> => {
  const original = await getBrief(briefId);
  if (!original) {
    throw new Error('Brief not found');
  }

  // Create new blocks with new IDs
  const blocks: BriefBlock[] = original.blocks.map((block, index) => ({
    ...block,
    id: generateBlockId(),
    order: index,
  }));

  const newBrief: NewBrief = {
    title: newTitle || `${original.title} (copia)`,
    description: original.description,
    projectId: targetProjectId,
    blocks,
    isTemplate: false,
    createdBy: original.createdBy,
  };

  return createBrief(newBrief);
};
