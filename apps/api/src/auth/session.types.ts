export type SessionContext = {
  companyId: string;
  userId: string;
  email: string;
  companyName: string;
};

export const SESSION_HEADER = 'x-marble-token';
