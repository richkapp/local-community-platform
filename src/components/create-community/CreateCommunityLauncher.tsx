import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LuArrowLeft,
  LuArrowRight,
  LuCheck,
  LuCopy,
  LuRotateCcw,
  LuShieldCheck,
  LuSparkles,
} from 'react-icons/lu';
import {
  COMMUNITY_PLATFORM_RELEASE,
  EMPTY_COMMUNITY_LAUNCHER_ANSWERS,
  INCLUDED_PLATFORM_FEATURES,
  INSTALLATION_STAGES,
  advanceInstallationProgress,
  buildHelperHandoff,
  buildRecoveryPrompt,
  buildSetupPrompt,
  buildStagePrompt,
  buildTechnicalBrief,
  createRecoveryData,
  migrateLegacyAnswers,
  parseRecoveryData,
  resolveLauncherRoute,
  validateCommunityAnswers,
  type AiService,
  type CapabilityAnswer,
  type CommunityLauncherAnswers,
  type InstallationStageId,
  type LauncherRoute,
  type OperatingSystem,
  type TechnicalLevel,
} from '@/lib/createCommunityLauncher';

const STORAGE_KEY = 'local-community-launcher-v2';
const LEGACY_STORAGE_KEY = 'local-community-launcher-v1';

const STEP_IDS = [
  'welcome',
  'technical',
  'ai',
  'os',
  'installed',
  'local-capability',
  'browser-capability',
  'route',
  'community-name',
  'location',
  'purpose',
  'audience',
  'organizer',
  'locale',
  'review',
  'outcome',
] as const;

type StepId = typeof STEP_IDS[number];
type CommunityTextField = 'communityName' | 'location' | 'purpose' | 'audience' | 'organizerName' | 'locale';
type ChoiceField = 'technicalLevel' | 'aiService' | 'operatingSystem' | 'toolInstalled' | 'localCapability' | 'browserCapability';
type ChoiceValue = TechnicalLevel | AiService | OperatingSystem | CapabilityAnswer;

type CommunityQuestion = {
  step: StepId;
  field: CommunityTextField;
  eyebrow: string;
  title: string;
  help: string;
  label: string;
  placeholder: string;
  maxLength: number;
  multiline?: boolean;
};

const COMMUNITY_QUESTIONS: CommunityQuestion[] = [
  { step: 'community-name', field: 'communityName', eyebrow: 'Community 1 of 6', title: 'What is your community called?', help: 'Use the name people will recognize.', label: 'Community name', placeholder: 'Riverside Makers', maxLength: 100 },
  { step: 'location', field: 'location', eyebrow: 'Community 2 of 6', title: 'Where is it based?', help: 'A city, town, neighbourhood, or wider area is enough.', label: 'Place or area', placeholder: 'Coimbra, Portugal', maxLength: 120 },
  { step: 'purpose', field: 'purpose', eyebrow: 'Community 3 of 6', title: 'Why does it exist?', help: 'Write naturally. Your AI can help polish public copy later.', label: 'Purpose', placeholder: 'We help local makers share practical skills and build projects together.', maxLength: 600, multiline: true },
  { step: 'audience', field: 'audience', eyebrow: 'Community 4 of 6', title: 'Who is it for?', help: 'Describe the people you want to bring together.', label: 'Intended members', placeholder: 'Makers, craftspeople, students, and curious neighbours.', maxLength: 400, multiline: true },
  { step: 'organizer', field: 'organizerName', eyebrow: 'Community 5 of 6', title: 'Who will organize it?', help: 'Use your name or the organizing team name.', label: 'Organizer or team', placeholder: 'Rita Costa', maxLength: 120 },
  { step: 'locale', field: 'locale', eyebrow: 'Community 6 of 6', title: 'What language should the platform use?', help: 'You can translate or add more content later.', label: 'Platform language', placeholder: 'English', maxLength: 30 },
];

const TECHNICAL_OPTIONS: Array<{ value: TechnicalLevel; label: string; detail: string }> = [
  { value: 'guided', label: 'Please explain every step', detail: 'I mostly use websites and apps.' },
  { value: 'comfortable', label: 'I can install apps and follow instructions', detail: 'I am comfortable when the steps are clear.' },
  { value: 'technical', label: 'I use GitHub and the terminal', detail: 'Show me the source and let me get moving.' },
];

