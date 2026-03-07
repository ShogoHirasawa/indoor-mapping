'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
type EditingField = 'username' | 'email' | 'bio' | 'avatar' | null;

export default function UserPage() {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [dropdownOpen]);

  const loadProfile = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, bio, avatar_url, updated_at')
      .eq('id', user.id)
      .single();
    if (!profile) {
      router.replace('/set-username');
      return;
    }
    setUsername(profile.username);
    setBio(profile.bio ?? null);
    const url = profile.avatar_url ?? null;
    setAvatarUrl(
      url && profile.updated_at
        ? `${url}?v=${new Date(profile.updated_at).getTime()}`
        : url,
    );
    setEmail(user.email ?? null);
    setUserId(user.id);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }, [router]);

  const startEdit = useCallback((field: EditingField, current: string) => {
    setEditingField(field);
    setEditValue(current);
    setMessage(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
    setMessage(null);
  }, []);

  const saveProfile = useCallback(
    async (field: 'username' | 'bio' | 'avatar', value: string) => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setSaving(true);
      setMessage(null);

      const payload =
        field === 'username'
          ? { username: value.trim() }
          : field === 'bio'
            ? { bio: value.trim() || null }
            : { avatar_url: value.trim() || null };

      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);

      setSaving(false);
      if (error) {
        if (error.code === '23505') {
          setMessage({ type: 'error', text: 'This username is already taken.' });
          return;
        }
        setMessage({ type: 'error', text: error.message });
        return;
      }

      if (field === 'username') setUsername(value.trim());
      if (field === 'bio') setBio(value.trim() || null);
      if (field === 'avatar') setAvatarUrl(value.trim() || null);
      setEditingField(null);
      setEditValue('');
      setMessage({ type: 'success', text: 'Saved.' });
    },
    [],
  );

  const saveEmail = useCallback(async (newEmail: string) => {
    const supabase = createClient();
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }
    setEmail(newEmail.trim());
    setEditingField(null);
    setEditValue('');
    setMessage({ type: 'success', text: 'Confirmation email sent. Please complete the change via the link in the email.' });
  }, []);

  const uploadAvatar = useCallback(async (file: File) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    if (!['jpeg', 'jpg', 'png', 'gif', 'webp'].includes(ext)) {
      setMessage({ type: 'error', text: 'Please choose a JPEG, PNG, GIF, or WebP image.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File size must be 2MB or less.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setSaving(false);
      setMessage({ type: 'error', text: uploadError.message });
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    setSaving(false);
    if (updateError) {
      setMessage({ type: 'error', text: updateError.message });
      return;
    }
    setAvatarUrl(`${publicUrl}?v=${Date.now()}`);
    setEditingField(null);
    setMessage({ type: 'success', text: 'Profile picture updated.' });
  }, []);

  const handleAvatarFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadAvatar(file);
      e.target.value = '';
    },
    [uploadAvatar],
  );

  const handleSave = useCallback(() => {
    if (editingField === 'username') {
      if (!USERNAME_REGEX.test(editValue.trim())) {
        setMessage({ type: 'error', text: 'Username must be 3–30 characters (letters, numbers, underscores only).' });
        return;
      }
      saveProfile('username', editValue);
    } else if (editingField === 'email') {
      if (!editValue.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editValue.trim())) {
        setMessage({ type: 'error', text: 'Please enter a valid email address.' });
        return;
      }
      saveEmail(editValue);
    } else if (editingField === 'bio') {
      saveProfile('bio', editValue);
    }
  }, [editingField, editValue, saveProfile, saveEmail]);

  const handleSendResetMail = useCallback(async () => {
    if (!email) {
      setMessage({ type: 'error', text: 'No email address is set.' });
      return;
    }
    const supabase = createClient();
    setResettingPassword(true);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setResettingPassword(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }
    setMessage({ type: 'success', text: 'Password reset email sent.' });
  }, [email]);

  const handleDeleteAccount = useCallback(async () => {
    if (!confirm('Your account cannot be recovered after deletion. Are you sure you want to delete it?')) return;
    setDeleting(true);
    setMessage(null);
    const res = await fetch('/api/user/delete', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      setMessage({ type: 'error', text: data.error || 'Failed to delete account.' });
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }, [router]);

  if (loading) {
    return (
      <div className="user-page">
        <div className="user-page-sidebar">
          <div className="user-page-loading">Loading...</div>
        </div>
      </div>
    );
  }

  const initial = username ? username.charAt(0).toUpperCase() : '?';
  const displayId = userId ? userId.replace(/-/g, '').slice(0, 15) : '—';

  return (
    <div className="user-page">
      <aside className="user-page-sidebar">
        <div className="user-page-account-wrap" ref={dropdownRef}>
          <button
            type="button"
            className="user-page-account-trigger"
            onClick={() => setDropdownOpen((o) => !o)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="user-page-avatar user-page-avatar-img" />
            ) : (
              <div className="user-page-avatar" aria-hidden>
                {initial}
              </div>
            )}
            <div className="user-page-account-trigger-text">
              <span className="user-page-sidebar-name">{username ?? '—'}</span>
            </div>
            <span className="user-page-account-caret" aria-hidden>
              <img
                src="/icons/chevron.svg"
                alt=""
                width={12}
                height={12}
                className="user-page-account-caret-icon"
              />
            </span>
          </button>
          {dropdownOpen && (
            <div className="user-page-account-dropdown">
              <div className="user-page-account-dropdown-user">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="user-page-avatar user-page-avatar--sm user-page-avatar-img" />
                ) : (
                  <div className="user-page-avatar user-page-avatar--sm">{initial}</div>
                )}
                <div>
                  <div className="user-page-account-dropdown-name">{username ?? '—'}</div>
                  <div className="user-page-account-dropdown-meta">Individual account</div>
                </div>
              </div>
              <button
                type="button"
                className="user-page-account-signout"
                onClick={handleSignOut}
              >
                <span className="user-page-signout-icon" aria-hidden>
                  <img
                    src="/icons/signout.svg"
                    alt=""
                    width={16}
                    height={16}
                    className="user-page-signout-icon-img"
                  />
                </span>
                Sign out
              </button>
            </div>
          )}
        </div>
        <nav className="user-page-nav">
          <div className="user-page-nav-heading">SETTINGS</div>
          <Link href="/user" className="user-page-nav-item user-page-nav-item--active">
            Profile
          </Link>
        </nav>
      </aside>

      <main className="user-page-main">
        <header className="user-page-main-header">
          <h1 className="user-page-main-title">Profile</h1>
          <Link href="/" className="user-page-close" aria-label="Close">
            ×
          </Link>
        </header>

        {message && (
          <div
            className={message.type === 'error' ? 'user-page-message user-page-message--error' : 'user-page-message user-page-message--success'}
          >
            {message.text}
          </div>
        )}

        <section className="user-page-section">
          <h2 className="user-page-section-title">General</h2>
          <ul className="user-page-field-list">
            <li className="user-page-field">
              <span className="user-page-field-label">ID</span>
              <span className="user-page-field-value">{displayId}</span>
            </li>
            <li className="user-page-field">
              <span className="user-page-field-label">Username</span>
              <span className="user-page-field-value">
                {editingField === 'username' ? (
                  <span className="user-page-edit-row">
                    <input
                      type="text"
                      className="user-page-edit-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="3–30 characters, letters, numbers, underscores"
                      maxLength={30}
                    />
                    <button type="button" className="user-page-edit-link" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" className="user-page-edit-link" onClick={cancelEdit} disabled={saving}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <>
                    {username ?? '—'}
                    <button type="button" className="user-page-edit-link" onClick={() => startEdit('username', username ?? '')}>
                      Edit
                    </button>
                  </>
                )}
              </span>
            </li>
            <li className="user-page-field">
              <span className="user-page-field-label">Email</span>
              <span className="user-page-field-value">
                {editingField === 'email' ? (
                  <span className="user-page-edit-row">
                    <input
                      type="email"
                      className="user-page-edit-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="email@example.com"
                    />
                    <button type="button" className="user-page-edit-link" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" className="user-page-edit-link" onClick={cancelEdit} disabled={saving}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <>
                    {email ?? '—'}
                    <button type="button" className="user-page-edit-link" onClick={() => startEdit('email', email ?? '')}>
                      Edit
                    </button>
                  </>
                )}
              </span>
            </li>
            <li className="user-page-field">
              <span className="user-page-field-label">Bio</span>
              <span className="user-page-field-value">
                {editingField === 'bio' ? (
                  <span className="user-page-edit-row">
                    <textarea
                      className="user-page-edit-input user-page-edit-textarea"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={3}
                    />
                    <button type="button" className="user-page-edit-link" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" className="user-page-edit-link" onClick={cancelEdit} disabled={saving}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <>
                    {bio || '—'}
                    <button type="button" className="user-page-edit-link" onClick={() => startEdit('bio', bio ?? '')}>
                      Edit
                    </button>
                  </>
                )}
              </span>
            </li>
            <li className="user-page-field">
              <span className="user-page-field-label">Profile picture</span>
              <span className="user-page-field-value user-page-field-value--avatar">
                {editingField === 'avatar' ? (
                  <span className="user-page-edit-row">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="user-page-file-input"
                      onChange={handleAvatarFileChange}
                      disabled={saving}
                    />
                    <button
                      type="button"
                      className="user-page-btn user-page-btn--secondary"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={saving}
                    >
                      {saving ? 'Uploading...' : 'Choose file'}
                    </button>
                    <button type="button" className="user-page-edit-link" onClick={cancelEdit} disabled={saving}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="user-page-avatar user-page-avatar--sm user-page-avatar-img" />
                    ) : (
                      <span className="user-page-avatar user-page-avatar--sm">{initial}</span>
                    )}
                    <button type="button" className="user-page-edit-link" onClick={() => startEdit('avatar', '')}>
                      Edit
                    </button>
                  </>
                )}
              </span>
            </li>
          </ul>
        </section>

        <section className="user-page-section">
          <h2 className="user-page-section-title">Account</h2>
          <ul className="user-page-field-list">
            <li className="user-page-field">
              <span className="user-page-field-label">Change password</span>
              <span className="user-page-field-value">
                <button
                  type="button"
                  className="user-page-btn user-page-btn--secondary"
                  onClick={handleSendResetMail}
                  disabled={resettingPassword}
                >
                  {resettingPassword ? 'Sending...' : 'Send reset mail'}
                </button>
              </span>
            </li>
            <li className="user-page-field">
              <span className="user-page-field-label">Delete account</span>
              <span className="user-page-field-value">
                <button
                  type="button"
                  className="user-page-btn user-page-btn--danger"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete account'}
                </button>
              </span>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
