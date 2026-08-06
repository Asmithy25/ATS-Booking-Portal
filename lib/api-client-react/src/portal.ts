import { useMutation, useQuery, type UseMutationOptions, type UseQueryOptions } from "@tanstack/react-query";
import { customFetch, type ErrorType } from "./custom-fetch";

export type Client = { id: number; email: string; name: string; phone?: string; createdAt?: string };
export type ClientBooking = {
  id: number;
  confirmationCode: string;
  clientName: string;
  phone: string;
  reason: string;
  preferredDate: string;
  preferredTime: string;
  status: string;
  sessionNotes?: string | null;
  createdAt: string;
};
export type Announcement = {
  id: number;
  title: string;
  body: string;
  audience: string;
  publishedBy: string;
  active: boolean;
  createdAt: string;
};
export type WellnessResource = {
  id: number;
  category: string;
  title: string;
  description: string;
  content: string;
  url?: string | null;
  isEmergency: boolean;
};
export type SupportMessage = { id: number; senderType: string; senderName: string; body: string; createdAt: string };
export type SupportThread = {
  id: number;
  subject: string;
  status: string;
  clientName?: string;
  clientPhone?: string;
  preferredDate?: string | null;
  preferredTime?: string | null;
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
};
export type Analytics = {
  totalAppointments: number;
  clientCount: number;
  returningPercentage: number;
  completionRate: number;
  cancellationRate: number;
  noShowRate: number;
  weeklyAverage: number;
  popularDay: string;
  peakHour: string;
  monthly: Array<{ month: string; count: number }>;
};
export type ActivityLog = {
  id: number;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: string | null;
  createdAt: string;
};
export type MessageTemplate = {
  id: number;
  key: string;
  label: string;
  subject: string;
  body: string;
  updatedBy: string;
  updatedAt: string;
};
export type CollaborationItem = {
  id: number;
  kind: "chat" | "inbox" | "task" | "shift_note";
  title: string;
  body: string;
  authorName: string;
  assignedTo?: string | null;
  status: "open" | "in_progress" | "done";
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
};

type QueryOptions<T> = { query?: Partial<UseQueryOptions<T, ErrorType<unknown>, T>> };

export const getClientMeQueryKey = () => ["/api/auth/client/me"] as const;
export function useClientMe(options?: QueryOptions<{ authenticated: boolean; client: Client }>) {
  return useQuery({
    queryKey: getClientMeQueryKey(),
    queryFn: () => customFetch<{ authenticated: boolean; client: Client }>("/api/auth/client/me"),
    ...options?.query,
  });
}

export function useClientLogin<TError = ErrorType<unknown>>(options?: {
  mutation?: UseMutationOptions<{ authenticated: boolean; client: Client }, TError, { email: string; password: string; keepSignedIn?: boolean }>;
}) {
  return useMutation({
    mutationFn: (data: { email: string; password: string; keepSignedIn?: boolean }) =>
      customFetch<{ authenticated: boolean; client: Client }>("/api/auth/client/login", { method: "POST", body: JSON.stringify(data) }),
    ...options?.mutation,
  });
}

export function useClientSignup<TError = ErrorType<unknown>>(options?: {
  mutation?: UseMutationOptions<{ authenticated: boolean; client: Client }, TError, { email: string; password: string; name: string; phone: string }>;
}) {
  return useMutation({
    mutationFn: (data: { email: string; password: string; name: string; phone: string }) =>
      customFetch<{ authenticated: boolean; client: Client }>("/api/auth/client/signup", { method: "POST", body: JSON.stringify(data) }),
    ...options?.mutation,
  });
}

export function useClientLogout(options?: { mutation?: UseMutationOptions<{ message: string }, ErrorType<unknown>, void> }) {
  return useMutation({
    mutationFn: () => customFetch<{ message: string }>("/api/auth/client/logout", { method: "POST" }),
    ...options?.mutation,
  });
}

