'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiChangePassword } from '@/lib/api';
import { setAuthToken } from '@/lib/auth';
import styles from '@/components/crud.module.css';
import page from '../page.module.css';
import login from '../login/login.module.css';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await apiChangePassword(password);
      setAuthToken(result.token);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={login.screen}>
      <div className={login.card}>
        <p className={login.brand}>Enterprise Hub</p>
        <h1 className={page.title}>Set a new password</h1>
        <p className={page.lede}>
          Your temporary password must be replaced before you can use the workspace.
        </p>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="new-password">New password</label>
            <input
              id="new-password"
              className={styles.input}
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              className={styles.input}
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
            />
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button className={styles.button} type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </div>
    </section>
  );
}
