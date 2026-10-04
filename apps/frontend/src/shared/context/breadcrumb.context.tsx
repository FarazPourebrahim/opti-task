import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

/**
 * Names for breadcrumb segments that only the data knows.
 *
 * A route can say its crumb is "Members" from a translation key, but not that
 * the one before it is "Acme Inc." — that arrives with a query. The page that
 * loads the entity registers its name here, keyed by the route's `crumbId`.
 */
type BreadcrumbLabels = Readonly<Record<string, string>>;

type BreadcrumbContextValue = {
  labels: BreadcrumbLabels;
  setLabel: (id: string, label: string | null) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<BreadcrumbLabels>({});

  const setLabel = useCallback((id: string, label: string | null) => {
    setLabels((current) => {
      if (label === null) {
        if (!(id in current)) return current;
        const { [id]: _removed, ...rest } = current;
        return rest;
      }
      return current[id] === label ? current : { ...current, [id]: label };
    });
  }, []);

  const value = useMemo(() => ({ labels, setLabel }), [labels, setLabel]);

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbLabels(): BreadcrumbLabels {
  // Outside the app shell there is no trail to name; an empty map is correct.
  return useContext(BreadcrumbContext)?.labels ?? {};
}

/** Names the crumb of the route whose handle carries this `crumbId`. */
export function useBreadcrumbLabel(
  id: string,
  label: string | null | undefined,
): void {
  const setLabel = useContext(BreadcrumbContext)?.setLabel;

  useEffect(() => {
    if (!setLabel || !label) return;

    setLabel(id, label);
    return () => setLabel(id, null);
  }, [setLabel, id, label]);
}
