import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import React from 'react';

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
});
