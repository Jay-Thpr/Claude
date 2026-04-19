const DEFAULT_REDIRECT_URI = "http://localhost:3000/api/gcal/callback";
const CALENDAR_SCOPE = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
  "profile",
].join(" ");
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";
const CALENDAR_EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars";

export const GCAL_COOKIE_NAMES = {
  tokens: "safestep_gcal_tokens",
  profile: "safestep_gcal_profile",
  state: "safestep_gcal_state",
} as const;

export type GCalProfile = {
  email?: string;
  name?: string;
  picture?: string;
};

export type GCalTokenPayload = {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  scope?: string;
};

export type CalendarEventSummary = {
  id: string;
  summary: string;
  start: string;
  end?: string;
  location?: string;
  description?: string;
  whenLabel: string;
  timeLabel?: string;
};

export type CalendarSnapshot = {
  connected: boolean;
  profile: GCalProfile | null;
  nextAppointment: CalendarEventSummary | null;
  upcomingAppointments: CalendarEventSummary[];
  message: string;
  source: "google-calendar" | "none";
};

type CookieStore = {
  get(name: string): { value: string } | undefined;
  set(
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      sameSite?: "lax" | "strict" | "none";
      secure?: boolean;
      path?: string;
      maxAge?: number;
    },
  ): void;
  delete(name: string): void;
};

function getRequiredEnv(name: string, fallback?: string) {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getGoogleOAuthConfig() {
  return {
    clientId: getRequiredEnv("GOOGLE_CLIENT_ID"),
    clientSecret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: getRequiredEnv("GOOGLE_REDIRECT_URI", DEFAULT_REDIRECT_URI),
    scope: CALENDAR_SCOPE,
  };
}

export function buildGoogleAuthUrl(state: string) {
  const { clientId, redirectUri, scope } = getGoogleOAuthConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export function createStateValue() {
  return crypto.randomUUID();
}

export function parseCookieValue<T>(value: string | undefined | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function setJsonCookie<T>(
  cookieStore: CookieStore,
  name: string,
  value: T,
  maxAgeSeconds = 60 * 60 * 24 * 180,
) {
  cookieStore.set(name, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function deleteCookie(cookieStore: CookieStore, name: string) {
  cookieStore.delete(name);
}

export async function exchangeCodeForTokens(code: string) {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed with HTTP ${res.status}`);
  }

  return (await res.json()) as GCalTokenPayload & { expires_in?: number };
}

export async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed with HTTP ${res.status}`);
  }

  return (await res.json()) as GCalTokenPayload & { expires_in?: number };
}

export async function fetchUserProfile(accessToken: string) {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Google profile lookup failed with HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    email?: string;
    name?: string;
    picture?: string;
  };
  return {
    email: data.email as string | undefined,
    name: data.name as string | undefined,
    picture: data.picture as string | undefined,
  } satisfies GCalProfile;
}

function normalizeEventDate(eventStart: { date?: string; dateTime?: string } | undefined) {
  const raw = eventStart?.dateTime || eventStart?.date;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return { raw, date, isAllDay: Boolean(eventStart?.date && !eventStart?.dateTime) };
}

function formatEventLabels(startInfo: ReturnType<typeof normalizeEventDate>) {
  if (!startInfo) {
    return { whenLabel: "Unknown date", timeLabel: undefined };
  }

  const today = new Date();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const sameDay =
    startInfo.date.toDateString() === today.toDateString() ||
    startInfo.date.toDateString() === tomorrow.toDateString();

  const whenLabel = sameDay
    ? startInfo.date.toDateString() === today.toDateString()
      ? "today"
      : "tomorrow"
    : startInfo.date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });

  const timeLabel = startInfo.isAllDay
    ? undefined
    : startInfo.date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

  return { whenLabel, timeLabel };
}

