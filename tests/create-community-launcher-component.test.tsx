import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import React from 'react';
import { EMPTY_COMMUNITY_LAUNCHER_ANSWERS, createRecoveryData } from '../src/lib/createCommunityLauncher';

GlobalRegistrator.register();
const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/react');
const { default: CreateCommunityLauncher } = await import('@/components/create-community/CreateCommunityLauncher');

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
afterAll(() => GlobalRegistrator.unregister());

function chooseAndContinue(view: ReturnType<typeof render>, name: RegExp) {
  fireEvent.click(view.getByRole('button', { name }));
  fireEvent.click(view.getByRole('button', { name: 'Continue' }));
}

const completeProfile = {
  ...EMPTY_COMMUNITY_LAUNCHER_ANSWERS,
  technicalLevel: 'comfortable' as const,
  aiService: 'claude' as const,
  operatingSystem: 'windows' as const,
  toolInstalled: 'yes' as const,
  localCapability: 'yes' as const,
  browserCapability: 'no' as const,
  communityName: 'Riverside Makers',
  location: 'Coimbra, Portugal',
  purpose: 'Help local makers build together.',
  audience: 'Local makers and neighbours.',
  organizerName: 'Rita Costa',
  locale: 'English',
};

describe('CreateCommunityLauncher capability routing', () => {
  test('does not build an installation prompt before the community profile exists', async () => {
    const view = render(<CreateCommunityLauncher />);

    expect(view.getByRole('button', { name: 'Import recovery' })).toBeTruthy();
    fireEvent.click(view.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(document.activeElement).toBe(view.getByRole('heading', { name: 'How technical are you?' })));
    chooseAndContinue(view, /I can install apps and follow instructions/i);
    chooseAndContinue(view, /^Claude/i);
    chooseAndContinue(view, /^Windows/i);
    chooseAndContinue(view, /^Yes/i);
    chooseAndContinue(view, /^Yes/i);
    fireEvent.click(view.getByRole('button', { name: /^No/i }));

    expect(view.getByRole('heading', { name: 'Can it also open websites and click through setup screens?' })).toBeTruthy();
    fireEvent.click(view.getByRole('button', { name: 'Continue' }));
    expect(view.getByRole('heading', { name: 'Your AI handles the project. You handle the browser.' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Tell us about your community' })).toBeTruthy();
  });

  test('restores stage progress and moves focus after confirmation and reset', async () => {
    window.localStorage.setItem('local-community-launcher-v2', JSON.stringify({
      ...createRecoveryData(completeProfile, []),
      step: 'outcome',
      savedAt: new Date().toISOString(),
    }));
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      const view = render(<CreateCommunityLauncher />);
      const firstHeading = await view.findByRole('heading', { name: 'Source and preflight' });
      await waitFor(() => expect(document.activeElement).toBe(firstHeading));
      fireEvent.click(view.getByRole('button', { name: 'My AI reported this stage passed' }));
      const nextHeading = await view.findByRole('heading', { name: 'Community identity' });
      await waitFor(() => expect(document.activeElement).toBe(nextHeading));
      expect(view.getByText("Source and preflight confirmed from your AI's reported checks.")).toBeTruthy();

      fireEvent.click(view.getByRole('button', { name: 'Start over' }));
      const welcomeHeading = await view.findByRole('heading', { name: 'We’ll build the prompts you need.' });
      await waitFor(() => expect(document.activeElement).toBe(welcomeHeading));
    } finally {
      window.confirm = originalConfirm;
    }
  });

  test('expires stale browser progress without restoring community data', async () => {
    window.localStorage.setItem('local-community-launcher-v2', JSON.stringify({
      ...createRecoveryData(completeProfile, []),
      step: 'outcome',
      savedAt: '2000-01-01T00:00:00.000Z',
    }));
    const view = render(<CreateCommunityLauncher />);
    expect(await view.findByText('Saved browser progress expired after 30 days. Import a recovery file or start again.')).toBeTruthy();
    expect(view.getByRole('heading', { name: 'We’ll build the prompts you need.' })).toBeTruthy();
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('local-community-launcher-v2') ?? '{}');
      expect(stored.answers?.communityName).toBe('');
    });
  });
});
