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
        'ユーザーIDは3〜30文字の英数字・アンダースコアで入力してください。',
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
        setError('このユーザーIDはすでに使われています。');
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
          <p className="login-subtitle">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Indoor Mapping</h1>
        <p className="login-subtitle">
          ユーザーIDを設定してください
          <br />
          <span style={{ fontSize: 12, fontWeight: 400 }}>
            （ログインのメール・パスワードとは別の、表示用IDです）
          </span>
        </p>

        <form onSubmit={handleSubmit}>
          <label className="login-label">
            ユーザーID
            <input
              className="login-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="3〜30文字の英数字・アンダースコア"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
              autoComplete="username"
            />
          </label>

          {error && <p className="login-error">{error}</p>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? '登録中...' : '登録して始める'}
          </button>
        </form>
      </div>
    </div>
  );
}
