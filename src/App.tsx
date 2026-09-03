import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Fish,
  Layers,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Session, initAuth, logout } from './lib/auth';
import Dashboard from './components/Dashboard';
import PartnerPanel from './components/PartnerPanel';
import SignInModal from './components/SignInModal';

const BRAND_MARK =
  'https://mgx-backend-cdn.metadl.com/generate/images/1500378/2026-08-01/tumdfoacajra/logo-finnova-n-mark.png';
const WORKSPACE_IMAGE =
  'https://mgx-backend-cdn.metadl.com/generate/images/1500378/2026-08-01/tumdfbacajrq/card-workspace-desk-plant-lamp.png';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const unsubscribe = initAuth(
      (nextSession) => {
        setSession(nextSession);
        setNotice('');
        setShowSignIn(false);
        setAuthChecked(true);
      },
      (reason) => {
        setSession(null);
        if (reason) setNotice(reason);
        setAuthChecked(true);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setSession(null);
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

  if (session) {
    if (session.role === 'admin') {
      return (
        <Dashboard
          user={session.user}
          token={session.accessToken || ''}
          onLogout={handleLogout}
        />
      );
    }
    return <PartnerPanel session={session} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-canvas px-3 sm:px-5 py-4 sm:py-6" id="landing-page-root">
      <div className="max-w-[1320px] mx-auto bg-shell rounded-[34px] px-5 sm:px-9 py-6 sm:py-8 shadow-[0_40px_90px_-60px_rgba(19,17,38,0.7)]">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={BRAND_MARK} alt="" className="w-9 h-9 object-contain" />
            <div className="leading-none">
              <span className="block text-[19px] font-extrabold tracking-tight text-ink font-display">
                AQUA LEDGER
              </span>
              <span className="block text-[9px] font-semibold text-quill-soft mt-1">
                Fish trading, fully accounted
              </span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1 bg-ink rounded-full p-1.5">
            {['Overview', 'Purchases', 'Sales', 'Contacts'].map((label, index) => (
              <span
                key={label}
                className={`px-4 py-2.5 rounded-full text-[12px] font-bold ${
                  index === 0 ? 'bg-brand text-white' : 'text-white/55'
                }`}
              >
                {label}
              </span>
            ))}
            <a
              href="/track"
              className="px-4 py-2.5 rounded-full text-[12px] font-bold text-white/55 hover:text-white transition-colors no-underline"
            >
              Track invoice
            </a>
          </nav>

          <button
            type="button"
            onClick={() => setShowSignIn(true)}
            className="bg-brand hover:bg-brand-mid text-white text-[12px] font-bold px-5 py-3 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Sign in
          </button>
        </header>

        {notice && (
          <div className="mt-6 flex gap-3 items-start bg-[#fdf0ec] text-[#a8492f] px-5 py-4 rounded-[22px]">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-[12px] font-semibold leading-relaxed">{notice}</p>
          </div>
        )}

        {/* Hero */}
        <section className="mt-12 sm:mt-16 grid grid-cols-1 lg:grid-cols-5 gap-8 items-center" id="landing-hero">
          <div className="lg:col-span-3 space-y-6">
            <span className="inline-flex items-center gap-2 bg-brand-pale text-brand text-[10px] font-bold px-3.5 py-2 rounded-full uppercase tracking-wider">
              <Fish className="w-3.5 h-3.5" /> Vendors, customers and cash in one ledger
            </span>

            <h1 className="text-[42px] sm:text-[58px] leading-[1.03] font-extrabold tracking-tight text-ink font-display">
              Every catch bought,<br className="hidden sm:block" /> every crate sold, settled.
            </h1>

            <p className="text-[15px] text-quill leading-relaxed max-w-xl font-medium">
              Aqua Ledger keeps your fish trade honest: record what you buy from vendors, bill what you
              sell to customers, and give both sides their own portal to check exactly where they stand.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => setShowSignIn(true)}
                className="bg-ink hover:bg-ink-2 text-white text-[13px] font-bold px-6 py-3.5 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Sign in to your panel
              </button>

              <span className="flex items-center gap-2 text-[11px] text-quill-soft font-semibold max-w-[240px] leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-brand shrink-0" />
                Administrators use Google. Vendors and customers use their issued password.
              </span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <a
                href="/track"
                className="inline-flex items-center gap-2 bg-mist hover:bg-mist-2 border border-hairline text-ink text-[12px] font-bold px-5 py-3 rounded-full transition-colors no-underline"
              >
                <Layers className="w-3.5 h-3.5 text-brand" />
                Track an invoice
              </a>
              <span className="text-[11px] text-quill-soft font-medium">No login required</span>
            </div>
          </div>

          {/* Preview stack */}
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-ink rounded-[26px] p-5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Outstanding to collect
              </span>
              <div className="nums text-[30px] font-extrabold text-white font-display mt-2 leading-none">
                ₨ 4,798,000
              </div>
              <div className="grid grid-cols-3 gap-2 mt-5">
                {['Vendors', 'Customers', 'Cash'].map((label, index) => (
                  <div key={label} className={`rounded-[14px] p-3 ${index === 1 ? 'bg-brand' : 'bg-white/10'}`}>
                    <span className="nums block text-[12px] font-bold text-white">
                      {[159, 212, 107][index]}
                    </span>
                    <span className="block text-[9px] text-white/55 font-semibold mt-1">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-mist rounded-[26px] p-2.5">
              <div className="h-[132px] rounded-[20px] overflow-hidden">
                <img
                  src={WORKSPACE_IMAGE}
                  alt="Desk with laptop, plant and lamp"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex items-center justify-between px-3 py-3">
                <span className="text-[11px] font-bold text-ink">Average days to settle</span>
                <span className="nums flex items-center gap-1 text-[12px] font-extrabold text-brand">
                  9 days <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Panels */}
        <section className="mt-16 sm:mt-20" id="landing-panels">
          <h2 className="text-[11px] font-bold text-quill-soft uppercase tracking-wider mb-6">
            Three panels, one source of truth
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <article className="bg-mist rounded-[24px] p-6">
              <span className="w-11 h-11 rounded-2xl bg-brand-pale flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-brand" />
              </span>
              <h3 className="text-[15px] font-extrabold text-ink font-display mt-4">Admin panel</h3>
              <p className="text-[12px] text-quill leading-relaxed mt-2 font-medium">
                The full picture: dashboard, analytics, the invoice ledger, contacts and settings. Signed
                in with your Google account.
              </p>
            </article>

            <article className="bg-ink rounded-[24px] p-6">
              <span className="w-11 h-11 rounded-2xl bg-white/12 flex items-center justify-center">
                <Fish className="w-5 h-5 text-brand-soft" />
              </span>
              <h3 className="text-[15px] font-extrabold text-white font-display mt-4">Vendor panel</h3>
              <p className="text-[12px] text-white/60 leading-relaxed mt-2 font-medium">
                Suppliers sign in with the email and password you issue, then see their dashboard and
                every invoice raised against their supply.
              </p>
            </article>

            <article className="bg-mist rounded-[24px] p-6">
              <span className="w-11 h-11 rounded-2xl bg-brand-pale flex items-center justify-center">
                <Users className="w-5 h-5 text-brand" />
              </span>
              <h3 className="text-[15px] font-extrabold text-ink font-display mt-4">Customer panel</h3>
              <p className="text-[12px] text-quill leading-relaxed mt-2 font-medium">
                Buyers get the same clean view of their own invoices — what was billed, what they paid,
                and what is still due.
              </p>
            </article>
          </div>
        </section>

        <footer className="mt-14 pt-6 border-t border-hairline flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] font-semibold text-quill-soft">
            AQUA LEDGER © 2026 · Fish trading invoices
          </span>
          <div className="flex items-center gap-4">
            <a
              href="/track"
              className="text-[11px] font-bold text-brand hover:text-brand-mid no-underline transition-colors"
            >
              Track invoice
            </a>
            <span className="text-[11px] font-semibold text-quill-soft">
              Fish trading, fully accounted
            </span>
          </div>
        </footer>
      </div>

      <SignInModal
        open={showSignIn}
        onClose={() => setShowSignIn(false)}
        onSignedIn={(nextSession) => {
          setSession(nextSession);
          setShowSignIn(false);
          setNotice('');
        }}
      />
    </div>
  );
}
