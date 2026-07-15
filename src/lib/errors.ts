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
    return 'Sign in with your existing member account first.';
  }

  if (/duplicate|unique/i.test(message)) {
    if (context.includes('profile')) return 'That handle is already in use. Try another one.';
    if (context.includes('voting')) return 'Each voting option must be different.';
    if (context.includes('idea-vote')) return 'You already upvoted this idea.';
    if (context.includes('registration')) return 'You are already registered for this event.';
    if (context.includes('tag')) return 'That tag already exists. Choose it from the list instead.';
  }

  if (context.includes('tag') && /lifetime limit/i.test(message)) return 'You have used all 3 of your lifetime tags.';
  if (context.includes('tag') && /2 to 28|letters or numbers|invalid/i.test(message)) return 'Use a clear tag name between 2 and 28 characters.';

  if (/invalid invite|expired|exhausted|revoked|cooldown|too many/i.test(message)) {
    return 'This invite cannot be used right now. Ask a member or organizer for a current link.';
  }

  const messages: Record<string, string> = {
    'ideas-feed': 'Ideas could not be loaded. Please refresh and try again.',
    'idea-detail': 'This idea could not be loaded.',
    'idea-create': 'Your idea could not be posted. Check the fields and try again.',
    'idea-vote': 'Your upvote could not be saved. Please try again.',
    'idea-bookmark': 'Your bookmark could not be saved. Please try again.',
    'idea-comments': 'Comments could not be loaded. Please refresh and try again.',
    'idea-comment-create': 'Your comment could not be posted. Check it and try again.',
    'idea-comment-vote': 'Your comment upvote could not be saved. Please try again.',
    'tag-list': 'Tags could not be loaded. Please refresh and try again.',
    'tag-create': 'That tag could not be added. Check the name and try again.',
    'events-list': 'Events could not be loaded. Please refresh and try again.',
    'event-detail': 'This event could not be loaded.',
    'event-registration': 'Your registration could not be saved. Please try again.',
    'event-cancellation': 'Your registration could not be cancelled. Please try again.',
    'voting-list': 'Votes could not be loaded. Please refresh and try again.',
    'voting-ballot': 'Your vote could not be saved. Please refresh and try again.',
    'voting-admin': 'That voting action could not be completed. Check the fields and try again.',
    'member-directory': 'Members could not be loaded. Please refresh and try again.',
    'member-profile': 'This member profile could not be loaded.',
    'profile-load': 'Your profile could not be loaded. Please refresh and try again.',
    'profile-save': 'Your profile could not be saved. Check the fields and try again.',
    'avatar-upload': 'Your photo could not be uploaded. Check the image and try again.',
    'avatar-remove': 'Your photo could not be removed. Please try again.',
    'invite-load': 'Your invitation links could not be loaded. Refresh and try again.',
    'admin-access': 'Admin access could not be checked. Please refresh and try again.',
    'admin-load': 'Organizer data could not be loaded. Please refresh and try again.',
    'admin-save': 'That organizer action could not be completed. Please try again.',
    'auth-callback': 'This sign-in link is invalid or has expired. Request a new sign-in or invitation link.'
  };

  return messages[context] ?? 'Something went wrong. Please refresh and try again.';
}
