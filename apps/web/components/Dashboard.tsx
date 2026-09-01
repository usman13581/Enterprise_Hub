import Link from 'next/link';
import styles from './Dashboard.module.css';

export function DashboardHero({
  title,
  subtitle,
  chip,
  chipTone = 'muted',
}: {
  title: string;
  subtitle?: string;
  chip?: string;
  chipTone?: 'active' | 'trial' | 'muted';
}) {
  const chipClass =
    chipTone === 'active'
      ? styles.chipActive
      : chipTone === 'trial'
        ? styles.chipTrial
        : styles.chipMuted;

  return (
    <div className={styles.hero}>
      <div className={styles.heroText}>
        <h2 className={styles.heroTitle}>{title}</h2>
        {subtitle ? <p className={styles.heroSub}>{subtitle}</p> : null}
      </div>
      {chip ? <span className={`${styles.chip} ${chipClass}`}>{chip}</span> : null}
    </div>
  );
}

export function DashboardSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

export function DashboardMosaic({ children }: { children: React.ReactNode }) {
  return <div className={styles.mosaic}>{children}</div>;
}

export function DashboardMetric({
  href,
  label,
  value,
  hint,
}: {
  href: string;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Link href={href} className={styles.metric}>
      <p className={styles.metricLabel}>{label}</p>
      <p className={styles.metricValue}>{value}</p>
      {hint ? <p className={styles.metricHint}>{hint}</p> : null}
    </Link>
  );
}

export function DashboardShortcuts({
  items,
}: {
  items: Array<{ href: string; label: string }>;
}) {
  const unique = items.filter(
    (item, index, list) =>
      list.findIndex((entry) => entry.href === item.href) === index,
  );

  return (
    <div className={styles.shortcutGrid}>
      {unique.map((item) => (
        <Link key={item.href} href={item.href} className={styles.shortcut}>
          {item.label}
        </Link>
      ))}
    </div>
  );
}
