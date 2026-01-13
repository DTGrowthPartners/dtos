import { auth } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  photoUrl?: string;
}

interface AuthState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      firebaseUser: null,
      token: null,
      isLoading: true,
      setUser: (user) => set({ user }),
      setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
      setToken: (token) => set({ token }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);

// Listen to Firebase auth state changes
onAuthStateChanged(auth, async (firebaseUser) => {
  const { setUser, setFirebaseUser, setToken, setLoading } = useAuthStore.getState();
  setFirebaseUser(firebaseUser);
  setLoading(false);

  if (firebaseUser) {
    // Get ID token and sync with backend
    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch(`${API_URL}/api/auth/firebase-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setToken(data.token); // Store the JWT token from backend
      }
    } catch (error) {
      console.error('Error syncing with backend:', error);
    }
  } else {
    setUser(null);
    setToken(null);
  }
});

class AuthService {
  async register(firstName: string, lastName: string, email: string, password: string): Promise<void> {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Get ID token
    const idToken = await userCredential.user.getIdToken();

    // Sync user data with backend
    const response = await fetch(`${API_URL}/api/auth/firebase-register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idToken,
        email,
        firstName,
        lastName,
      }),
    });

    if (!response.ok) {
      // If backend sync fails, delete the Firebase user
      await userCredential.user.delete();
      const error = await response.json();
      throw new Error(error.message || 'Error al registrarse');
    }

    const data = await response.json();
    useAuthStore.getState().setUser(data.user);
    useAuthStore.getState().setToken(data.token);
  }

  async login(email: string, password: string): Promise<void> {
    // Login with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // Get ID token and sync with backend
    const idToken = await userCredential.user.getIdToken();

    const response = await fetch(`${API_URL}/api/auth/firebase-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      throw new Error('Error al iniciar sesión');
    }

    const data = await response.json();
    useAuthStore.getState().setUser(data.user);
    useAuthStore.getState().setToken(data.token);
  }

  async logout(): Promise<void> {
    await signOut(auth);
    useAuthStore.getState().setUser(null);
    useAuthStore.getState().setFirebaseUser(null);
    useAuthStore.getState().setToken(null);
  }

  getUser(): User | null {
    return useAuthStore.getState().user;
  }

  getFirebaseUser(): FirebaseUser | null {
    return useAuthStore.getState().firebaseUser;
  }

  async getToken(): Promise<string | null> {
    // Return the JWT token from backend, not the Firebase ID token
    const token = useAuthStore.getState().token;
    console.log('AuthService.getToken():', token ? 'token present' : 'no token');
    return token;
  }

  isAuthenticated(): boolean {
    return !!useAuthStore.getState().firebaseUser;
  }
}

export const authService = new AuthService();
