import { db } from './firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { apiClient } from './api';
import type { ProposalData } from './proposalTemplate';

const PROPOSALS_COLLECTION = 'proposals';

export type ProposalStatus = 'borrador' | 'enviada' | 'ganada' | 'perdida';

export interface Proposal {
  id: string;
  cliente: string;
  titulo: string;
  status: ProposalStatus;
  data: ProposalData;       // contenido estructurado (renderizable)
  transcript?: string;      // transcripción de origen
  createdAt: number;
  updatedAt: number;
}

export type NewProposal = Omit<Proposal, 'id' | 'createdAt' | 'updatedAt'>;

export const loadProposals = async (): Promise<Proposal[]> => {
  const q = query(collection(db, PROPOSALS_COLLECTION), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Proposal));
};

export const createProposal = async (p: NewProposal): Promise<string> => {
  const now = Date.now();
  const ref = await addDoc(collection(db, PROPOSALS_COLLECTION), { ...p, createdAt: now, updatedAt: now });
  return ref.id;
};

export const updateProposal = async (id: string, patch: Partial<Proposal>): Promise<void> => {
  await updateDoc(doc(db, PROPOSALS_COLLECTION, id), { ...patch, updatedAt: Date.now() });
};

export const deleteProposal = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, PROPOSALS_COLLECTION, id));
};

// Genera una propuesta a partir de una transcripción (backend → DARIO/Claude).
export const generateProposal = async (input: {
  transcript: string;
  cliente?: string;
  notas?: string;
}): Promise<ProposalData> => {
  const res = await apiClient.post<{ success: boolean; proposal?: ProposalData; error?: string }>(
    '/api/propuestas/generate',
    input
  );
  if (!res.success || !res.proposal) throw new Error(res.error || 'No se pudo generar la propuesta');
  return res.proposal;
};
