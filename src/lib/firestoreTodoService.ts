import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

const COL = 'todos';

// To-Do rápido y personal (por usuario), para tareas muy pequeñas. Complementa
// la vista de Tareas/Operaciones sin la complejidad del tablero.
export interface Todo {
  id: string;
  text: string;
  done: boolean;
  userId: string;
  createdAt: number;
  completedAt?: number | null;
  order?: number; // orden manual (drag). Si falta, se usa createdAt.
  flagged?: boolean; // destacada con 🐸 (clic derecho / botón)
}

// Carga los to-dos del usuario. Filtra por userId y ordena en cliente (evita índice compuesto):
// pendientes primero (más nuevos arriba), completados al final.
export const loadTodos = async (userId: string): Promise<Todo[]> => {
  const q = query(collection(db, COL), where('userId', '==', userId));
  const snap = await getDocs(q);
  const eo = (t: Todo) => t.order ?? t.createdAt;
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Todo))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (!a.done && !!a.flagged !== !!b.flagged) return a.flagged ? -1 : 1; // destacadas primero
      return eo(b) - eo(a);
    });
};

export const createTodo = async (userId: string, text: string): Promise<string> => {
  const ref = await addDoc(collection(db, COL), {
    text: text.trim(),
    done: false,
    userId,
    createdAt: Date.now(),
    completedAt: null,
  });
  return ref.id;
};

export const updateTodo = async (id: string, patch: Partial<Todo>): Promise<void> => {
  await updateDoc(doc(db, COL, id), patch);
};

export const deleteTodo = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COL, id));
};