export async function fetchUpcomingCalendarEvents(
  accessToken: string,
  options?: { calendarId?: string; maxResults?: number },
) {
  const calendarId = options?.calendarId || "primary";
  const maxResults = options?.maxResults || 5;
  const timeMin = new Date().toISOString();
  const url = new URL(
    `${CALENDAR_EVENTS_ENDPOINT}/${encodeURIComponent(calendarId)}/events`,
  );
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("timeMin", timeMin);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Google Calendar lookup failed with HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    items?: Array<{
      id?: string;
      summary?: string;
      start?: { date?: string; dateTime?: string };
      end?: { date?: string; dateTime?: string };
      location?: string;
      description?: string;
    }>;
  };
  const items = Array.isArray(data.items) ? data.items : [];

  const upcomingAppointments: CalendarEventSummary[] = items
    .map((item) => {
      const startInfo = normalizeEventDate(item.start);
      if (!startInfo) return null;
      const labels = formatEventLabels(startInfo);
      const endInfo = normalizeEventDate(item.end);
      return {
        id: String(item.id || crypto.randomUUID()),
        summary: String(item.summary || "Untitled event"),
        start: startInfo.raw,
        end: endInfo?.raw,
        location: item.location ? String(item.location) : undefined,
        description: item.description ? String(item.description) : undefined,
        whenLabel: labels.whenLabel,
        timeLabel: labels.timeLabel,
      } satisfies CalendarEventSummary;
    })
    .filter(Boolean) as CalendarEventSummary[];

  return upcomingAppointments;
}

export function buildCalendarMessage(
  profile: GCalProfile | null,
  nextAppointment: CalendarEventSummary | null,
  connected: boolean,
) {
  if (!connected) {
    return "Google Calendar is not connected yet.";
  }

  const owner = profile?.name || profile?.email || "your account";
  if (!nextAppointment) {
    return `Google Calendar is connected for ${owner}, but I couldn't find any upcoming events.`;
  }

  const timePart = nextAppointment.timeLabel ? ` at ${nextAppointment.timeLabel}` : "";
  const locationPart = nextAppointment.location ? ` Location: ${nextAppointment.location}.` : "";
  return `Google Calendar is connected for ${owner}. Your next appointment is ${nextAppointment.whenLabel}${timePart}: ${nextAppointment.summary}.${locationPart}`;
}

export async function loadCalendarSnapshot(cookieStore: CookieStore): Promise<CalendarSnapshot> {
  const tokenPayload = parseCookieValue<GCalTokenPayload>(
    cookieStore.get(GCAL_COOKIE_NAMES.tokens)?.value,
  );
  const profile = parseCookieValue<GCalProfile>(
    cookieStore.get(GCAL_COOKIE_NAMES.profile)?.value,
  );

  if (!tokenPayload?.access_token && !tokenPayload?.refresh_token) {
    return {
      connected: false,
      profile: null,
      nextAppointment: null,
      upcomingAppointments: [],
      message: buildCalendarMessage(null, null, false),
      source: "none",
    };
  }

  let accessToken = tokenPayload.access_token;
  let refreshToken = tokenPayload.refresh_token;
  let expiryDate = tokenPayload.expiry_date;

  if (
    (!accessToken || (expiryDate && Date.now() >= expiryDate - 60_000)) &&
    refreshToken
  ) {
    const refreshed = await refreshAccessToken(refreshToken);
    accessToken = refreshed.access_token;
    expiryDate = refreshed.expires_in
      ? Date.now() + refreshed.expires_in * 1000
      : undefined;
    refreshToken = refreshed.refresh_token || refreshToken;
    await setJsonCookie(cookieStore, GCAL_COOKIE_NAMES.tokens, {
      ...tokenPayload,
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: expiryDate,
      scope: refreshed.scope || tokenPayload.scope,
      token_type: refreshed.token_type || tokenPayload.token_type,
    });
  }

  if (!accessToken) {
    return {
      connected: false,
      profile: null,
      nextAppointment: null,
      upcomingAppointments: [],
      message: buildCalendarMessage(null, null, false),
      source: "none",
    };
  }

  const resolvedProfile = profile || (await fetchUserProfile(accessToken).catch(() => null));
  let upcomingAppointments: CalendarEventSummary[] = [];
  let nextAppointment: CalendarEventSummary | null = null;
  let calendarLookupError = false;

  try {
    upcomingAppointments = await fetchUpcomingCalendarEvents(accessToken);
    nextAppointment = upcomingAppointments[0] || null;
  } catch {
    calendarLookupError = true;
  }

  if (resolvedProfile) {
    await setJsonCookie(cookieStore, GCAL_COOKIE_NAMES.profile, resolvedProfile);
  }

  const message = calendarLookupError
    ? resolvedProfile
      ? `Google Calendar is connected for ${resolvedProfile.name || resolvedProfile.email || "your account"}, but I couldn't load upcoming events right now.`
      : "Google Calendar is connected, but I couldn't load upcoming events right now."
    : buildCalendarMessage(resolvedProfile, nextAppointment, true);

  return {
    connected: true,
    profile: resolvedProfile,
    nextAppointment,
    upcomingAppointments,
    message,
    source: "google-calendar",
  };
}
