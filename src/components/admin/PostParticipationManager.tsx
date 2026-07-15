import { useEffect, useState } from 'react';
import { toUserMessage } from '@/lib/errors';
import {
  getPostParticipationSettings,
  lockedPostParticipationSettings,
  setPostParticipationSetting,
  type PostParticipationSettingKey,
  type PostParticipationSettings
} from '@/lib/postParticipation';

const controls: Array<{
  key: PostParticipationSettingKey;
  label: string;
  description: string;
}> = [
  {
    key: 'allow_anonymous_posts',
    label: 'Allow anonymous posts',
    description: 'Lets signed-in members hide their profile. Signed-out posting also requires this setting.'
  },
  {
    key: 'allow_signed_out_posts',
    label: 'Allow posts from logged-out users',
    description: 'Lets visitors publish without an account when anonymous posts are also allowed.'
  },
  {
    key: 'allow_anonymous_comments',
    label: 'Allow anonymous comments',
    description: 'Lets signed-in active members hide their profile on top-level comments.'
  },
  {
    key: 'allow_anonymous_replies',
    label: 'Allow anonymous replies',
    description: 'Lets signed-in active members hide their profile when replying to comments.'
  }
];

export default function PostParticipationManager() {
  const [settings, setSettings] = useState<PostParticipationSettings>(lockedPostParticipationSettings);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<PostParticipationSettingKey | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    getPostParticipationSettings()
      .then((next) => { if (current) setSettings(next); })
      .catch((caught) => { if (current) setError(toUserMessage('admin-load', caught)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);

  async function toggle(key: PostParticipationSettingKey) {
    if (busyKey || loading) return;
    const next = !settings[key];
    setBusyKey(key); setMessage(''); setError('');
    try {
      const saved = await setPostParticipationSetting(key, next);
      setSettings((current) => ({ ...current, [key]: saved }));
      setMessage(`${controls.find((control) => control.key === key)?.label ?? 'Setting'} ${saved ? 'enabled' : 'disabled'}.`);
    } catch (caught) {
      setError(toUserMessage('admin-save', caught));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="post-participation-title" aria-busy={loading || busyKey !== null}>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-limewash">Super admin controls</p>
      <h2 id="post-participation-title" className="mt-2 text-xl font-bold text-white">Post participation</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-braga-200">These switches are enforced by the database, not only hidden in the interface.</p>

      <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
        {controls.map((control) => {
          const enabled = settings[control.key];
          return <div key={control.key} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="pr-4">
              <h3 className="font-bold text-white">{control.label}</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-braga-300">{control.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={control.label}
              className={`relative inline-flex h-11 w-20 shrink-0 items-center rounded-full border p-1 transition ${enabled ? 'border-limewash bg-limewash/15' : 'border-braga-300/35 bg-ink-950/50'}`}
              onClick={() => void toggle(control.key)}
              disabled={loading || busyKey !== null}
            >
              <span className={`grid h-8 w-8 place-items-center rounded-full text-[10px] font-black uppercase transition-transform ${enabled ? 'translate-x-9 bg-limewash text-ink-950' : 'translate-x-0 bg-braga-300 text-ink-950'}`} aria-hidden="true">{enabled ? 'On' : 'Off'}</span>
            </button>
          </div>;
        })}
      </div>

      {loading && <p className="mt-4 text-sm text-braga-300" role="status">Loading participation settings…</p>}
      {message && <p className="status-message mt-4" role="status">{message}</p>}
      {error && <p className="error-message mt-4" role="alert">{error}</p>}
    </section>
  );
}
