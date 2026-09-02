'use client';

import { useEffect, useState } from 'react';
import type { SessionPayload } from '@marble/types';
import { apiFetch } from './api';

/** True when the signed-in user is a company owner/admin (not read-only). */
export function useCompanyAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    void apiFetch<SessionPayload>('/auth/session')
      .then((session) => {
        setIsAdmin(session.companyRole === 'admin' && !session.readOnly);
      })
      .catch(() => setIsAdmin(false));
  }, []);

  return isAdmin;
}