const AI_OPTIONS: Array<{ value: AiService; label: string; detail: string }> = [
  { value: 'chatgpt', label: 'ChatGPT', detail: 'Including Codex if you already use it.' },
  { value: 'claude', label: 'Claude', detail: 'Including Claude Code if you already use it.' },
  { value: 'gemini', label: 'Gemini', detail: 'Google AI in the browser or a local tool.' },
  { value: 'perplexity', label: 'Perplexity', detail: 'Useful as a browser guide; not a local coding tool.' },
  { value: 'other', label: 'Something else', detail: 'We will route by what it can do, not its logo.' },
];

const OS_OPTIONS: Array<{ value: OperatingSystem; label: string; detail: string }> = [
  { value: 'mac', label: 'Mac', detail: 'macOS' },
  { value: 'windows', label: 'Windows', detail: 'Windows 10 or 11' },
  { value: 'linux', label: 'Linux', detail: 'Ubuntu, Debian, or another distribution' },
];

const CAPABILITY_OPTIONS: Array<{ value: CapabilityAnswer; label: string; detail: string }> = [
  { value: 'yes', label: 'Yes', detail: 'I have seen it do this.' },
  { value: 'no', label: 'No', detail: 'It only works as a normal chat.' },
  { value: 'not-sure', label: 'I’m not sure', detail: 'Use the safer route and help me check.' },
];

function isStepId(value: unknown): value is StepId {
  return typeof value === 'string' && STEP_IDS.includes(value as StepId);
}

function firstIncompleteStep(answers: CommunityLauncherAnswers): StepId {
  if (!answers.technicalLevel) return 'technical';
  if (answers.technicalLevel !== 'technical') {
    if (!answers.aiService) return 'ai';
    if (!answers.operatingSystem) return 'os';
    if (!answers.toolInstalled) return 'installed';
    if (answers.toolInstalled === 'yes' && !answers.localCapability) return 'local-capability';
    if (answers.toolInstalled === 'yes' && answers.localCapability === 'yes' && !answers.browserCapability) return 'browser-capability';
  }
  if (!resolveLauncherRoute(answers)) return 'route';
  for (const question of COMMUNITY_QUESTIONS) {
    if (!answers[question.field].trim()) return question.step;
  }
  return 'outcome';
}

function previousStep(step: StepId, answers: CommunityLauncherAnswers): StepId | null {
  const communityIndex = COMMUNITY_QUESTIONS.findIndex((question) => question.step === step);
  if (communityIndex === 0) return 'route';
  if (communityIndex > 0) return COMMUNITY_QUESTIONS[communityIndex - 1].step;
  if (step === 'welcome') return null;
  if (step === 'technical') return 'welcome';
  if (step === 'ai') return 'technical';
  if (step === 'os') return 'ai';
  if (step === 'installed') return 'os';
  if (step === 'local-capability') return 'installed';
  if (step === 'browser-capability') return 'local-capability';
  if (step === 'route') {
    if (answers.technicalLevel === 'technical') return 'technical';
    if (answers.toolInstalled !== 'yes') return 'installed';
    if (answers.localCapability !== 'yes') return 'local-capability';
    return 'browser-capability';
  }
  if (step === 'review') return 'locale';
  if (step === 'outcome') return 'review';
  return null;
}

function progressFor(step: StepId) {
  const communityIndex = COMMUNITY_QUESTIONS.findIndex((question) => question.step === step);
  if (communityIndex >= 0) return { label: `Community question ${communityIndex + 1} of 6`, percent: 48 + communityIndex * 7 };
  const map: Record<StepId, { label: string; percent: number }> = {
    welcome: { label: 'Start', percent: 5 },
    technical: { label: 'About you', percent: 12 },
    ai: { label: 'Your setup', percent: 18 },
    os: { label: 'Your setup', percent: 24 },
    installed: { label: 'Your setup', percent: 30 },
    'local-capability': { label: 'Your setup', percent: 35 },
    'browser-capability': { label: 'Your setup', percent: 40 },
    route: { label: 'Your route', percent: 45 },
    'community-name': { label: 'Community question 1 of 6', percent: 48 },
    location: { label: 'Community question 2 of 6', percent: 55 },
    purpose: { label: 'Community question 3 of 6', percent: 62 },
    audience: { label: 'Community question 4 of 6', percent: 69 },
    organizer: { label: 'Community question 5 of 6', percent: 76 },
    locale: { label: 'Community question 6 of 6', percent: 83 },
    review: { label: 'Review', percent: 92 },
    outcome: { label: 'Your launch path', percent: 100 },
  };
  return map[step];
}

