'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

export default function SetUsernamePage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();
      if (profile) {
        router.replace('/');
        return;
      }
      setChecking(false);
    };
    check();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const trimmed = username.trim();
    if (!USERNAME_REGEX.test(trimmed)) {
      setError(
        'Username must be 3–30 characters (letters, numbers, underscores).',
      );
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/login');
      return;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: user.id, username: trimmed });

    if (profileError) {
      if (profileError.code === '23505') {
        setError('This username is already taken.');
      } else {
        setError(profileError.message);
      }
      setLoading(false);
      return;
    }

    router.replace('/');
    router.refresh();
  };

  if (checking) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p className="login-subtitle">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Indoor Mapping</h1>
        <p className="login-subtitle">
          Choose a username
          <br />
          <span style={{ fontSize: 12, fontWeight: 400 }}>
            (This is your public display name, separate from your email)
          </span>
        </p>

        <form onSubmit={handleSubmit}>
          <label className="login-label">
            Username
            <input
              className="login-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="3–30 characters (letters, numbers, _)"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
              autoComplete="username"
            />
          </label>

          {error && <p className="login-error">{error}</p>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Get started'}
          </button>
        </form>
      </div>
    </div>
  );
}
