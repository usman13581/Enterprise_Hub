'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { APP_NAME, APP_POWERED_BY, APP_VERSION } from '@marble/types';
import { apiLogin } from '@/lib/api';
import { setAuthToken } from '@/lib/auth';
import styles from '@/components/crud.module.css';
import page from '../page.module.css';
import login from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
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
      router.replace(result.session.mustChangePassword ? '/change-password' : '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={login.screen}>
      <div className={login.card}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={login.mark}
          src="/brand/prequaliq-mark.png"
          alt="Prequaliq"
          width={56}
          height={56}
        />
        <p className={login.brand}>{APP_NAME}</p>
        <p className={login.powered}>{APP_POWERED_BY}</p>
        <p className={login.version}>v{APP_VERSION}</p>
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
          New company?{' '}
          <Link href="/get-started">Get started</Link>
        </p>
      </div>
    </section>
  );
}
