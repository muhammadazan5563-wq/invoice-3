import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout } from './lib/auth';
import { saveFirebaseToken } from './lib/settings';
import Dashboard from './components/Dashboard';
import {
  Layers,
  Users,
  BarChart3,
  ArrowUpRight,
  ShieldCheck,
  Waves,
} from 'lucide-react';

const BRAND_MARK =
  'https://mgx-backend-cdn.metadl.com/generate/images/1500378/2026-08-01/tumdfoacajra/logo-finnova-n-mark.png';
const WORKSPACE_IMAGE =
  'https://mgx-backend-cdn.metadl.com/generate/images/1500378/2026-08-01/tumdfbacajrq/card-workspace-desk-plant-lamp.png';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setAuthChecked(true);
      },
      () => {
        setUser(null);
        setToken(null);
        setAuthChecked(true);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        try {
          await saveFirebaseToken(result.user.uid, result.user.email || '', result.accessToken, '');
        } catch (e) {
          console.warn('Failed to persist token to Supabase:', e);
        }
      }
    } catch (err) {
      console.error('Login error:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas" id="loading-spinner">
        <div className="flex flex-col items-center gap-4">
          <div className="w-9 h-9 border-[3px] border-hairline border-t-brand rounded-full animate-spin" />
          <p className="text-[12px] font-bold text-quill">Securing your session…</p>
        </div>
      </div>
    );
  }

  if (user && token) {
    return <Dashboard user={user} token={token} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-canvas px-3 sm:px-5 py-4 sm:py-6" id="landing-page-root">
      <div className="max-w-[1320px] mx-auto bg-shell rounded-[34px] px-5 sm:px-9 py-6 sm:py-8 shadow-[0_40px_90px_-60px_rgba(19,17,38,0.7)]">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={BRAND_MARK} alt="" className="w-9 h-9 object-contain" />
            <div className="leading-none">
              <span className="block text-[19px] font-extrabold tracking-tight text-ink font-display">FINNOVA</span>
              <span className="block text-[9px] font-semibold text-quill-soft mt-1">
                Smart Finances, Better Business
              </span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1 bg-ink rounded-full p-1.5">
            {['Overview', 'Estimates', 'Invoices', 'Payments', 'Recurring'].map((label, i) => (
              <span
                key={label}
                className={`px-4 py-2.5 rounded-full text-[12px] font-bold ${
                  i === 2 ? 'bg-brand text-white' : 'text-white/55'
                }`}
              >
                {label}
              </span>
            ))}
            <a
              href="/track"
              className="px-4 py-2.5 rounded-full text-[12px] font-bold text-white/55 hover:text-white transition-colors no-underline"
            >
              Track Invoice
            </a>
          </nav>

          <button
            type="button"
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="bg-brand hover:bg-brand-mid disabled:opacity-60 disabled:pointer-events-none text-white text-[12px] font-bold px-5 py-3 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {isLoggingIn ? 'Connecting…' : 'Sign in'}
          </button>
        </header>

        {/* Hero */}
        <section className="mt-12 sm:mt-16 grid grid-cols-1 lg:grid-cols-5 gap-8 items-center" id="landing-hero">
          <div className="lg:col-span-3 space-y-6">
            <span className="inline-flex items-center gap-2 bg-brand-pale text-brand text-[10px] font-bold px-3.5 py-2 rounded-full uppercase tracking-wider">
              <Waves className="w-3.5 h-3.5" /> Invoice ledger, reimagined
            </span>

            <h1 className="text-[42px] sm:text-[58px] leading-[1.03] font-extrabold tracking-tight text-ink font-display">
              Every invoice, every payout —<br className="hidden sm:block" /> settled in one calm view.
            </h1>

            <p className="text-[15px] text-quill leading-relaxed max-w-xl font-medium">
              FINNOVA pairs a premium React interface with your Google Sheet or Supabase table. Track overdue balances,
              watch collection speed, and settle invoices without leaving the dashboard.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2" id="google-login-action-box">
              <button
                type="button"
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="gsi-material-button"
              >
                <div className="gsi-material-button-state" />
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      xmlnsXlink="http://www.w3.org/1999/xlink"
                      style={{ display: 'block' }}
                    >
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {isLoggingIn ? 'Connecting…' : 'Continue with Google'}
                  </span>
                </div>
              </button>

              <span className="flex items-center gap-2 text-[11px] text-quill-soft font-semibold max-w-[220px] leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-brand shrink-0" />
                Read and append access to your spreadsheet only.
              </span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <a
                href="/track"
                className="inline-flex items-center gap-2 bg-mist hover:bg-mist-2 border border-hairline text-ink text-[12px] font-bold px-5 py-3 rounded-full transition-colors no-underline"
              >
                <Layers className="w-3.5 h-3.5 text-brand" />
                Track Your Invoice
              </a>
              <span className="text-[11px] text-quill-soft font-medium">No login required</span>
            </div>
          </div>

          {/* Preview stack */}
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-ink rounded-[26px] p-5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Balance due</span>
              <div className="nums text-[30px] font-extrabold text-white font-display mt-2 leading-none">
                $47,980.00
              </div>
              <div className="grid grid-cols-3 gap-2 mt-5">
                {['UI/UX', 'Dev', 'QA'].map((l, i) => (
                  <div key={l} className={`rounded-[14px] p-3 ${i === 1 ? 'bg-brand' : 'bg-white/10'}`}>
                    <span className="nums block text-[12px] font-bold text-white">
                      ${[15990, 21250, 10740][i].toLocaleString()}
                    </span>
                    <span className="block text-[9px] text-white/55 font-semibold mt-1">{l}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-mist rounded-[26px] p-2.5">
              <div className="h-[132px] rounded-[20px] overflow-hidden">
                <img src={WORKSPACE_IMAGE} alt="Desk with laptop, plant and lamp" className="w-full h-full object-cover" />
              </div>
              <div className="flex items-center justify-between px-3 py-3">
                <span className="text-[11px] font-bold text-ink">Average time to get paid</span>
                <span className="nums flex items-center gap-1 text-[12px] font-extrabold text-brand">
                  16 days <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="mt-16 sm:mt-20" id="landing-benefits">
          <h2 className="text-[11px] font-bold text-quill-soft uppercase tracking-wider mb-6">
            Why teams run billing on FINNOVA
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <article className="bg-mist rounded-[24px] p-6 md:row-span-1">
              <span className="w-11 h-11 rounded-2xl bg-brand-pale flex items-center justify-center">
                <Layers className="w-5 h-5 text-brand" />
              </span>
              <h3 className="text-[15px] font-extrabold text-ink font-display mt-4">Two backends, one view</h3>
              <p className="text-[12px] text-quill leading-relaxed mt-2 font-medium">
                Your billing team can type straight into the spreadsheet while clients see a polished interface. Supabase
                keeps the source of truth consistent.
              </p>
            </article>

            <article className="bg-ink rounded-[24px] p-6">
              <span className="w-11 h-11 rounded-2xl bg-white/12 flex items-center justify-center">
                <Users className="w-5 h-5 text-brand-soft" />
              </span>
              <h3 className="text-[15px] font-extrabold text-white font-display mt-4">Collaborative by default</h3>
              <p className="text-[12px] text-white/60 leading-relaxed mt-2 font-medium">
                Multiple editors, instant reads. Whoever updates a booking, the dashboard reflects it on the next sync.
              </p>
            </article>

            <article className="bg-mist rounded-[24px] p-6">
              <span className="w-11 h-11 rounded-2xl bg-brand-pale flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-brand" />
              </span>
              <h3 className="text-[15px] font-extrabold text-ink font-display mt-4">Analytics that answer</h3>
              <p className="text-[12px] text-quill leading-relaxed mt-2 font-medium">
                Overdue exposure, collection speed, top accounts and monthly revenue — all computed from your live rows.
              </p>
            </article>
          </div>
        </section>

        <footer className="mt-14 pt-6 border-t border-hairline flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] font-semibold text-quill-soft">
            FINNOVA © 2026 · Built with React, Tailwind and Supabase
          </span>
          <div className="flex items-center gap-4">
            <a href="/track" className="text-[11px] font-bold text-brand hover:text-brand-mid no-underline transition-colors">
              Track Invoice
            </a>
            <span className="text-[11px] font-semibold text-quill-soft">Smart Finances, Better Business</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
