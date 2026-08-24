'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiLogin } from '@/lib/api';
import { setAuthToken } from '@/lib/auth';
import styles from '@/components/crud.module.css';
import page from '../page.module.css';
import login from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('owner@binhajmarble.ae');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiLogin({ email, password });
      setAuthToken(result.token);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={login.screen}>
      <div className={login.card}>
        <p className={login.brand}>Marble with Nuage</p>
        <h1 className={page.title}>Sign in</h1>
        <p className={page.lede}>
          Use your company account to open quotations, jobs, and invoices.
        </p>

        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={saving}>
              {saving ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>

        <p className={login.hint}>
          Pilot: owner@binhajmarble.ae · password from seed (default binhaj123)
        </p>
      </div>
    </section>
  );
}
