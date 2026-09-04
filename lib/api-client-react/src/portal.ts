
export type WellnessAssignmentData = {
  id: number;
  clientAccountId: number;
  bookingId: number | null;
  type: "wellness_journey" | "notebook" | "homework";
  title: string;
  content: string;
  dueDate: string | null;
  status: "assigned" | "in_progress" | "completed";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export function useGetPublicWellnessAssignments(
  code: string,
  options?: {
    query?: Partial<
      UseQueryOptions<WellnessAssignmentData[], ErrorType<unknown>, WellnessAssignmentData[]>
    >;
  },
) {
  return useQuery({
    queryKey: ["/api/bookings/confirm", code, "wellness-assignments"],
    queryFn: async () =>
      customFetch<WellnessAssignmentData[]>(
        `/api/bookings/confirm/${encodeURIComponent(code)}/wellness-assignments`,
        {
          method: "GET",
        },
      ),
    enabled: Boolean(code),
    ...options?.query,
  });
}

export function useGetClientWellnessAssignments(
  options?: {
    query?: Partial<
      UseQueryOptions<WellnessAssignmentData[], ErrorType<unknown>, WellnessAssignmentData[]>
    >;
  },
) {
  return useQuery({
    queryKey: ["/api/portal/client/wellness-assignments"],
    queryFn: async () =>
      customFetch<WellnessAssignmentData[]>(
        "/api/portal/client/wellness-assignments",
        {
          method: "GET",
        },
      ),
    ...options?.query,
  });
}

export function useGetWellnessAssignments(
  options?: {
    query?: Partial<
      UseQueryOptions<WellnessAssignmentData[], ErrorType<unknown>, WellnessAssignmentData[]>
    >;
  },
) {
  return useQuery({
    queryKey: ["/api/portal/wellness-assignments"],
    queryFn: async () =>
      customFetch<WellnessAssignmentData[]>(
        "/api/portal/wellness-assignments",
        {
          method: "GET",
        },
      ),
    ...options?.query,
  });
}

export function useCreateWellnessAssignment(options?: {
  mutation?: UseMutationOptions<
    WellnessAssignmentData,
    ErrorType<unknown>,
    {
      clientAccountId: number;
      bookingId?: number | null;
      type: WellnessAssignmentData["type"];
      title: string;
      content: string;
      dueDate?: string | null;
    }
  >;
}) {
  return useMutation({
    mutationFn: async (body) =>
      customFetch<WellnessAssignmentData>("/api/portal/wellness-assignments", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    ...options?.mutation,
  });
}

export function useUpdateWellnessAssignment(options?: {
  mutation?: UseMutationOptions<
    WellnessAssignmentData,
    ErrorType<unknown>,
    {
      id: number;
      type?: WellnessAssignmentData["type"];
      title?: string;
      content?: string;
      dueDate?: string | null;
      status?: WellnessAssignmentData["status"];
    }
  >;
}) {
  return useMutation({
    mutationFn: async ({ id, ...body }) =>
      customFetch<WellnessAssignmentData>(
        `/api/portal/wellness-assignments/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    ...options?.mutation,
  });
}

export function useDeleteWellnessAssignment(options?: {
  mutation?: UseMutationOptions<
    { success: boolean },
    ErrorType<unknown>,
    number
  >;
}) {
  return useMutation({
    mutationFn: async (id) =>
      customFetch<{ success: boolean }>(
        `/api/portal/wellness-assignments/${id}`,
        {
          method: "DELETE",
        },
      ),
    ...options?.mutation,
  });
}

export function useUpdateClientWellnessAssignment(options?: {
  mutation?: UseMutationOptions<
    WellnessAssignmentData,
    ErrorType<unknown>,
    {
      id: number;
      status: WellnessAssignmentData["status"];
    }
  >;
}) {
  return useMutation({
    mutationFn: async ({ id, status }) =>
      customFetch<WellnessAssignmentData>(
        `/api/portal/client/wellness-assignments/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    ...options?.mutation,
  });
}

import { useMutation, useQuery, type UseMutationOptions, type UseQueryOptions } from "@tanstack/react-query";
import { customFetch, type ErrorType } from "./custom-fetch";

export type Client = { id: number; email: string; name: string; phone?: string; updatesOptIn?: boolean; createdAt?: string };
export type SessionFeedbackData = {
  id: number;
  bookingId: number;
  confirmationCode: string;
  clientName?: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
};

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
  feedback?: SessionFeedbackData | null;
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
  averageRating?: number | null;
  totalRatings?: number;
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
  icon: string;
  subject: string;
  body: string;
  updatedBy: string;
  updatedAt: string;
};
export type ClientTemplate = { id: number; key: string; label: string; icon: string; body: string; updatedBy: string; updatedAt: string };
export type ClientNotification = { id: number; clientAccountId: number; title: string; body: string; pushedBy: string; read: boolean; createdAt: string };
export type RolloutClient = { id: number; name: string; email: string; updatesOptIn: boolean };
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
  mutation?: UseMutationOptions<{ authenticated: boolean; client: Client }, TError, { email: string; password: string; name: string; phone: string; updatesOptIn: boolean }>;
}) {
  return useMutation({
    mutationFn: (data: { email: string; password: string; name: string; phone: string; updatesOptIn: boolean }) =>
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
export function useUpdateClientBooking(options?: {
  mutation?: UseMutationOptions<ClientBooking, ErrorType<unknown>, {
    id: number;
    data: { preferredDate?: string; preferredTime?: string; status?: "cancelled" };
  }>;
}) {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { preferredDate?: string; preferredTime?: string; status?: "cancelled" } }) =>
      customFetch<ClientBooking>(`/api/portal/client/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ...options?.mutation,
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
    data: { subject: string; body: string; label?: string; icon?: string };
  }>;
}) {
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: { subject: string; body: string; label?: string; icon?: string } }) =>
      customFetch<MessageTemplate>(`/api/portal/templates/${encodeURIComponent(key)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ...options?.mutation,
  });
}

export function useCreateMessageTemplate(options?: {
  mutation?: UseMutationOptions<MessageTemplate, ErrorType<unknown>, {
    label: string;
    icon: string;
    subject: string;
    body: string;
  }>;
}) {
  return useMutation({
    mutationFn: (data: { label: string; icon: string; subject: string; body: string }) =>
      customFetch<MessageTemplate>("/api/portal/templates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ...options?.mutation,
  });
}

export function useDeleteMessageTemplate(options?: {
  mutation?: UseMutationOptions<{ deleted: boolean }, ErrorType<unknown>, string>;
}) {
  return useMutation({
    mutationFn: (key: string) =>
      customFetch<{ deleted: boolean }>(`/api/portal/templates/${encodeURIComponent(key)}`, {
        method: "DELETE",
      }),
    ...options?.mutation,
  });
}

export const getClientTemplatesQueryKey = () => ["/api/portal/client-templates"] as const;
export function useClientTemplates(options?: QueryOptions<ClientTemplate[]>) {
  return useQuery({
    queryKey: getClientTemplatesQueryKey(),
    queryFn: () => customFetch<ClientTemplate[]>("/api/portal/client-templates"),
    ...options?.query,
  });
}
export function useUpdateClientTemplate(options?: {
  mutation?: UseMutationOptions<ClientTemplate, ErrorType<unknown>, { key: string; data: { body: string; label?: string; icon?: string } }>;
}) {
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: { body: string; label?: string; icon?: string } }) =>
      customFetch<ClientTemplate>(`/api/portal/client-templates/${encodeURIComponent(key)}`, { method: "PATCH", body: JSON.stringify(data) }),
    ...options?.mutation,
  });
}

