import { useEffect, useState } from 'react';
import type { FormSubmitEvent } from '@/lib/dom';
import { createIdea, type IdeaPostingMode } from '@/lib/ideas';
import type { RipCategory, RipTag } from '@/lib/types';
import { toUserMessage } from '@/lib/errors';
import { useAuthUser } from '@/components/auth/useAuthUser';
import { isAnonymousUser } from '@/lib/anonymous';
import { clearIdeaDraft, loadIdeaDraft, requestIdeaAccount, saveIdeaDraft } from '@/lib/ideaDraft';
import RipTaxonomyPicker from './RipTaxonomyPicker';
import { communityConfig } from '@/config/community';

type Dialog = 'choice' | 'email' | 'sent' | null;

export default function IdeaComposer() {
  const { user, loading: authLoading } = useAuthUser();
  const signedIn = Boolean(user && !isAnonymousUser(user));
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<RipCategory>('idea');
  const [tags, setTags] = useState<RipTag[]>([]);
  const [email, setEmail] = useState('');
  const [emailConsent, setEmailConsent] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  useEffect(() => {
    const draft = loadIdeaDraft();
    if (!draft) return;
    setTitle(draft.title);
    setBody(draft.body);
    setCategory(draft.category);
    setTags(draft.tags);
    if (new URL(window.location.href).searchParams.get('restoreIdea') === '1') {
      setMessage('Your post is restored and ready to share.');
      window.history.replaceState({}, document.title, '/ideas');
    }
  }, []);

  function validateDraft() {
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (cleanTitle.length < 4 || cleanTitle.length > 120) throw new Error('Post titles must be 4–120 characters.');
    if (cleanBody.length < 10 || cleanBody.length > 2000) throw new Error('Post details must be 10–2000 characters.');
  }

  function submit(event: FormSubmitEvent) {
    event.preventDefault();
    setMessage('');
    try {
      validateDraft();
      setDialog('choice');
    } catch (error) {
      setStatus('error');
      setMessage(toUserMessage('idea-create', error));
    }
  }

  async function post(mode: IdeaPostingMode) {
    setDialog(null); setStatus('saving'); setMessage('');
    try {
      await createIdea({ title, body, category, tags, mode });
      clearIdeaDraft(); setTitle(''); setBody(''); setCategory('idea'); setTags([]); setStatus('saved'); setMessage(mode === 'anonymous' ? 'Post shared anonymously.' : 'Post shared with your profile.');
      window.dispatchEvent(new CustomEvent('braga:ideas-changed'));
    } catch (error) {
      setStatus('error'); setMessage(toUserMessage('idea-create', error));
    }
  }

  function startAccountFlow() {
    saveIdeaDraft(title.trim(), body.trim(), category, tags);
    setEmailConsent(false);
    setDialog('email');
  }

  async function sendAccountLink(event: FormSubmitEvent) {
    event.preventDefault(); setMessage('');
    if (!emailConsent) {
      setMessage('Please agree to receive the one-time magic-link email.');
      return;
    }
    setEmailBusy(true);
    try {
      saveIdeaDraft(title.trim(), body.trim(), category, tags);
      await requestIdeaAccount(email);
      setDialog('sent');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send the account link.');
    } finally { setEmailBusy(false); }
  }

  return (
    <>
      <form onSubmit={submit} className="card space-y-5 p-6" aria-busy={status === 'saving'}>
        <div>
          <h2 className="text-2xl font-black text-white">Add a post</h2>
          <p className="mt-2 text-sm leading-6 text-braga-200">Share an idea, resource, or perspective with the community.</p>
        </div>
        <RipTaxonomyPicker category={category} tags={tags} onCategoryChange={setCategory} onTagsChange={setTags} />
        <div><label className="label" htmlFor="idea-title">Title</label><input id="idea-title" className="input mt-2" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What should the community know or do?" minLength={4} maxLength={120} required /></div>
        <div><label className="label" htmlFor="idea-body">Details</label><textarea id="idea-body" className="input mt-2 min-h-32" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add the useful context, link, idea, or perspective." minLength={10} maxLength={2000} required /></div>
        <button type="submit" className="btn-primary" disabled={status === 'saving' || authLoading}>{status === 'saving' ? 'Posting…' : 'Post'}</button>
        {message && <p className={status === 'error' || dialog === 'email' ? 'error-message' : 'status-message'} role={status === 'error' ? 'alert' : 'status'} aria-live="polite">{message}</p>}
      </form>

      {dialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/80 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && dialog !== 'sent') setDialog(null); }}>
          <section className="card w-full max-w-md p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="idea-dialog-title">
            {dialog === 'choice' && <>
              <h2 id="idea-dialog-title" className="text-2xl font-black text-white">How should this post appear?</h2>
              <p className="mt-3 text-sm leading-6 text-braga-100">{signedIn ? 'Choose whether to attach your member profile.' : 'You can post now without an account, or use a magic link to create one.'}</p>
              <div className="mt-6 grid gap-3">
                <button type="button" className="btn-primary" onClick={() => void post('anonymous')}>Post anonymously</button>
                {signedIn
                  ? <button type="button" className="btn-secondary" onClick={() => void post('account')}>Post with my profile</button>
                  : <button type="button" className="btn-secondary" onClick={startAccountFlow}>Create account and post</button>}
                <button type="button" className="px-4 py-2 text-sm text-braga-200 hover:text-white" onClick={() => setDialog(null)}>Cancel</button>
              </div>
            </>}

            {dialog === 'email' && <form onSubmit={sendAccountLink}>
              <h2 id="idea-dialog-title" className="text-2xl font-black text-white">Sign in or create your account</h2>
              <p className="mt-3 text-sm leading-6 text-braga-100">It is the same passwordless process. Your post is saved in this browser while we email you a one-time magic link.</p>
              <label className="label mt-6 block" htmlFor="idea-email">Email address</label>
              <input id="idea-email" className="input mt-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required autoFocus />
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-braga-300/20 bg-white/[0.025] p-4 text-sm leading-6 text-braga-100">
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-limewash" checked={emailConsent} onChange={(event) => setEmailConsent(event.target.checked)} required disabled={emailBusy} />
                <span>I agree to receive a one-time login or signup link sent through Supabase. My email address will never be used for marketing.</span>
              </label>
              <div className="mt-6 grid gap-3"><button className="btn-primary" disabled={emailBusy || !emailConsent}>{emailBusy ? 'Sending…' : 'Email me the magic link'}</button><button type="button" className="px-4 py-2 text-sm text-braga-200 hover:text-white" onClick={() => setDialog('choice')}>Back</button></div>
              {message && <p className="error-message mt-4" role="alert">{message}</p>}
            </form>}

            {dialog === 'sent' && <>
              <h2 id="idea-dialog-title" className="text-2xl font-black text-white">Check your email</h2>
              <p className="mt-3 leading-7 text-braga-100">Open the newest {communityConfig.name} magic link. It creates or signs into your account, then returns you here with the post restored.</p>
              <button type="button" className="btn-primary mt-6 w-full" onClick={() => setDialog(null)}>Done</button>
            </>}
          </section>
        </div>
      )}
    </>
  );
}
