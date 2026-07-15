import { lazy, Suspense, useEffect, useState } from 'react';

const BugReportDialog = lazy(() => import('./BugReportDialog'));

export default function BugReportLauncher() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const closeForNavigation = () => setLoaded(false);
    document.addEventListener('astro:before-preparation', closeForNavigation);
    return () => document.removeEventListener('astro:before-preparation', closeForNavigation);
  }, []);

  if (!loaded) {
    return (
      <button type="button" onClick={() => setLoaded(true)} className="hover:text-limewash">
        🐞 Report a Bug
      </button>
    );
  }

  return (
    <Suspense fallback={<span className="text-braga-300">Opening…</span>}>
      <BugReportDialog openOnMount />
    </Suspense>
  );
}
