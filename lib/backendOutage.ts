// A deploy (or a crash) leaves the Java backend unreachable for a short while: connection refused
// while its container restarts, or a 502/503/504 from the proxy in front of it. That is "the system
// is updating", not "you are logged out" and not a bug - callers that used to read a failed
// session lookup as "no session" (and bounce the user to the login page, deleting their cookie)
// must treat it as an outage instead. 500 is deliberately not here: that is the backend answering,
// with a real error.
export class BackendUnavailableError extends Error {
  constructor(detail?: string) {
    super(detail ? `Backend unavailable: ${detail}` : "Backend unavailable");
  }
}

export function isOutageStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

// fetch() against the backend, with a connection failure or an outage status turned into one
// BackendUnavailableError. Any other response (including 401/500) is returned untouched.
export async function fetchBackend(input: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (e) {
    throw new BackendUnavailableError(e instanceof Error ? e.message : undefined);
  }
  if (isOutageStatus(res.status)) throw new BackendUnavailableError(`status ${res.status}`);
  return res;
}
