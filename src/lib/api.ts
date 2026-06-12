import { authService } from './auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { requiresAuth = true, headers = {}, ...restOptions } = options;

    const config: RequestInit = {
      ...restOptions,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (requiresAuth) {
      const token = await authService.getToken();
      console.log('API Request:', endpoint, 'Token:', token ? 'present' : 'missing');
      if (token) {
        (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      } else {
        console.error('No token available for authenticated request to:', endpoint);
      }
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, config);

      if (response.status === 401 && requiresAuth) {
        try {
          // Try to get a fresh token
          const newToken = await authService.getToken();
          if (!newToken) {
            throw new Error('No token available');
          }

          (config.headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
          const retryResponse = await fetch(`${API_URL}${endpoint}`, config);

          if (!retryResponse.ok) {
            throw new Error('Request failed after token refresh');
          }

          // Handle 204 No Content responses
          if (retryResponse.status === 204) {
            return undefined as T;
          }

          return await retryResponse.json();
        } catch {
          await authService.logout();
          window.location.href = '/login';
          throw new Error('Session expired');
        }
      }

      if (!response.ok) {
        // El backend usa varios formatos: { error: "..." }, { message: "..." } o { success: false, error: "..." }
        // Intentamos extraer el mejor mensaje disponible para mostrar al usuario.
        let message = `Request failed (${response.status})`;
        try {
          const body = await response.json();
          message = body.error || body.message || body.details || message;
        } catch {
          // Si el body no es JSON, usamos el statusText
          message = response.statusText || message;
        }
        throw new Error(message);
      }

      // Handle 204 No Content responses
      if (response.status === 204) {
        return undefined as T;
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async patch<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
