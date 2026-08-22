"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "@/store/store";
import { AuthBootstrap } from "@/features/auth";

/** Client-side providers wrapped around the whole app in the root layout. */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            // Avoid refetching on every mount/remount for data that's seconds
            // old. Screens that need fresher data set their own staleTime or
            // refetchInterval (which ignores staleTime for its own polling).
            staleTime: 30_000,
          },
        },
      })
  );

  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrap>{children}</AuthBootstrap>
      </QueryClientProvider>
    </ReduxProvider>
  );
}
