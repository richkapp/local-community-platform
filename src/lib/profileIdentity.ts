export function verifiedProfileIdentity(expectedUserId: string, authenticatedUserId: string): string {
  if (authenticatedUserId !== expectedUserId) {
    throw new Error('Your account changed while the profile was saving.');
  }
  return expectedUserId;
}