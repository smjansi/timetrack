/** Turns low-level network failures into something a person can act on. */
export function apiMessage(message: string): string {
  return /failed to fetch|networkerror|load failed|network request failed/i.test(message)
    ? 'Could not reach the server. Check your connection and try again.'
    : message;
}
