import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import React from 'react';
import type { EditableProfileRecord } from '@/lib/types';

type AuthUser = { id: string; is_anonymous?: boolean; updated_at?: string };
type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function profile(id: string, displayName: string): EditableProfileRecord {
  return {
    id,
    handle: `${displayName.toLowerCase().replaceAll(' ', '-')}-handle`,
    display_name: displayName,
    bio: '',
    avatar_url: null,
    avatar_path: null,
    website_url: null,
    linkedin_url: null,
    github_url: null,
    x_url: null,
    is_public: false,
    updated_at: '2026-07-14T00:00:00.000Z'
  };
}

let authState: { user: AuthUser | null; loading: boolean };
let pendingProfiles: Deferred<EditableProfileRecord>[];
let pendingSaves: Deferred<EditableProfileRecord>[];
let profileFetches: number;
let profileSaves: number;
let saveIdentities: unknown[];

mock.module('@/components/auth/useAuthUser', () => ({
  useAuthUser: () => authState
}));
mock.module('@/lib/profile', () => ({
  fetchMyProfile: () => {
    profileFetches += 1;
    const next = pendingProfiles.shift();
    if (!next) throw new Error('Missing queued profile response.');
    return next.promise;
  },
  updateMyProfile: (identity: unknown) => {
    profileSaves += 1;
    saveIdentities.push(identity);
    const next = pendingSaves.shift();
    if (!next) throw new Error('Missing queued profile save response.');
    return next.promise;
  }
}));
mock.module('@/lib/anonymous', () => ({
  isAnonymousUser: (user: AuthUser | null | undefined) => Boolean(user?.is_anonymous)
}));
mock.module('@/lib/errors', () => ({
  toUserMessage: (_context: string, error: unknown) => error instanceof Error ? error.message : 'Profile error.'
}));
mock.module('@/config/community', () => ({
  communityConfig: { name: 'Test Community' }
}));
mock.module('@/components/auth/AuthRequired', () => ({
  default: () => React.createElement('p', null, 'Auth required')
}));

GlobalRegistrator.register();
const { act, cleanup, fireEvent, render, waitFor } = await import('@testing-library/react');
const { default: ProfileForm } = await import('@/components/profile/ProfileForm');

beforeEach(() => {
  authState = { user: { id: 'account-a' }, loading: false };
  pendingProfiles = [];
  pendingSaves = [];
  profileFetches = 0;
  profileSaves = 0;
  saveIdentities = [];
});

afterEach(() => cleanup());
afterAll(() => GlobalRegistrator.unregister());

describe('ProfileForm draft safety', () => {
  test('keeps an unsaved draft when auth refreshes the same account object', async () => {
    const initial = deferred<EditableProfileRecord>();
    pendingProfiles.push(initial);
    const view = render(<ProfileForm />);

    initial.resolve(profile('account-a', 'Saved profile'));
    const displayName = await view.findByLabelText('Display name') as HTMLInputElement;
    fireEvent.change(displayName, { target: { value: 'Unsaved profile draft' } });

    authState = { user: { id: 'account-a', updated_at: '2026-07-14T01:00:00.000Z' }, loading: false };
    view.rerender(<ProfileForm />);

    expect(profileFetches).toBe(1);
    expect(displayName.value).toBe('Unsaved profile draft');
  });

  test('ignores an old account response after switching accounts', async () => {
    const accountA = deferred<EditableProfileRecord>();
    const accountB = deferred<EditableProfileRecord>();
    pendingProfiles.push(accountA, accountB);
    const view = render(<ProfileForm />);

    await waitFor(() => expect(profileFetches).toBe(1));
    authState = { user: { id: 'account-b' }, loading: false };
    view.rerender(<ProfileForm />);
    await waitFor(() => expect(profileFetches).toBe(2));

    accountB.resolve(profile('account-b', 'Account B'));
    await view.findByDisplayValue('Account B');

    accountA.resolve(profile('account-a', 'Account A'));
    await waitFor(() => expect(view.getByLabelText('Display name')).toHaveProperty('value', 'Account B'));
  });

  test('ignores an old save response after switching accounts', async () => {
    const accountA = deferred<EditableProfileRecord>();
    const accountB = deferred<EditableProfileRecord>();
    const saveA = deferred<EditableProfileRecord>();
    pendingProfiles.push(accountA, accountB);
    pendingSaves.push(saveA);
    const view = render(<ProfileForm />);

    accountA.resolve(profile('account-a', 'Account A'));
    const displayName = await view.findByLabelText('Display name') as HTMLInputElement;
    fireEvent.change(displayName, { target: { value: 'Account A draft' } });
    fireEvent.submit(view.container.querySelector('form')!);
    await waitFor(() => expect(profileSaves).toBe(1));
    expect(saveIdentities).toEqual(['account-a']);

    authState = { user: { id: 'account-b' }, loading: false };
    view.rerender(<ProfileForm />);
    accountB.resolve(profile('account-b', 'Account B'));
    await view.findByDisplayValue('Account B');

    await act(async () => { saveA.resolve(profile('account-a', 'Saved Account A')); });

    expect(view.getByLabelText('Display name')).toHaveProperty('value', 'Account B');
    expect(view.queryByText('Profile saved.')).toBeNull();
    expect(view.getByRole('button', { name: 'Save profile' })).toBeTruthy();
  });

  test('cannot submit the previous account draft during an account switch', async () => {
    const accountA = deferred<EditableProfileRecord>();
    const accountB = deferred<EditableProfileRecord>();
    pendingProfiles.push(accountA, accountB);
    const view = render(<ProfileForm />);

    accountA.resolve(profile('account-a', 'Account A'));
    const displayName = await view.findByLabelText('Display name') as HTMLInputElement;
    fireEvent.change(displayName, { target: { value: 'Account A draft' } });
    const accountAForm = view.container.querySelector('form')!;

    authState = { user: { id: 'account-b' }, loading: false };
    view.rerender(<ProfileForm />);

    expect(view.queryByRole('button', { name: 'Save profile' })).toBeNull();
    fireEvent.submit(accountAForm);
    expect(profileSaves).toBe(0);

    accountB.resolve(profile('account-b', 'Account B'));
    await view.findByDisplayValue('Account B');
  });
});