function routeCopy(route: LauncherRoute) {
  if (route === 'technical') return {
    eyebrow: 'Technical shortcut',
    title: 'Fork it. Configure it. Ship it.',
    body: 'The tested source and self-hosting guide are ready now. The optional brief carries your community profile and launch proof gate.',
  };
  if (route === 'autonomous-agent') return {
    eyebrow: 'Autonomous-agent route',
    title: 'Your AI can handle most of the setup.',
    body: 'It can work locally and operate provider websites. You still own every account and approve every external action.',
  };
  if (route === 'local-coding') return {
    eyebrow: 'Local coding route',
    title: 'Your AI handles the project. You handle the browser.',
    body: 'It can edit files and run commands. When a provider screen appears, it will explain one action and wait for you.',
  };
  return {
    eyebrow: 'Browser and helper route',
    title: 'Your AI can prepare this, but it cannot install it yet.',
    body: 'That is fixable. Build the community brief first, then set up a capable local tool or hand it to a technical friend.',
  };
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function downloadText(filename: string, value: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ChoiceList({ options, value, onChoose }: {
  options: Array<{ value: ChoiceValue; label: string; detail: string }>;
  value: ChoiceValue;
  onChoose: (value: ChoiceValue) => void;
}) {
  return (
    <div className="mt-8 grid gap-3">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChoose(option.value)}
            className={`flex w-full items-start gap-4 rounded-3xl border p-5 text-left transition ${selected ? 'border-limewash bg-limewash/[0.09]' : 'border-white/15 bg-white/[0.025] hover:border-limewash/45'}`}
          >
            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-limewash bg-limewash text-ink-950' : 'border-white/30 text-transparent'}`}><LuCheck aria-hidden="true" /></span>
            <span><strong className="block text-lg text-white">{option.label}</strong><span className="mt-1 block text-sm leading-6 text-braga-200">{option.detail}</span></span>
          </button>
        );
      })}
    </div>
  );
}

function PromptPanel({ title, description, value, copied, onCopy, onDownload }: {
  title: string;
  description: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/12 bg-black/25">
      <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-black text-white">{title}</p><p className="mt-1 text-xs leading-5 text-braga-300">{description}</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onCopy} className="btn-primary gap-2"><LuCopy aria-hidden="true" />{copied ? 'Copied' : 'Copy prompt'}</button>
          <button type="button" onClick={onDownload} className="btn-secondary">Download</button>
        </div>
      </div>
      <textarea readOnly value={value} aria-label={title} className="h-64 w-full resize-y bg-transparent p-5 font-mono text-xs leading-6 text-braga-100 outline-none" />
    </div>
  );
}

