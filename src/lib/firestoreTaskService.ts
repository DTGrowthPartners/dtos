import { db } from './firebase';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  arrayUnion,
  increment,
  getDoc
} from 'firebase/firestore';
import type { Task, Project, BoardColumn, PomodoroSession } from '@/types/taskTypes';

const TASKS_COLLECTION = 'tasks';
const PROJECTS_COLLECTION = 'projects';
const COMPLETED_TASKS_COLLECTION = 'completed_tasks';
const DELETED_TASKS_COLLECTION = 'deleted_tasks';
const COLUMNS_COLLECTION = 'board_columns';

// Helper to sanitize payload (remove undefined values)
const sanitizePayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = { ...payload };
  Object.keys(sanitized).forEach((k) => {
    if (sanitized[k] === undefined) delete sanitized[k];
  });
  return sanitized;
};

// ============= TASKS =============

export const loadTasks = async (): Promise<Task[]> => {
  const q = query(collection(db, TASKS_COLLECTION), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Task));
};

export const createTask = async (task: Omit<Task, 'id' | 'createdAt'>): Promise<string> => {
  const payload = sanitizePayload({ ...task, createdAt: Date.now() });
  const docRef = await addDoc(collection(db, TASKS_COLLECTION), payload);
  return docRef.id;
};

export const updateTask = async (id: string, task: Partial<Task>): Promise<void> => {
  const payload = sanitizePayload({ ...task });
  const taskRef = doc(db, TASKS_COLLECTION, id);
  await updateDoc(taskRef, payload);
};

export const deleteTask = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, TASKS_COLLECTION, id));
};

// ============= PROJECTS =============

export const loadProjects = async (): Promise<Project[]> => {
  const querySnapshot = await getDocs(collection(db, PROJECTS_COLLECTION));
  return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Project));
};

export const createProject = async (project: Omit<Project, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), project);
  return docRef.id;
};

export const updateProject = async (id: string, project: Partial<Project>): Promise<void> => {
  const projectRef = doc(db, PROJECTS_COLLECTION, id);
  await updateDoc(projectRef, project);
};

export const deleteProject = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, PROJECTS_COLLECTION, id));
};

export const updateProjectOrder = async (projectId: string, order: number): Promise<void> => {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  await updateDoc(projectRef, { order });
};

// ============= POMODORO =============

export const updateTaskPomodoro = async (taskId: string, session: PomodoroSession): Promise<void> => {
  const taskDoc = doc(db, TASKS_COLLECTION, taskId);
  await updateDoc(taskDoc, {
    pomodoroSessions: arrayUnion(session),
    totalPomodoros: increment(1),
    currentPomodoroTime: null,
    pomodoroStatus: 'idle'
  });
};

export const updateTaskPomodoroState = async (
  taskId: string,
  state: { pomodoroStatus?: string; currentPomodoroTime?: number | null }
): Promise<void> => {
  const taskDoc = doc(db, TASKS_COLLECTION, taskId);
  const payload = sanitizePayload({ ...state });
  await updateDoc(taskDoc, payload);
};

export const updateTaskImages = async (taskId: string, images: string[]): Promise<void> => {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await updateDoc(taskRef, {
    images: images,
    imageCount: images.length
  });
};

// ============= COMPLETED TASKS =============

