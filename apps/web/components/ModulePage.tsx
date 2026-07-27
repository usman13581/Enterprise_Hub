import styles from './ModulePage.module.css';

export function ModulePage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lede}>{description}</p>
      <div className={styles.panel}>
        <p className={styles.panelTitle}>Coming in later phases</p>
        <p className={styles.panelBody}>
          This dashboard shell is wired for Phase 0 navigation. Feature CRUD
          lands in Phases 1–3.
        </p>
      </div>
    </section>
  );
}