export default function CreateCommunityLauncher() {
  const [answers, setAnswers] = useState<CommunityLauncherAnswers>({ ...EMPTY_COMMUNITY_LAUNCHER_ANSWERS });
  const [step, setStep] = useState<StepId>('welcome');
  const [completedStages, setCompletedStages] = useState<InstallationStageId[]>([]);
  const [ready, setReady] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const skipNextSave = useRef(false);
  const recoveryInputRef = useRef<HTMLInputElement>(null);
  const hasMountedStep = useRef(false);

  const route = resolveLauncherRoute(answers);
  const progress = progressFor(step);
  const currentStage = INSTALLATION_STAGES[completedStages.length];
  const siteLive = completedStages.includes('vercel-deployment');
  const communityReady = completedStages.length === INSTALLATION_STAGES.length;
  const profileReady = validateCommunityAnswers(answers).length === 0;

  const technicalBrief = useMemo(() => profileReady ? buildTechnicalBrief(answers) : '', [answers, profileReady]);
  const setupPrompt = useMemo(() => route === 'browser-only' && profileReady ? buildSetupPrompt(answers) : '', [answers, profileReady, route]);
  const helperHandoff = useMemo(() => route === 'browser-only' && profileReady ? buildHelperHandoff(answers) : '', [answers, profileReady, route]);
  const stagePrompt = useMemo(() => profileReady && currentStage && (route === 'local-coding' || route === 'autonomous-agent')
    ? buildStagePrompt(currentStage.id, answers, completedStages)
    : '', [answers, completedStages, currentStage, profileReady, route]);
  const recoveryPrompt = useMemo(() => profileReady && currentStage && (route === 'local-coding' || route === 'autonomous-agent')
    ? buildRecoveryPrompt(answers, currentStage.id, completedStages)
    : '', [answers, completedStages, currentStage, profileReady, route]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseRecoveryData(saved);
        const candidate = JSON.parse(saved) as { step?: unknown };
        setAnswers(parsed.answers);
        setCompletedStages(parsed.completedStages);
        setStep(isStepId(candidate.step) ? candidate.step : firstIncompleteStep(parsed.answers));
        setMessage('Your progress was restored from this browser.');
      } else {
        const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          const migrated = migrateLegacyAnswers(JSON.parse(legacy));
          setAnswers(migrated);
          setStep('technical');
          setMessage('Your community answers were kept. We need a few new setup answers.');
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      }
    } catch {
      setMessage('Saved progress could not be restored. You can still start here.');
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...createRecoveryData(answers, completedStages), step }));
    } catch {
      // Browser storage is optional. The launcher remains fully usable.
    }
  }, [answers, completedStages, ready, step]);

  useEffect(() => {
    if (route === 'browser-only' && completedStages.length > 0) setCompletedStages([]);
  }, [completedStages.length, route]);

  useEffect(() => {
    if (!hasMountedStep.current) {
      hasMountedStep.current = true;
      return;
    }
    document.getElementById('launcher-step-title')?.focus();
  }, [step]);

  function moveTo(target: StepId) {
    setErrors([]);
    setMessage('');
    setStep(target);
  }

  function choose(field: ChoiceField, value: ChoiceValue) {
    setAnswers((current) => {
      const next = { ...current, [field]: value } as CommunityLauncherAnswers;
      if (field === 'technicalLevel') Object.assign(next, { aiService: '', operatingSystem: '', toolInstalled: '', localCapability: '', browserCapability: '' });
      if (field === 'aiService') Object.assign(next, { operatingSystem: '', toolInstalled: '', localCapability: '', browserCapability: '' });
      if (field === 'operatingSystem') Object.assign(next, { toolInstalled: '', localCapability: '', browserCapability: '' });
      if (field === 'toolInstalled') Object.assign(next, { localCapability: '', browserCapability: '' });
      if (field === 'localCapability') next.browserCapability = '';
      return next;
    });
    setCompletedStages([]);
    setErrors([]);
  }

  function updateText(field: CommunityTextField, value: string) {
    setAnswers((current) => ({ ...current, [field]: value }));
    if (completedStages.length > 1) setCompletedStages(completedStages.includes('source-preflight') ? ['source-preflight'] : []);
    setErrors([]);
  }

  function errorsForCurrentStep() {
    if (step === 'technical' && !answers.technicalLevel) return ['Choose the description that fits you best.'];
    if (step === 'ai' && !answers.aiService) return ['Choose the AI you already use.'];
    if (step === 'os' && !answers.operatingSystem) return ['Choose your computer type.'];
    if (step === 'installed' && !answers.toolInstalled) return ['Choose Yes, No, or I’m not sure.'];
    if (step === 'local-capability' && !answers.localCapability) return ['Choose Yes, No, or I’m not sure.'];
    if (step === 'browser-capability' && !answers.browserCapability) return ['Choose Yes, No, or I’m not sure.'];
    const question = COMMUNITY_QUESTIONS.find((candidate) => candidate.step === step);
    if (question && !answers[question.field].trim()) return [`Add ${question.label.toLowerCase()} before continuing.`];
    return [];
  }

  function continueForward() {
    const currentErrors = errorsForCurrentStep();
    if (currentErrors.length > 0) {
      setErrors(currentErrors);
      return;
    }
    if (step === 'welcome') return moveTo('technical');
    if (step === 'technical') return moveTo(answers.technicalLevel === 'technical' ? 'route' : 'ai');
    if (step === 'ai') return moveTo('os');
    if (step === 'os') return moveTo('installed');
    if (step === 'installed') return moveTo(answers.toolInstalled === 'yes' ? 'local-capability' : 'route');
    if (step === 'local-capability') return moveTo(answers.localCapability === 'yes' ? 'browser-capability' : 'route');
    if (step === 'browser-capability') return moveTo('route');
    if (step === 'route') return moveTo('community-name');
    const questionIndex = COMMUNITY_QUESTIONS.findIndex((question) => question.step === step);
    if (questionIndex >= 0) return moveTo(COMMUNITY_QUESTIONS[questionIndex + 1]?.step ?? 'review');
    if (step === 'review') return moveTo('outcome');
  }

  function moveBack() {
    const target = previousStep(step, answers);
    if (target) moveTo(target);
  }

  async function copyArtifact(id: string, value: string) {
    try {
      await copyToClipboard(value);
      setCopied(id);
      setMessage('Copied. Paste it into your chosen AI.');
      window.setTimeout(() => setCopied((current) => current === id ? null : current), 2_500);
    } catch {
      setErrors(['Copy failed. Select the prompt text and copy it manually.']);
    }
  }

  function downloadRecovery() {
    const recovery = createRecoveryData(answers, completedStages);
    downloadText('community-launcher-recovery.json', JSON.stringify(recovery, null, 2), 'application/json');
    setMessage('Recovery file downloaded. It contains only the answers shown here and completed stage IDs; common secret patterns are redacted.');
  }

  async function importRecovery(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json' && file.type !== 'text/json') {
      setErrors(['Choose a JSON recovery file.']);
      return;
    }
    if (file.size > 100_000) {
      setErrors(['That recovery file is too large.']);
      return;
    }
    try {
      const parsed = parseRecoveryData(await file.text());
      setAnswers(parsed.answers);
      setCompletedStages(parsed.completedStages);
      moveTo(validateCommunityAnswers(parsed.answers).length === 0 ? 'review' : firstIncompleteStep(parsed.answers));
      setMessage('Recovery file imported. Review the restored answers before continuing.');
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'That recovery file could not be imported.']);
    }
  }

  function reset() {
    if (!window.confirm('Start over? This clears only launcher answers saved in this browser. It does not touch your project or provider accounts.')) return;
    skipNextSave.current = true;
    setAnswers({ ...EMPTY_COMMUNITY_LAUNCHER_ANSWERS });
    setCompletedStages([]);
    setStep('welcome');
    setErrors([]);
    setMessage('');
    setCopied(null);
    setShowHelp(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // There is nothing else to clear when browser storage is unavailable.
    }
  }

  function markCurrentStageVerified() {
    if (!currentStage) return;
    setCompletedStages((current) => advanceInstallationProgress(current, currentStage.id));
    setShowHelp(false);
    setMessage(`${currentStage.title} marked verified.`);
  }

  const communityQuestion = COMMUNITY_QUESTIONS.find((question) => question.step === step);
  const choicePage = step === 'technical' ? { eyebrow: 'About you', title: 'How technical are you?', help: 'There is no wrong answer. This only changes how much guidance you see.', field: 'technicalLevel' as const, value: answers.technicalLevel, options: TECHNICAL_OPTIONS }
    : step === 'ai' ? { eyebrow: 'Your setup', title: 'Which AI do you already use?', help: 'Choose the one you are most comfortable asking for help.', field: 'aiService' as const, value: answers.aiService, options: AI_OPTIONS }
    : step === 'os' ? { eyebrow: 'Your setup', title: 'Which computer are you using?', help: 'We use this only to tailor the setup instructions.', field: 'operatingSystem' as const, value: answers.operatingSystem, options: OS_OPTIONS }
    : step === 'installed' ? { eyebrow: 'Your setup', title: 'Is that AI installed on this computer?', help: 'A browser tab does not count as installed.', field: 'toolInstalled' as const, value: answers.toolInstalled, options: CAPABILITY_OPTIONS }
    : step === 'local-capability' ? { eyebrow: 'Your setup', title: 'Can it open a folder on this computer and run commands?', help: 'Normal browser chat cannot do this. Codex and Claude Code can.', field: 'localCapability' as const, value: answers.localCapability, options: CAPABILITY_OPTIONS }
    : step === 'browser-capability' ? { eyebrow: 'Your setup', title: 'Can it also open websites and click through setup screens?', help: 'If not, that is fine. You will handle those few browser actions.', field: 'browserCapability' as const, value: answers.browserCapability, options: CAPABILITY_OPTIONS }
    : null;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/12 bg-ink-900/80 shadow-2xl shadow-black/25 backdrop-blur" aria-label="Create your community launcher">
      <div className="border-b border-white/10 px-5 py-5 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-limewash">Create your community</p>
            <p className="mt-1 text-sm text-braga-200">{progress.label}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={downloadRecovery} className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-3 text-sm font-bold text-braga-100 transition hover:border-limewash hover:text-limewash">Download recovery file</button>
            <button type="button" aria-controls="launcher-recovery-input" onClick={() => recoveryInputRef.current?.click()} className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-3 text-sm font-bold text-braga-100 transition hover:border-limewash hover:text-limewash">Import recovery</button>
            <input ref={recoveryInputRef} id="launcher-recovery-input" type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void importRecovery(file); }} />
            <button type="button" onClick={reset} className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-bold text-braga-200 transition hover:bg-white/5 hover:text-white"><LuRotateCcw aria-hidden="true" /> Start over</button>
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Launcher progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
          <div className="h-full rounded-full bg-limewash transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress.percent}%` }} />
        </div>
      </div>

      <div className="min-h-[36rem] px-5 py-8 sm:px-8 sm:py-10">
        {step === 'welcome' && (
          <div className="mx-auto max-w-2xl">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-limewash text-ink-950 shadow-lg shadow-limewash/15"><LuSparkles className="h-7 w-7" aria-hidden="true" /></div>
            <h2 id="launcher-step-title" tabIndex={-1} className="mt-6 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">We’ll build the prompts you need.</h2>
            <p className="mt-4 max-w-xl text-lg leading-8 text-braga-100">Answer a few simple questions. We will match the instructions to your computer and the AI you already use.</p>
            <div className="mt-7 flex items-start gap-3 rounded-2xl border border-braga-300/20 bg-braga-400/[0.06] p-4 text-sm leading-6 text-braga-100">
              <LuShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-braga-300" aria-hidden="true" />
              <p>This launcher does not run an AI, require an account, or ask for credentials. You use your own AI or a trusted helper and create every provider account yourself.</p>
            </div>
          </div>
        )}

        {choicePage && (
          <div className="mx-auto max-w-2xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-limewash">{choicePage.eyebrow}</p>
            <h2 id="launcher-step-title" tabIndex={-1} className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">{choicePage.title}</h2>
            <p className="mt-3 text-base leading-7 text-braga-100">{choicePage.help}</p>
            <ChoiceList options={choicePage.options} value={choicePage.value} onChoose={(value) => choose(choicePage.field, value)} />
          </div>
        )}

        {step === 'route' && route && (() => {
          const copy = routeCopy(route);
          return (
            <div className="mx-auto max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-limewash">{copy.eyebrow}</p>
              <h2 id="launcher-step-title" tabIndex={-1} className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">{copy.title}</h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-braga-100">{copy.body}</p>
              {route === 'technical' && (
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <a href={COMMUNITY_PLATFORM_RELEASE.url} target="_blank" rel="noreferrer" className="rounded-3xl border border-limewash/35 bg-limewash/[0.08] p-5 transition hover:border-limewash">
                    <strong className="text-lg text-white">Open release {COMMUNITY_PLATFORM_RELEASE.tag}</strong>
                    <span className="mt-2 block text-sm leading-6 text-braga-200">Tested source, release notes, and archive.</span>
                  </a>
                  <a href={COMMUNITY_PLATFORM_RELEASE.guide} target="_blank" rel="noreferrer" className="rounded-3xl border border-white/15 bg-white/[0.025] p-5 transition hover:border-limewash/45">
                    <strong className="text-lg text-white">Read self-hosting guide</strong>
                    <span className="mt-2 block text-sm leading-6 text-braga-200">Provider setup, migrations, deployment, and proof.</span>
                  </a>
                </div>
              )}
              <div className="mt-7 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-braga-100">
                <LuShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-limewash" aria-hidden="true" />
                <p>Your GitHub, Supabase, email, database, and Vercel accounts stay yours. Do not enter credentials in this launcher or an AI chat.</p>
              </div>
            </div>
          );
        })()}

        {communityQuestion && (
          <div className="mx-auto max-w-2xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-limewash">{communityQuestion.eyebrow}</p>
            <h2 id="launcher-step-title" tabIndex={-1} className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">{communityQuestion.title}</h2>
            <p className="mt-3 text-base leading-7 text-braga-100">{communityQuestion.help}</p>
            <p className="mt-2 text-sm text-braga-300">Never paste passwords, tokens, API keys, or connection strings here.</p>
            <label className="mt-8 block">
              <span className="label">{communityQuestion.label}</span>
              {communityQuestion.multiline ? (
                <textarea autoFocus className="input mt-2 min-h-36 resize-y bg-ink-950/55" maxLength={communityQuestion.maxLength} value={answers[communityQuestion.field]} onChange={(event) => updateText(communityQuestion.field, event.target.value)} placeholder={communityQuestion.placeholder} />
              ) : (
                <input autoFocus className="input mt-2 min-h-12 bg-ink-950/55" maxLength={communityQuestion.maxLength} value={answers[communityQuestion.field]} onChange={(event) => updateText(communityQuestion.field, event.target.value)} placeholder={communityQuestion.placeholder} autoComplete={communityQuestion.field === 'communityName' ? 'organization' : communityQuestion.field === 'organizerName' ? 'name' : 'off'} />
              )}
            </label>
          </div>
        )}

        {step === 'review' && route && (
          <div className="mx-auto max-w-4xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-limewash">Review</p>
            <h2 id="launcher-step-title" tabIndex={-1} className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">Your launch package is ready to build.</h2>
            <p className="mt-3 text-base leading-7 text-braga-100">Six facts. No branding homework. Every built feature stays installed and is configured later through super-admin Settings.</p>
            <div className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-3xl border border-white/12 bg-white/[0.025] p-6">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-braga-300">Community</p>
                <h3 className="mt-3 text-2xl font-black text-white">{answers.communityName}</h3>
                <p className="mt-1 font-bold text-limewash">{answers.location}</p>
                <p className="mt-5 text-sm leading-6 text-braga-100">{answers.purpose}</p>
                <dl className="mt-6 space-y-3 text-sm">
                  <div><dt className="text-braga-300">For</dt><dd className="mt-1 text-white">{answers.audience}</dd></div>
                  <div><dt className="text-braga-300">Organizer</dt><dd className="mt-1 text-white">{answers.organizerName}</dd></div>
                  <div><dt className="text-braga-300">Language</dt><dd className="mt-1 text-white">{answers.locale}</dd></div>
                </dl>
              </div>
              <div className="rounded-3xl border border-white/12 bg-white/[0.025] p-6">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-braga-300">Included platform</p>
                <ul className="mt-4 space-y-3 text-sm text-braga-100">{INCLUDED_PLATFORM_FEATURES.map((feature) => <li key={feature} className="flex gap-3"><LuCheck className="mt-0.5 shrink-0 text-limewash" aria-hidden="true" /><span>{feature}</span></li>)}</ul>
              </div>
            </div>
          </div>
        )}

        {step === 'outcome' && route === 'technical' && (
          <div className="mx-auto max-w-4xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-limewash">Configuration brief</p>
            <h2 id="launcher-step-title" tabIndex={-1} className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">Source, profile, proof gate. Done.</h2>
            <p className="mt-3 mb-8 text-base leading-7 text-braga-100">Use this as the concise handoff to your agent, or go straight to the tagged source.</p>
            <PromptPanel title="Technical launch brief" description="Pinned source plus your approved community profile." value={technicalBrief} copied={copied === 'technical'} onCopy={() => void copyArtifact('technical', technicalBrief)} onDownload={() => downloadText('community-technical-brief.md', technicalBrief)} />
          </div>
        )}

        {step === 'outcome' && route === 'browser-only' && (
          <div className="mx-auto max-w-4xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-limewash">Prepared handoff</p>
            <h2 id="launcher-step-title" tabIndex={-1} className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">Your community is defined. Choose the helper.</h2>
            <p className="mt-3 text-base leading-7 text-braga-100">Browser AI can explain the next move, but it cannot honestly install and verify the platform alone.</p>
            <div className="mt-8 grid gap-6">
              <div>
                <h3 className="text-xl font-black text-white">Set up a capable tool</h3>
                <p className="mt-2 mb-4 text-sm leading-6 text-braga-200">Give this prompt to the AI you already use. It will guide you through the official local setup.</p>
                <PromptPanel title="Local tool setup prompt" description="Tailored to your AI and operating system." value={setupPrompt} copied={copied === 'setup'} onCopy={() => void copyArtifact('setup', setupPrompt)} onDownload={() => downloadText('local-ai-setup-prompt.md', setupPrompt)} />
                <button type="button" onClick={() => { setAnswers((current) => ({ ...current, toolInstalled: 'yes', localCapability: '', browserCapability: '' })); moveTo('local-capability'); }} className="btn-primary mt-4">I installed the tool — check it</button>
              </div>
              <div className="border-t border-white/10 pt-6">
                <h3 className="text-xl font-black text-white">Ask a technical friend</h3>
                <p className="mt-2 mb-4 text-sm leading-6 text-braga-200">Send them a complete, non-secret handoff. They use accounts you own and keep you in control.</p>
                <PromptPanel title="Technical helper handoff" description="Community profile, stable source, ownership rules, and proof sequence." value={helperHandoff} copied={copied === 'helper'} onCopy={() => void copyArtifact('helper', helperHandoff)} onDownload={() => downloadText('community-helper-handoff.md', helperHandoff)} />
              </div>
            </div>
          </div>
        )}

        {step === 'outcome' && (route === 'local-coding' || route === 'autonomous-agent') && (
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-limewash">Installation journey</p>
                <h2 id="launcher-step-title" tabIndex={-1} className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">{communityReady ? 'Community ready.' : currentStage?.title}</h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-braga-100">{communityReady ? 'All nine stages were confirmed from real checks. Keep the sanitized launch report.' : currentStage?.summary}</p>
              </div>
              <div className="flex gap-2">
                {siteLive && <span className="rounded-full bg-cyan-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-cyan-200">Site live</span>}
                {communityReady && <span className="rounded-full bg-limewash/15 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-limewash">Community ready</span>}
              </div>
            </div>

            <ol className="mt-8 grid gap-3 sm:grid-cols-3">
              {INSTALLATION_STAGES.map((stageItem, index) => {
                const done = index < completedStages.length;
                const active = index === completedStages.length;
                return <li key={stageItem.id} aria-current={active ? 'step' : undefined} className={`rounded-2xl border p-4 ${done ? 'border-limewash/35 bg-limewash/[0.06]' : active ? 'border-cyan-300/40 bg-cyan-300/[0.06]' : 'border-white/10 bg-white/[0.02] opacity-55'}`}><span className="text-xs font-black text-braga-300">{index + 1}</span><strong className="mt-1 block text-sm text-white">{stageItem.title}</strong>{done && <span className="mt-2 block text-xs font-bold text-limewash">Verified</span>}</li>;
              })}
            </ol>

            {!communityReady && currentStage && (
              <div className="mt-8">
                <PromptPanel title={`${completedStages.length + 1}. ${currentStage.title}`} description="Paste only this stage into your capable local AI." value={stagePrompt} copied={copied === `stage-${currentStage.id}`} onCopy={() => void copyArtifact(`stage-${currentStage.id}`, stagePrompt)} onDownload={() => downloadText(`${currentStage.id}-prompt.md`, stagePrompt)} />
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button type="button" onClick={() => setShowHelp((current) => !current)} className="btn-secondary">I’m stuck</button>
                  <button type="button" onClick={markCurrentStageVerified} className="btn-primary gap-2"><LuCheck aria-hidden="true" /> My AI verified this stage</button>
                </div>
                {showHelp && <div className="mt-5"><PromptPanel title="Diagnostic prompt" description="A fresh AI inspects real state and gives one safe next action." value={recoveryPrompt} copied={copied === 'diagnostic'} onCopy={() => void copyArtifact('diagnostic', recoveryPrompt)} onDownload={() => downloadText(`${currentStage.id}-diagnostic.md`, recoveryPrompt)} /></div>}
              </div>
            )}

            {communityReady && (
              <div className="mt-8 rounded-3xl border border-limewash/35 bg-limewash/[0.08] p-6">
                <LuCheck className="h-10 w-10 text-limewash" aria-hidden="true" />
                <h3 className="mt-4 text-2xl font-black text-white">Demo the real thing.</h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-braga-100">Show the public homepage, organizer login, super-admin Settings, and the controlled member invitation. Those checks—not this badge—are the proof.</p>
              </div>
            )}
          </div>
        )}

        {errors.length > 0 && <div className="error-message mx-auto mt-7 max-w-3xl" role="alert"><strong className="block text-white">One thing before you continue:</strong><ul className="mt-2 list-disc space-y-1 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
        {message && <p className="status-message mx-auto mt-5 max-w-3xl" role="status" aria-live="polite">{message}</p>}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        {previousStep(step, answers) ? <button type="button" onClick={moveBack} className="btn-secondary gap-2"><LuArrowLeft aria-hidden="true" />{step === 'outcome' ? 'Back to review' : 'Back'}</button> : <span />}
        {step !== 'outcome' && (
          <button type="button" onClick={continueForward} className="btn-primary gap-2">
            {step === 'welcome' ? 'Start' : step === 'route' && route === 'technical' ? 'Create optional setup brief' : step === 'route' ? 'Tell us about your community' : step === 'review' ? 'Build my launch path' : 'Continue'}<LuArrowRight aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
