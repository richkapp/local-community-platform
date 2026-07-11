import { type SyntheticEvent, useRef, useState } from 'react';
import { submitBugReport } from '@/lib/bugReports';

export default function BugReportDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  function open() {
    setError('');
    setSent(false);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      await submitBugReport({
        name: String(data.get('name') || ''),
        email: String(data.get('email') || ''),
        description: String(data.get('description') || ''),
        pageUrl: window.location.href,
        website: String(data.get('website') || '')
      });
      form.reset();
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The bug report could not be sent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" onClick={open} className="hover:text-limewash">🐞 Report a Bug</button>
      <dialog
        ref={dialogRef}
        aria-labelledby="bug-report-title"
        aria-describedby="bug-report-intro"
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(92vw,38rem)] overflow-y-auto overscroll-contain rounded-3xl border border-white/15 bg-ink-950 p-0 text-left text-white shadow-2xl backdrop:bg-black/75"
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-limewash">Help us fix it</p>
              <h2 id="bug-report-title" className="mt-2 text-2xl font-black text-white">Report a bug</h2>
              <p id="bug-report-intro" className="mt-3 text-sm leading-6 text-braga-100">Tell us what you were doing, how you found the bug, and exactly what happens.</p>
            </div>
            <button type="button" onClick={close} aria-label="Close bug report" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 text-xl text-braga-100 transition hover:border-limewash/60 hover:text-limewash">×</button>
          </div>

          {sent ? (
            <div className="mt-6 rounded-2xl border border-limewash/35 bg-limewash/10 p-5">
              <p className="font-bold text-limewash" role="status">Thanks. Your report is now in the organizer queue.</p>
              <p className="mt-2 text-sm leading-6 text-braga-100">We have the page it came from and the details you shared.</p>
              <button type="button" onClick={close} className="btn-primary mt-5">Close</button>
            </div>
          ) : (
            <form className="mt-6 space-y-5" onSubmit={submit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-white">
                  Name <span className="font-normal text-braga-300">(Optional)</span>
                  <input name="name" type="text" autoComplete="name" maxLength={100} className="input mt-2 w-full" />
                </label>
                <label className="block text-sm font-semibold text-white">
                  Email <span className="font-normal text-braga-300">(Optional)</span>
                  <input name="email" type="email" autoComplete="email" maxLength={254} className="input mt-2 w-full" />
                </label>
              </div>
              <p className="text-xs leading-5 text-braga-300">We’ll only use your contact details to follow up about this report.</p>

              <label className="block text-sm font-semibold text-white">
                What happened? <span className="font-normal text-braga-300">(Required)</span>
                <textarea
                  name="description"
                  required
                  minLength={20}
                  maxLength={5000}
                  rows={7}
                  className="input mt-2 w-full resize-y"
                  placeholder="What were you trying to do? How did you find the bug? What exactly happened?"
                />
              </label>

              <div className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                <label htmlFor="bug-report-website">Website</label>
                <input id="bug-report-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>

              {error && <p className="error-message" role="alert">{error}</p>}

              <div className="flex flex-wrap justify-end gap-3">
                <button type="button" onClick={close} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Sending…' : 'Send bug report'}</button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
