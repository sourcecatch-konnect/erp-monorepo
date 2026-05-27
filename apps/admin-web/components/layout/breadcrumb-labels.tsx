"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type BreadcrumbLabelsContextValue = {
  labels: Record<string, string>;
  setLabel: (href: string, label: string | null) => void;
};

const BreadcrumbLabelsContext =
  createContext<BreadcrumbLabelsContextValue | null>(null);

export function BreadcrumbLabelsProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<Record<string, string>>({});

  const setLabel = useCallback((href: string, label: string | null) => {
    setLabels((current) => {
      const next = { ...current };
      if (label) next[href] = label;
      else delete next[href];
      return next;
    });
  }, []);

  const value = useMemo(() => ({ labels, setLabel }), [labels, setLabel]);

  return (
    <BreadcrumbLabelsContext.Provider value={value}>
      {children}
    </BreadcrumbLabelsContext.Provider>
  );
}

export function useBreadcrumbLabels() {
  const context = useContext(BreadcrumbLabelsContext);
  if (!context) {
    throw new Error(
      "useBreadcrumbLabels must be used within BreadcrumbLabelsProvider",
    );
  }
  return context;
}
