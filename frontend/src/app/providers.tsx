"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StarknetConfig, publicProvider } from "@starknet-react/core";
import { sepolia, mainnet } from "@starknet-react/chains";
import { ArgentMobileConnector, InjectedConnector } from "starknet-react/connectors";
import { useState } from "react";

// We conditionally import the connector types to avoid SSR issues
function getConnectors() {
  return [
    new InjectedConnector({ options: { id: "argentX" } }),
    new InjectedConnector({ options: { id: "braavos" } }),
  ];
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const chains = [sepolia, mainnet] as const;
  const connectors = getConnectors();

  return (
    <QueryClientProvider client={queryClient}>
      <StarknetConfig
        chains={chains}
        provider={publicProvider()}
        connectors={connectors}
        autoConnect
      >
        {children}
      </StarknetConfig>
    </QueryClientProvider>
  );
}
