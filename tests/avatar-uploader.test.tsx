import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import React from 'react';
import type { AvatarState } from '@/lib/avatar';
import type { AvatarUploaderOperations } from '@/components/profile/AvatarUploader';

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

GlobalRegistrator.register();
const { act, cleanup, fireEvent, render } = await import('@testing-library/react');
const { default: AvatarUploader } = await import('@/components/profile/AvatarUploader');
const { default: AvatarImage } = await import('@/components/profile/AvatarImage');

let objectUrlCounter = 0;

beforeEach(() => {
  objectUrlCounter = 0;
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => `blob:test-${++objectUrlCounter}` });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
});

afterEach(() => cleanup());
afterAll(() => GlobalRegistrator.unregister());

function profile(avatarPath: string | null = null) {
  return {
    display_name: 'Account A',
    avatar_url: null,
    avatar_path: avatarPath,
    updated_at: '2026-07-14T00:00:00.000Z'
  };
}

describe('AvatarUploader identity and persistence behavior', () => {
  test('falls back to initials when a stored avatar cannot load', () => {
    const view = render(<AvatarImage
      profile={{ ...profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp'), display_name: 'Avatar Builder' }}
      className="avatar"
      fallbackClassName="fallback"
    />);
    const image = view.container.querySelector('img');
    expect(image).toBeTruthy();
    fireEvent.error(image!);
    expect(view.container.querySelector('img')).toBeNull();
    expect(view.getByText('AV')).toBeTruthy();
  });

  test('uploads and removes an avatar without submitting the profile form', async () => {
    const upload = deferred<AvatarState>();
    const removal = deferred<AvatarState>();
    const changes: AvatarState[] = [];
    const operations: AvatarUploaderOperations = {
      validate: () => undefined,
      upload: () => upload.promise,
      remove: () => removal.promise
    };
    const onChange = (_identity: string, _generation: number, avatar: AvatarState) => changes.push(avatar);
    const view = render(<AvatarUploader expectedUserId="account-a" identityGeneration={1} profile={profile()} operations={operations} onAvatarChange={onChange} />);

    fireEvent.change(view.getByLabelText('Choose profile photo'), {
      target: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] }
    });
    await act(async () => upload.resolve({
      avatar_path: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
      avatar_url: null,
      avatar_updated_at: '2026-07-14T02:00:00.000Z'
    }));

    expect(changes).toHaveLength(1);
    expect(view.getByText('Photo updated.')).toBeTruthy();
    view.rerender(<AvatarUploader expectedUserId="account-a" identityGeneration={1} profile={profile(changes[0].avatar_path)} operations={operations} onAvatarChange={onChange} />);
    fireEvent.click(view.getByRole('button', { name: 'Remove' }));

    await act(async () => removal.resolve({
      avatar_path: null,
      avatar_url: null,
      avatar_updated_at: '2026-07-14T02:01:00.000Z'
    }));
    expect(changes).toHaveLength(2);
    expect(view.getByText('Photo removed.')).toBeTruthy();
  });

  test('suppresses a late upload response after the account identity changes', async () => {
    const upload = deferred<AvatarState>();
    const changes: AvatarState[] = [];
    const operations: AvatarUploaderOperations = {
      validate: () => undefined,
      upload: () => upload.promise,
      remove: async () => ({ avatar_path: null, avatar_url: null, avatar_updated_at: null })
    };
    const onChange = (_identity: string, _generation: number, avatar: AvatarState) => changes.push(avatar);
    const view = render(<AvatarUploader expectedUserId="account-a" identityGeneration={1} profile={profile()} operations={operations} onAvatarChange={onChange} />);

    fireEvent.change(view.getByLabelText('Choose profile photo'), {
      target: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] }
    });
    view.rerender(<AvatarUploader expectedUserId="account-b" identityGeneration={2} profile={{ ...profile(), display_name: 'Account B' }} operations={operations} onAvatarChange={onChange} />);

    await act(async () => upload.resolve({
      avatar_path: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
      avatar_url: null,
      avatar_updated_at: '2026-07-14T02:00:00.000Z'
    }));
    expect(changes).toEqual([]);
    expect(view.queryByText('Photo updated.')).toBeNull();
  });
});