export const getClientBookingsQueryKey = () => ["/api/portal/client/bookings"] as const;
export function useCreateClientBooking(options?: {
  mutation?: UseMutationOptions<ClientBooking, ErrorType<unknown>, {
    reason: string;
    preferredDate: string;
    preferredTime: string;
  }>;
}) {
  return useMutation({
    mutationFn: (data: { reason: string; preferredDate: string; preferredTime: string }) =>
      customFetch<ClientBooking>("/api/portal/client/bookings", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ...options?.mutation,
  });
}
export function useClientBookings(options?: QueryOptions<ClientBooking[]>) {
  return useQuery({
    queryKey: getClientBookingsQueryKey(),
    queryFn: () => customFetch<ClientBooking[]>("/api/portal/client/bookings"),
    ...options?.query,
  });
}

export const getResourcesQueryKey = () => ["/api/portal/resources"] as const;
export function useWellnessResources(options?: QueryOptions<WellnessResource[]>) {
  return useQuery({
    queryKey: getResourcesQueryKey(),
    queryFn: () => customFetch<WellnessResource[]>("/api/portal/resources"),
    ...options?.query,
  });
}

export const getClientAnnouncementsQueryKey = () => ["/api/portal/announcements", "client"] as const;
export function useAnnouncements(audience: "client" | "staff") {
  return useQuery({
    queryKey: ["/api/portal/announcements", audience],
    queryFn: () => customFetch<Announcement[]>(`/api/portal/announcements?audience=${audience}`),
  });
}

export const getSupportQueryKey = () => ["/api/portal/support"] as const;
export function useSupportThreads(options?: QueryOptions<SupportThread[]>) {
  return useQuery({
    queryKey: getSupportQueryKey(),
    queryFn: () => customFetch<SupportThread[]>("/api/portal/support"),
    ...options?.query,
  });
}
export function useCreateSupportThread(options?: { mutation?: UseMutationOptions<SupportThread, ErrorType<unknown>, { subject: string; body: string }> }) {
  return useMutation({
    mutationFn: (data: { subject: string; body: string }) =>
      customFetch<SupportThread>("/api/portal/support", { method: "POST", body: JSON.stringify(data) }),
    ...options?.mutation,
  });
}
export const getStaffSupportQueryKey = () => ["/api/portal/support/staff"] as const;
export function useStaffSupport(options?: QueryOptions<SupportThread[]>) {
  return useQuery({
    queryKey: getStaffSupportQueryKey(),
    queryFn: () => customFetch<SupportThread[]>("/api/portal/support/staff"),
    ...options?.query,
  });
}
export function useReplyToSupport(options?: { mutation?: UseMutationOptions<SupportThread, ErrorType<unknown>, { id: number; body: string }> }) {
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      customFetch<SupportThread>(`/api/portal/support/${id}/reply`, { method: "POST", body: JSON.stringify({ body }) }),
    ...options?.mutation,
  });
}
export function useUpdateStaffSupportStatus(options?: { mutation?: UseMutationOptions<SupportThread, ErrorType<unknown>, { id: number; status: "open" | "closed" }> }) {
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: "open" | "closed" }) =>
      customFetch<SupportThread>(`/api/portal/support/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    ...options?.mutation,
  });
}
export function useReplyToClientSupport(options?: { mutation?: UseMutationOptions<SupportThread, ErrorType<unknown>, { id: number; body: string }> }) {
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      customFetch<SupportThread>(`/api/portal/support/${id}/reply/client`, { method: "POST", body: JSON.stringify({ body }) }),
    ...options?.mutation,
  });
}
export function useUpdateClientSupportStatus(options?: { mutation?: UseMutationOptions<SupportThread, ErrorType<unknown>, { id: number; status: "open" | "closed" }> }) {
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: "open" | "closed" }) =>
      customFetch<SupportThread>(`/api/portal/support/${id}/status/client`, { method: "PATCH", body: JSON.stringify({ status }) }),
    ...options?.mutation,
  });
}

export function useUpdateClientProfile(options?: { mutation?: UseMutationOptions<Client, ErrorType<unknown>, { name: string; phone: string }> }) {
  return useMutation({
    mutationFn: (data: { name: string; phone: string }) =>
      customFetch<Client>("/api/portal/client/profile", { method: "PATCH", body: JSON.stringify(data) }),
    ...options?.mutation,
  });
}

export const getAnalyticsQueryKey = () => ["/api/portal/analytics"] as const;
export function usePortalAnalytics(options?: QueryOptions<Analytics>) {
  return useQuery({
    queryKey: getAnalyticsQueryKey(),
    queryFn: () => customFetch<Analytics>("/api/portal/analytics"),
    ...options?.query,
  });
}
export const getActivityQueryKey = () => ["/api/portal/activity"] as const;
export function useActivity(options?: QueryOptions<ActivityLog[]>) {
  return useQuery({
    queryKey: getActivityQueryKey(),
    queryFn: () => customFetch<ActivityLog[]>("/api/portal/activity"),
    ...options?.query,
  });
}
export function useCreateAnnouncement(options?: { mutation?: UseMutationOptions<Announcement, ErrorType<unknown>, { title: string; body: string; audience: "staff" | "client" }> }) {
  return useMutation({
    mutationFn: (data: { title: string; body: string; audience: "staff" | "client" }) =>
      customFetch<Announcement>("/api/portal/announcements", { method: "POST", body: JSON.stringify(data) }),
    ...options?.mutation,
  });
}

export const getMessageTemplatesQueryKey = () => ["/api/portal/templates"] as const;
export function useMessageTemplates(options?: QueryOptions<MessageTemplate[]>) {
  return useQuery({
    queryKey: getMessageTemplatesQueryKey(),
    queryFn: () => customFetch<MessageTemplate[]>("/api/portal/templates"),
    ...options?.query,
  });
}

export function useUpdateMessageTemplate(options?: {
  mutation?: UseMutationOptions<MessageTemplate, ErrorType<unknown>, {
    key: string;
    data: { subject: string; body: string; label?: string };
  }>;
}) {
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: { subject: string; body: string; label?: string } }) =>
      customFetch<MessageTemplate>(`/api/portal/templates/${encodeURIComponent(key)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ...options?.mutation,
  });
}

