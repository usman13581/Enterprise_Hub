import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_COUNTRY_CODE, DEFAULT_CURRENCY } from '@marble/types';
import { apiFetch } from './api';
import { setDisplayCurrency } from './format';

type CompanyCurrencyValue = {
  currency: string;
  country: string;
  refresh: () => Promise<void>;
};

const CompanyCurrencyContext = createContext<CompanyCurrencyValue>({
  currency: DEFAULT_CURRENCY,
  country: DEFAULT_COUNTRY_CODE,
  refresh: async () => undefined,
});

export function CompanyCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE);

  const refresh = useCallback(async () => {
    try {
      const company = await apiFetch<{
        profile: { currency?: string; country?: string } | null;
      }>('/company/me');
      const nextCurrency = company.profile?.currency || DEFAULT_CURRENCY;
      const nextCountry = company.profile?.country || DEFAULT_COUNTRY_CODE;
      setDisplayCurrency(nextCurrency);
      setCurrency(nextCurrency);
      setCountry(nextCountry);
    } catch {
      // Keep the last known display currency when signed out.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ currency, country, refresh }),
    [currency, country, refresh],
  );

  return (
    <CompanyCurrencyContext.Provider value={value}>
      <Fragment key={currency}>{children}</Fragment>
    </CompanyCurrencyContext.Provider>
  );
}

export function useCompanyCurrency() {
  return useContext(CompanyCurrencyContext).currency;
}

export function useCompanyCountry() {
  return useContext(CompanyCurrencyContext);
}
