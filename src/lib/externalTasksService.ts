import { db } from './firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export interface ExternalTask {
  id: string;
  title: string;
  description: string;
  status: string; // 'TODO', 'IN_PROGRESS', 'DONE'
  priority: string; // 'LOW', 'MEDIUM', 'HIGH'
  assignee: string; // Team member name
  creator: string;
  projectId: string;
  type?: string;
  startDate?: number;
  dueDate?: number;
  images?: string[];
  comments?: Array<{
    id: string;
    text: string;
    author: string;
    createdAt: number;
  }>;
  createdAt: number;
}

export interface ExternalProject {
  id: string;
  name: string;
  color: string;
}

const TASKS_COLLECTION = 'tasks';
const PROJECTS_COLLECTION = 'projects';

/**
 * Loads tasks for a specific user from the external task app (Firebase)
 * @param assigneeName - Name of the team member (e.g., "Edgardo", "Stiven")
 * @returns Array of tasks assigned to that user
 */
export const loadUserTasksFromExternal = async (
  assigneeName: string
): Promise<ExternalTask[]> => {
  try {
    const q = query(
      collection(db, TASKS_COLLECTION),
      where('assignee', '==', assigneeName),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as ExternalTask[];
  } catch (error) {
    console.error('Error loading tasks from external app:', error);
    throw error;
  }
};

/**
 * Loads all projects from the external task app
 * @returns Array of projects
 */
export const loadProjectsFromExternal = async (): Promise<ExternalProject[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, PROJECTS_COLLECTION));
    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as ExternalProject[];
  } catch (error) {
    console.error('Error loading projects from external app:', error);
    throw error;
  }
};

/**
 * Gets the task app URL for a specific task
 * @param taskId - Task ID
 * @returns URL to the task in the external app
 */
export const getTaskExternalUrl = (taskId?: string): string => {
  const baseUrl = 'https://task.dtgrowthpartners.com';
  return taskId ? `${baseUrl}?task=${taskId}` : baseUrl;
};