export const getCollaborationQueryKey = (kind?: string) => ["/api/portal/collaboration", kind ?? "all"] as const;
export function useCollaboration(kind?: CollaborationItem["kind"], options?: QueryOptions<CollaborationItem[]>) {
  return useQuery({
    queryKey: getCollaborationQueryKey(kind),
    queryFn: () => customFetch<CollaborationItem[]>(
      `/api/portal/collaboration${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`,
    ),
    ...options?.query,
  });
}

export function useCreateCollaboration(options?: {
  mutation?: UseMutationOptions<CollaborationItem, ErrorType<unknown>, {
    kind: CollaborationItem["kind"];
    title?: string;
    body: string;
    assignedTo?: string;
    status?: CollaborationItem["status"];
    dueDate?: string;
  }>;
}) {
  return useMutation({
    mutationFn: (data: {
      kind: CollaborationItem["kind"];
      title?: string;
      body: string;
      assignedTo?: string;
      status?: CollaborationItem["status"];
      dueDate?: string;
    }) => customFetch<CollaborationItem>("/api/portal/collaboration", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    ...options?.mutation,
  });
}

export function useUpdateCollaboration(options?: {
  mutation?: UseMutationOptions<CollaborationItem, ErrorType<unknown>, {
    id: number;
    data: Partial<Pick<CollaborationItem, "title" | "body" | "assignedTo" | "status">>;
  }>;
}) {
  return useMutation({
    mutationFn: ({ id, data }: {
      id: number;
      data: Partial<Pick<CollaborationItem, "title" | "body" | "assignedTo" | "status">>;
    }) => customFetch<CollaborationItem>(`/api/portal/collaboration/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
    ...options?.mutation,
  });
}