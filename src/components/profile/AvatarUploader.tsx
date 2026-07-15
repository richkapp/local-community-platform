import { useEffect, useRef, useState } from 'react';
import { LuCamera, LuTrash2 } from 'react-icons/lu';
import type { AvatarState } from '@/lib/avatar';
import { removeMyAvatar, uploadMyAvatar, validateAvatarFile } from '@/lib/avatar';
import { toUserMessage } from '@/lib/errors';
import AvatarImage from './AvatarImage';

type ProfileAvatar = {
  display_name: string;
  avatar_url?: string | null;
  avatar_path?: string | null;
  updated_at?: string | null;
};

type Props = {
  expectedUserId: string;
  identityGeneration: number;
  profile: ProfileAvatar;
  onAvatarChange: (identity: string, generation: number, avatar: AvatarState) => void;
  operations?: AvatarUploaderOperations;
};

export type AvatarUploaderOperations = {
  validate: typeof validateAvatarFile;
  upload: typeof uploadMyAvatar;
  remove: typeof removeMyAvatar;
};

const defaultOperations: AvatarUploaderOperations = {
  validate: validateAvatarFile,
  upload: uploadMyAvatar,
  remove: removeMyAvatar
};

export default function AvatarUploader({ expectedUserId, identityGeneration, profile, onAvatarChange, operations = defaultOperations }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const operationRef = useRef(0);
  const mountedRef = useRef(true);
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => () => {
    mountedRef.current = false;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  useEffect(() => {
    operationRef.current += 1;
    replacePreview(null);
    setBusy(null);
    setMessage('');
    setError('');
  }, [expectedUserId]);

  function replacePreview(next: string | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = next;
    setPreviewUrl(next);
  }

  function clearPreview() {
    replacePreview(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    setMessage('');
    setError('');
    try {
      operations.validate(file);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Choose another image.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    const operation = operationRef.current + 1;
    operationRef.current = operation;
    const localPreview = URL.createObjectURL(file);
    replacePreview(localPreview);
    setBusy('upload');

    try {
      const avatar = await operations.upload(expectedUserId, file);
      if (!mountedRef.current || operationRef.current !== operation) return;
      onAvatarChange(expectedUserId, identityGeneration, avatar);
      setMessage('Photo updated.');
    } catch (caught) {
      if (!mountedRef.current || operationRef.current !== operation) return;
      const message = caught instanceof Error && caught.message.startsWith('Choose an image')
        ? caught.message
        : toUserMessage('avatar-upload', caught);
      setError(message);
    } finally {
      if (mountedRef.current && operationRef.current === operation) {
        setBusy(null);
        clearPreview();
      }
    }
  }

  async function removePhoto() {
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    setBusy('remove');
    setMessage('');
    setError('');
    try {
      const avatar = await operations.remove(expectedUserId, profile.avatar_path ?? null);
      if (!mountedRef.current || operationRef.current !== operation) return;
      onAvatarChange(expectedUserId, identityGeneration, avatar);
      setMessage('Photo removed.');
    } catch (caught) {
      if (mountedRef.current && operationRef.current === operation) {
        setError(toUserMessage('avatar-remove', caught));
      }
    } finally {
      if (mountedRef.current && operationRef.current === operation) setBusy(null);
    }
  }

  const hasAvatar = Boolean(profile.avatar_path || profile.avatar_url);

  return (
    <section className="rounded-2xl border border-braga-300/20 bg-white/[0.025] p-5" aria-busy={Boolean(busy)}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <AvatarImage
          profile={profile}
          previewUrl={previewUrl}
          loading="eager"
          imageClassName="h-24 w-24 shrink-0 rounded-2xl object-cover ring-1 ring-white/10"
          fallbackClassName="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-limewash text-2xl font-black text-ink-950"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-white">Profile photo</h2>
          <p className="mt-1 text-sm leading-6 text-braga-100">JPEG, PNG, or WebP. Maximum 2 MB. We crop it square and compress it before upload.</p>
          <p className="mt-1 text-xs leading-5 text-braga-200">Uploaded photos are public files and appear anywhere your public member profile is shown.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <label className={`btn-secondary inline-flex cursor-pointer items-center gap-2 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
              <LuCamera className="h-4 w-4" aria-hidden="true" />
              <span>{busy === 'upload' ? 'Uploading…' : hasAvatar ? 'Replace photo' : 'Choose photo'}</span>
              <input
                ref={inputRef}
                type="file"
                className="sr-only"
                aria-label="Choose profile photo"
                accept="image/jpeg,image/png,image/webp"
                disabled={Boolean(busy)}
                onChange={(event) => void choosePhoto(event.target.files?.[0])}
              />
            </label>
            {hasAvatar && (
              <button type="button" className="btn-secondary inline-flex items-center gap-2 text-red-100 hover:border-red-300/60 hover:text-white" disabled={Boolean(busy)} onClick={() => void removePhoto()}>
                <LuTrash2 className="h-4 w-4" aria-hidden="true" />
                {busy === 'remove' ? 'Removing…' : 'Remove'}
              </button>
            )}
          </div>
        </div>
      </div>
      {message && <p className="status-message mt-4" role="status" aria-live="polite">{message}</p>}
      {error && <p className="error-message mt-4" role="alert">{error}</p>}
    </section>
  );
}