export function useCreateClientTemplate(options?: {
  mutation?: UseMutationOptions<ClientTemplate, ErrorType<unknown>, { label: string; icon: string; body: string }>;
}) {
  return useMutation({
    mutationFn: (data: { label: string; icon: string; body: string }) =>
      customFetch<ClientTemplate>("/api/portal/client-templates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ...options?.mutation,
  });
}

export function useDeleteClientTemplate(options?: {
  mutation?: UseMutationOptions<{ deleted: boolean }, ErrorType<unknown>, string>;
}) {
  return useMutation({
    mutationFn: (key: string) =>
      customFetch<{ deleted: boolean }>(`/api/portal/client-templates/${encodeURIComponent(key)}`, {
        method: "DELETE",
      }),
    ...options?.mutation,
  });
}

export const getClientNotificationsQueryKey = () => ["/api/portal/client/notifications"] as const;
export function useClientNotifications(options?: QueryOptions<ClientNotification[]>) {
  return useQuery({
    queryKey: getClientNotificationsQueryKey(),
    queryFn: () => customFetch<ClientNotification[]>("/api/portal/client/notifications"),
    ...options?.query,
  });
}
export function useMarkClientNotificationRead(options?: {
  mutation?: UseMutationOptions<ClientNotification, ErrorType<unknown>, number>;
}) {
  return useMutation({
    mutationFn: (id: number) => customFetch<ClientNotification>(`/api/portal/client/notifications/${id}/read`, { method: "PATCH" }),
    ...options?.mutation,
  });
}
export function useUpdateClientPreferences(options?: {
  mutation?: UseMutationOptions<{ updatesOptIn: boolean }, ErrorType<unknown>, { updatesOptIn: boolean }>;
}) {
  return useMutation({
    mutationFn: (data: { updatesOptIn: boolean }) => customFetch<{ updatesOptIn: boolean }>("/api/auth/client/preferences", { method: "PATCH", body: JSON.stringify(data) }),
    ...options?.mutation,
  });
}

export const getRolloutClientsQueryKey = () => ["/api/portal/rollout/clients"] as const;
export function useRolloutClients(options?: QueryOptions<RolloutClient[]>) {
  return useQuery({
    queryKey: getRolloutClientsQueryKey(),
    queryFn: () => customFetch<RolloutClient[]>("/api/portal/rollout/clients"),
    ...options?.query,
  });
}
export function useSendRollout(options?: {
  mutation?: UseMutationOptions<{ sent: number }, ErrorType<unknown>, { title: string; body: string; audience: "client" | "opted_in"; clientId?: number }>;
}) {
  return useMutation({
    mutationFn: (data: { title: string; body: string; audience: "client" | "opted_in"; clientId?: number }) =>
      customFetch<{ sent: number }>("/api/portal/rollout", { method: "POST", body: JSON.stringify(data) }),
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

export function useSubmitPublicFeedback(options?: {
  mutation?: UseMutationOptions<
    SessionFeedbackData,
    ErrorType<unknown>,
    { code: string; data: { rating: number; comment?: string } }
  >;
}) {
  return useMutation({
    mutationFn: ({ code, data }: { code: string; data: { rating: number; comment?: string } }) =>
      customFetch<SessionFeedbackData>(`/api/bookings/confirm/${encodeURIComponent(code)}/feedback`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ...options?.mutation,
  });
}

export const getPublicFeedbackQueryKey = (code: string) =>
  [`/api/bookings/confirm/${code}/feedback`] as const;

export function useGetPublicFeedback(
  code: string,
  options?: { query?: Partial<UseQueryOptions<{ feedback: SessionFeedbackData | null }, ErrorType<unknown>, { feedback: SessionFeedbackData | null }>> }
) {
  return useQuery({
    queryKey: getPublicFeedbackQueryKey(code),
    queryFn: () =>
      customFetch<{ feedback: SessionFeedbackData | null }>(
        `/api/bookings/confirm/${encodeURIComponent(code)}/feedback`
      ),
    enabled: !!code,
    ...options?.query,
  });
}

export function useSubmitClientFeedback(options?: {
  mutation?: UseMutationOptions<
    SessionFeedbackData,
    ErrorType<unknown>,
    { bookingId: number; data: { rating: number; comment?: string } }
  >;
}) {
  return useMutation({
    mutationFn: ({ bookingId, data }: { bookingId: number; data: { rating: number; comment?: string } }) =>
      customFetch<SessionFeedbackData>(`/api/portal/client/bookings/${bookingId}/feedback`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ...options?.mutation,
  });
}