export const loadCompletedTasks = async (): Promise<Task[]> => {
  const q = query(collection(db, COMPLETED_TASKS_COLLECTION), orderBy('completedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Task));
};

export const moveTaskToCompleted = async (taskId: string, taskData: Task): Promise<void> => {
  const completedTaskData = {
    ...taskData,
    completedAt: Date.now(),
    originalId: taskId
  };
  const payload = sanitizePayload(completedTaskData);
  await addDoc(collection(db, COMPLETED_TASKS_COLLECTION), payload);
  await deleteDoc(doc(db, TASKS_COLLECTION, taskId));
};

export const copyTaskToCompleted = async (taskId: string, taskData: Task): Promise<void> => {
  const completedTaskData = {
    ...taskData,
    completedAt: Date.now(),
    originalId: taskId
  };
  const payload = sanitizePayload(completedTaskData);
  await addDoc(collection(db, COMPLETED_TASKS_COLLECTION), payload);
};

export const restoreCompletedTask = async (completedTaskId: string): Promise<string> => {
  const completedTaskDoc = doc(db, COMPLETED_TASKS_COLLECTION, completedTaskId);
  const completedTaskSnap = await getDoc(completedTaskDoc);

  if (!completedTaskSnap.exists()) {
    throw new Error('Completed task not found');
  }

  const taskData = completedTaskSnap.data() as Task;
  const newTaskData = {
    ...taskData,
    createdAt: Date.now(),
    completedAt: undefined,
    originalId: undefined
  };
  const payload = sanitizePayload(newTaskData);
  const newTaskRef = await addDoc(collection(db, TASKS_COLLECTION), payload);
  await deleteDoc(completedTaskDoc);
  return newTaskRef.id;
};

export const permanentlyDeleteCompletedTask = async (completedTaskId: string): Promise<void> => {
  await deleteDoc(doc(db, COMPLETED_TASKS_COLLECTION, completedTaskId));
};

// ============= DELETED TASKS =============

export const loadDeletedTasks = async (): Promise<Task[]> => {
  const q = query(collection(db, DELETED_TASKS_COLLECTION), orderBy('deletedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Task));
};

export const moveTaskToDeleted = async (taskId: string, taskData: Task): Promise<void> => {
  const deletedTaskData = {
    ...taskData,
    deletedAt: Date.now(),
    originalId: taskId
  };
  const payload = sanitizePayload(deletedTaskData);
  await addDoc(collection(db, DELETED_TASKS_COLLECTION), payload);
  await deleteDoc(doc(db, TASKS_COLLECTION, taskId));
};

export const restoreDeletedTask = async (deletedTaskId: string): Promise<string> => {
  const deletedTaskDoc = doc(db, DELETED_TASKS_COLLECTION, deletedTaskId);
  const deletedTaskSnap = await getDoc(deletedTaskDoc);

  if (!deletedTaskSnap.exists()) {
    throw new Error('Deleted task not found');
  }

  const taskData = deletedTaskSnap.data() as Task;
  const newTaskData = {
    ...taskData,
    createdAt: Date.now(),
    deletedAt: undefined,
    originalId: undefined
  };
  const payload = sanitizePayload(newTaskData);
  const newTaskRef = await addDoc(collection(db, TASKS_COLLECTION), payload);
  await deleteDoc(deletedTaskDoc);
  return newTaskRef.id;
};

export const permanentlyDeleteTask = async (deletedTaskId: string): Promise<void> => {
  await deleteDoc(doc(db, DELETED_TASKS_COLLECTION, deletedTaskId));
};

// ============= BOARD COLUMNS =============

export const loadColumns = async (): Promise<BoardColumn[]> => {
  const q = query(collection(db, COLUMNS_COLLECTION), orderBy('order', 'asc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as BoardColumn));
};

export const createColumn = async (column: Omit<BoardColumn, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, COLUMNS_COLLECTION), column);
  return docRef.id;
};

export const updateColumn = async (id: string, column: Partial<BoardColumn>): Promise<void> => {
  const columnRef = doc(db, COLUMNS_COLLECTION, id);
  await updateDoc(columnRef, column);
};

export const deleteColumn = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLUMNS_COLLECTION, id));
};

export const updateColumnOrder = async (columnId: string, order: number): Promise<void> => {
  const columnRef = doc(db, COLUMNS_COLLECTION, columnId);
  await updateDoc(columnRef, { order });
};

// ============= COMMENTS =============

export const addTaskComment = async (
  taskId: string,
  comment: { id: string; text: string; author: string; createdAt: number }
): Promise<void> => {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await updateDoc(taskRef, {
    comments: arrayUnion(comment)
  });
};
