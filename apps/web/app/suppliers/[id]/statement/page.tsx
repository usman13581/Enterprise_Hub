'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { BackLink, EmptyState, TableScroll } from '@/components/Finance';
import { money } from '@/lib/format';
import page from '../../../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

type Statement = { supplier: { name: string }; closing: number; rows: Array<{ id: string; occurredAt: string; description: string; direction: string; amount: number; balance: number }> };

export default function SupplierStatementPage() {
  const { id } = useParams<{ id: string }>();
  const [statement, setStatement] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void apiFetch<Statement>(`/suppliers/${id}/statement`).then(setStatement).catch((err) => setError(err instanceof Error ? err.message : 'Could not load statement')); }, [id]);
  return <section className={page.page}><BackLink href={`/suppliers/${id}`}>← Supplier hub</BackLink>{error ? <p className={styles.error}>{error}</p> : null}{!statement ? <p>Loading statement…</p> : <><h1 className={page.title}>{statement.supplier.name} statement</h1><p className={page.lede}>Closing payable {money(statement.closing)}</p>{statement.rows.length ? <TableScroll><table className={finance.table}><thead><tr><th>Date</th><th>Description</th><th>Direction</th><th className={finance.numeric}>Amount</th><th className={finance.numeric}>Balance</th></tr></thead><tbody>{statement.rows.map((row) => <tr key={row.id}><td>{new Date(row.occurredAt).toLocaleDateString()}</td><td>{row.description}</td><td>{row.direction}</td><td className={finance.numeric}>{money(row.amount)}</td><td className={finance.numeric}>{money(row.balance)}</td></tr>)}</tbody></table></TableScroll> : <EmptyState>No payable activity recorded.</EmptyState>}</>}</section>;
}
