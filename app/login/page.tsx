'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();

    const { error: authError } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (isSignUp) {
      setError('');
      setIsSignUp(false);
      setLoading(false);
      alert('Check your email to confirm your account, then log in.');
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">Indoor Mapping</h1>
        <p className="login-subtitle">
          {isSignUp ? 'Create an account' : 'Sign in to continue'}
        </p>

        <label className="login-label">
          Email
          <input
            className="login-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
          />
        </label>

        <label className="login-label">
          Password
          <input
            className="login-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
          />
        </label>

        {error && <p className="login-error">{error}</p>}

        <button className="login-btn" type="submit" disabled={loading}>
          {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Log In'}
        </button>

        <p className="login-toggle">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            className="login-toggle-btn"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
          >
            {isSignUp ? 'Log In' : 'Sign Up'}
          </button>
        </p>
      </form>
    </div>
  );
}
