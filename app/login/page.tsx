'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

type OAuthProvider = 'google' | 'discord' | 'facebook' | 'github';

const OAUTH_PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'github', label: 'GitHub' },
  { id: 'discord', label: 'Discord' },
  { id: 'facebook', label: 'Facebook' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();

    if (isSignUp) {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      setError('');
      setIsSignUp(false);
      setLoading(false);
      alert('確認メールを送信しました。メール内のリンクで認証してからログインしてください。');
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  };

  const handleOAuth = useCallback(async (provider: OAuthProvider) => {
    setError('');
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
    }
  }, []);

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Indoor Mapping</h1>
        <p className="login-subtitle">
          {isSignUp ? 'Create an account' : 'Sign in to continue'}
        </p>

        <div className="oauth-buttons">
          {OAUTH_PROVIDERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`oauth-btn oauth-btn--${id}`}
              onClick={() => handleOAuth(id)}
            >
              <span className={`oauth-icon oauth-icon--${id}`} />
              {label}
            </button>
          ))}
        </div>

        <div className="login-divider">
          <span>or</span>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="login-label">
            Email
            <input
              className="login-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
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
        </form>

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
      </div>
    </div>
  );
}
