import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { customFetch, type ErrorType } from "./custom-fetch";

export type ClientSearchBooking = {
  id: number;
  confirmationCode: string;
  clientName: string;
  phone: string;
  [key: string]: unknown;
};

export type ClientSearchResult = {
  clientAccountId: number;
  phone: string;
  clientName: string;
  sessionCount: number;
  bookings: ClientSearchBooking[];
};

export type ClientSearchResponse = { clients: ClientSearchResult[] };

export function useSearchClients(
  search: string,
  options?: {
    query?: Partial<UseQueryOptions<ClientSearchResponse, ErrorType<unknown>, ClientSearchResponse>>;
  },
) {
  const normalized = search.trim();

  return useQuery({
    queryKey: ["/api/clients/search", normalized],
    queryFn: () =>
      customFetch<ClientSearchResponse>(
        `/api/clients/search?q=${encodeURIComponent(normalized)}`,
        { method: "GET" },
      ),
    enabled: normalized.length >= 2,
    staleTime: 0,
    ...options?.query,
  });
}
