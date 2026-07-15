import { useEffect, useState } from 'react';
import { navigate } from 'astro:transitions/client';
import { LuBookmark, LuLink, LuMessagesSquare, LuUserRound } from 'react-icons/lu';
import ProfileForm from '@/components/profile/ProfileForm';
import MemberInvitePool from '@/components/invites/MemberInvitePool';
import IdeaFeed from '@/components/ideas/IdeaFeed';

const tabs = [
  { key: 'profile', label: 'Profile', icon: LuUserRound },
  { key: 'invites', label: 'Invites', icon: LuLink },
  { key: 'posts', label: 'My posts', icon: LuMessagesSquare },
  { key: 'bookmarks', label: 'My bookmarks', icon: LuBookmark }
] as const;

export type SettingsTab = typeof tabs[number]['key'];

export function isSettingsTab(value: string | null): value is SettingsTab {
  return tabs.some((tab) => tab.key === value);
}

function readTab(search: string): SettingsTab {
  const searchParams = new URLSearchParams(search);
  const requested = searchParams.get('tab');
  return isSettingsTab(requested) ? requested : 'profile';
}

export default function SettingsHub({ initialTab = 'profile' }: { initialTab?: SettingsTab }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    const sync = () => setActiveTab(readTab(window.location.search));
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  function chooseTab(tab: SettingsTab) {
    if (tab === activeTab) return;
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    void navigate(url.href, { history: 'push' });
  }

  return (
    <div className="space-y-7">
      <nav className="flex flex-wrap gap-2" aria-label="Settings sections">
        {tabs.map(({ key, label, icon: Icon }) => (
          <a
            key={key}
            href={`/settings?tab=${key}`}
            aria-current={activeTab === key ? 'page' : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-limewash/70 ${activeTab === key ? 'border-limewash bg-limewash text-ink-950' : 'border-braga-300/30 text-braga-100 hover:border-limewash/60 hover:text-white'}`}
            onClick={(event) => { event.preventDefault(); chooseTab(key); }}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </a>
        ))}
      </nav>

      <section>
        {activeTab === 'profile' && <ProfileForm />}
        {activeTab === 'invites' && <MemberInvitePool />}
        {activeTab === 'posts' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-2xl font-black text-white">My posts</h2><p className="mt-1 text-sm text-braga-200">Your member-attributed post history. Open posts can be edited here.</p></div>
              <a className="text-sm font-bold text-limewash hover:underline" href="/posts">Browse all posts →</a>
            </div>
            <IdeaFeed initialView="mine" showIntro={false} showViewTabs={false} showFilters={false} />
          </div>
        )}
        {activeTab === 'bookmarks' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-2xl font-black text-white">My bookmarks</h2><p className="mt-1 text-sm text-braga-200">Posts you saved for later. Remove a bookmark with the same button.</p></div>
              <a className="text-sm font-bold text-limewash hover:underline" href="/posts">Find posts →</a>
            </div>
            <IdeaFeed initialView="bookmarks" showIntro={false} showViewTabs={false} showFilters={false} />
          </div>
        )}
      </section>
    </div>
  );
}
