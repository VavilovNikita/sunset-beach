// Calls of the staff notification screens, all through adminRequest (same-origin proxy, a
// connection failure told apart from a refusal). Reads that a page needs on first paint are done
// server-side with backendJson; these are the saves and the refreshes after one.
import { adminRequest, adminJsonInit, type AdminResult } from "@/lib/adminFetch";
import { logQueryString, type LogFilters } from "@/lib/notifications";
import type {
  NotificationChannel,
  NotificationLanguage,
  NotificationLinkCode,
  NotificationLogEntry,
  NotificationSettings,
  NotificationSettingsUpdateInput,
  NotificationStaffMember,
} from "@/lib/types";

// The whole result is returned (status and the parsed error body included) because the settings
// form puts a 400 under the field the server names.
export function saveNotificationSettings(input: NotificationSettingsUpdateInput): Promise<AdminResult<NotificationSettings>> {
  return adminRequest<NotificationSettings>("/settings/notifications", adminJsonInit("PUT", input), "Could not save the notification settings.");
}

export function fetchNotificationStaff(): Promise<AdminResult<NotificationStaffMember[]>> {
  return adminRequest<NotificationStaffMember[]>("/notifications/staff", undefined, "Could not load the staff.");
}

export function createNotificationLinkCode(userId: string): Promise<AdminResult<NotificationLinkCode>> {
  return adminRequest<NotificationLinkCode>("/notifications/links/code", adminJsonInit("POST", { userId }), "Could not create the link.");
}

// 204 has no body: adminRequest reads that as a successful empty answer.
export function unlinkNotificationChannel(userId: string, channel: NotificationChannel = "TELEGRAM"): Promise<AdminResult<null>> {
  return adminRequest<null>(`/notifications/links/${encodeURIComponent(userId)}?channel=${channel}`, { method: "DELETE" }, "Could not unlink.");
}

// language null clears it (the person then gets the default from the settings).
export function setNotificationStaffLanguage(userId: string, language: NotificationLanguage | null): Promise<AdminResult<NotificationStaffMember>> {
  return adminRequest<NotificationStaffMember>(
    `/notifications/staff/${encodeURIComponent(userId)}/language`,
    adminJsonInit("PUT", { language }),
    "Could not change the language."
  );
}

export function fetchNotificationLog(filters: LogFilters): Promise<AdminResult<NotificationLogEntry[]>> {
  return adminRequest<NotificationLogEntry[]>(`/notifications/log?${logQueryString(filters)}`, undefined, "Could not load the log.");
}
