import React, { useEffect, useState } from 'react';
import { AlertCircle, Lock, Mail, X } from 'lucide-react';
import { Session, emailSignIn, googleSignIn } from '../lib/auth';

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
  onSignedIn: (session: Session) => void;
}

const fieldClass =
  'w-full bg-mist focus:bg-mist-2 rounded-2xl pl-11 pr-4 py-3.5 text-[13px] font-semibold text-ink placeholder:text-quill-soft placeholder:font-medium outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-55';

const labelClass = 'block text-[10px] font-bold text-quill-soft uppercase tracking-wider mb-2';

export default function SignInModal({ open, onClose, onSignedIn }: SignInModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setEmail('');
      setPassword('');
      setError('');
      setBusy(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleGoogle = async () => {
    setError('');
    setBusy('google');
    try {
      const session = await googleSignIn();
      onSignedIn(session);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setError(err?.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter both your email address and password.');
      return;
    }

    setError('');
    setBusy('email');
    try {
      const session = await emailSignIn(email, password);
      onSignedIn(session);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('That email and password combination did not match any account.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Wait a moment before trying again.');
      } else {
        setError(err?.message || 'Sign-in failed. Please try again.');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-ink/45 overflow-y-auto"
      id="sign-in-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="bg-shell rounded-[30px] w-full max-w-[420px] my-auto p-7 sm:p-8 shadow-[0_40px_80px_-40px_rgba(19,17,38,0.8)] animate-rise">
        <div className="flex items-start justify-between gap-4 mb-7">
          <div>
            <h2 className="text-[24px] leading-none font-extrabold tracking-tight text-ink font-display">
              Sign in
            </h2>
            <p className="text-[12px] text-quill-soft font-medium mt-2">
              Administrators use Google. Vendors and customers use the email and password issued to them.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!!busy}
            title="Close"
            className="w-9 h-9 rounded-full bg-mist hover:bg-mist-2 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center transition-colors duration-200 cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <X className="w-4 h-4 text-quill" />
          </button>
        </div>

        {/* Google — always on top */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={!!busy}
          className="gsi-material-button w-full disabled:opacity-60 disabled:pointer-events-none"
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
              {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
            </span>
          </div>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <span className="h-px flex-1 bg-hairline" />
          <span className="text-[10px] font-bold text-quill-soft uppercase tracking-wider">or</span>
          <span className="h-px flex-1 bg-hairline" />
        </div>

        {/* Email + password below */}
        <form onSubmit={handleEmail} className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="signin-email">
              Email address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-quill-soft absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="signin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError('');
                }}
                disabled={!!busy}
                placeholder="you@company.com"
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="signin-password">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-quill-soft absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="signin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError('');
                }}
                disabled={!!busy}
                placeholder="Your password"
                className={fieldClass}
              />
            </div>
          </div>

          {error && (
            <div className="flex gap-2.5 items-start bg-[#fdf0ec] text-[#a8492f] px-4 py-3 rounded-2xl">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-[12px] font-semibold leading-relaxed">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!!busy}
            className="w-full bg-brand hover:bg-brand-mid disabled:opacity-60 disabled:pointer-events-none text-white text-[13px] font-bold py-3.5 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {busy === 'email' ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
