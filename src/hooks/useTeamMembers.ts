import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { TEAM_MEMBERS, buildTeamMembers, type TeamMember } from '@/types/taskTypes';

interface TeamUserRow {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

// Cache a nivel de módulo: la lista es la misma para toda la app y no cambia
// dentro de una sesión, así que no vale la pena pedirla en cada pantalla.
let cache: TeamMember[] | null = null;
let enVuelo: Promise<TeamMember[]> | null = null;

const cargar = (): Promise<TeamMember[]> => {
  if (cache) return Promise.resolve(cache);
  if (!enVuelo) {
    enVuelo = apiClient
      .get<TeamUserRow[]>('/api/users/team')
      .then((users) => {
        cache = buildTeamMembers(users || []);
        return cache;
      })
      .catch(() => TEAM_MEMBERS) // sin red, al menos los de siempre
      .finally(() => { enVuelo = null; });
  }
  return enVuelo;
};

/**
 * El equipo tal como está en DT-OS. Reemplaza a la constante TEAM_MEMBERS en
 * todo lo que sea "elegir responsable": una persona nueva aparece sola, sin
 * tener que tocar el código.
 */
export function useTeamMembers(): TeamMember[] {
  const [miembros, setMiembros] = useState<TeamMember[]>(cache || TEAM_MEMBERS);
  useEffect(() => {
    let vivo = true;
    cargar().then((m) => { if (vivo) setMiembros(m); });
    return () => { vivo = false; };
  }, []);
  return miembros;
}
