export function toUserMessage(context: string, error: unknown): string {
  // Keep technical details available to maintainers without exposing schema,
  // policy, or provider internals in the public UI.
  console.error(`[${context}]`, error);

  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';

  if (/need to sign in|not authenticated|jwt/i.test(message)) {
    return 'Use your private invite link to sign in first.';
  }

  if (/duplicate|unique/i.test(message)) {
    if (context.includes('profile')) return 'That handle is already in use. Try another one.';
    if (context.includes('vote')) return 'You already upvoted this idea.';
    if (context.includes('registration')) return 'You are already registered for this event.';
  }

  if (/invalid invite|expired|exhausted|revoked|cooldown|too many/i.test(message)) {
    return 'This invite cannot be used right now. Ask an organizer for a current private link.';
  }

  const messages: Record<string, string> = {
    'ideas-feed': 'Ideas could not be loaded. Please refresh and try again.',
    'idea-detail': 'This idea could not be loaded.',
    'idea-create': 'Your idea could not be posted. Check the fields and try again.',
    'idea-vote': 'Your upvote could not be saved. Please try again.',
    'events-list': 'Events could not be loaded. Please refresh and try again.',
    'event-detail': 'This event could not be loaded.',
    'event-registration': 'Your registration could not be saved. Please try again.',
    'event-cancellation': 'Your registration could not be cancelled. Please try again.',
    'member-directory': 'Members could not be loaded. Please refresh and try again.',
    'member-profile': 'This member profile could not be loaded.',
    'profile-load': 'Your profile could not be loaded. Please refresh and try again.',
    'profile-save': 'Your profile could not be saved. Check the fields and try again.',
    'admin-access': 'Admin access could not be checked. Please refresh and try again.',
    'admin-load': 'Organizer data could not be loaded. Please refresh and try again.',
    'admin-save': 'That organizer action could not be completed. Please try again.',
    'auth-callback': 'This sign-in link is invalid or has expired. Request a new private link.'
  };

  return messages[context] ?? 'Something went wrong. Please refresh and try again.';
}
