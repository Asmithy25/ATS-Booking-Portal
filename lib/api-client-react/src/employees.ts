/**
 * Employee management + staff booking hooks.
 * Uses the shared customFetch so base-URL and credentials are handled correctly.
 */
import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

export interface ClientSearchResult {
  clientAccountId: number | null;
  phone: string;
  clientName: string;
  sessionCount: number;
  bookings: import("./generated/api.schemas").Booking[];
}

export interface ClientSearchResponse {
  clients: ClientSearchResult[];
}

export const getSearchClientsQueryKey = (query: string) =>
  ["/api/clients/search", query] as const;

export function useSearchClients<TData = ClientSearchResponse>(query: string, options?: {
  query?: Partial<UseQueryOptions<ClientSearchResponse, ErrorType<unknown>, TData>>;
}) {
  return useQuery<ClientSearchResponse, ErrorType<unknown>, TData>({
    queryKey: getSearchClientsQueryKey(query),
    queryFn: () =>
      customFetch<ClientSearchResponse>(`/api/clients/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
    ...options?.query,
  });
}

// ─── Staff booking creation ──────────────────────────────────────────────────

export interface StaffBookingInput {
  clientName: string;
  phone: string;
  reason: string;
  preferredDate: string;
  preferredTime: string;
  status?: "pending" | "claimed" | "completed" | "waitlisted";
  priority?: number;
  sessionNotes?: string;
  businessHoursConfirmationToken?: string;
}

export function useCreateStaffBooking<TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<import("./generated/api.schemas").Booking, TError, StaffBookingInput, TContext>;
}) {
  return useMutation<import("./generated/api.schemas").Booking, TError, StaffBookingInput, TContext>({
    mutationFn: (data: StaffBookingInput) =>
      customFetch<import("./generated/api.schemas").Booking>("/api/bookings/staff", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ...options?.mutation,
  });
}
