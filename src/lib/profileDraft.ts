import type { EditableProfileRecord } from './types';

export function mergeSavedProfileWithAvatar(
  saved: EditableProfileRecord,
  current: Partial<EditableProfileRecord>,
  avatarChangedDuringSave: boolean
) {
  if (!avatarChangedDuringSave) return saved;
  return {
    ...saved,
    avatar_path: current.avatar_path ?? null,
    avatar_url: current.avatar_url ?? null,
    updated_at: current.updated_at ?? saved.updated_at
  };
}
