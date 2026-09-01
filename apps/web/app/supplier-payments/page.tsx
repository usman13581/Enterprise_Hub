'use client';

import { useMemo, useState } from 'react';
import { apiPost } from '@/lib/api';
import { todayIso } from '@/lib/dates';
import { amount, day, label, moneyHeader } from '@/lib/format';
import { useFlash, usePolledList } from '@/lib/useCollection';
import { Toast } from '@/components/ListControls';
import { SearchableSelect } from '@/components/SearchableSelect';
import { EmptyState, FilterBar, RowActionsBar, StatusBadge, TableScroll } from '@/components/Finance';
import type { PurchaseInvoice, Supplier } from '@marble/types';
import page from '../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

type Filter = 'all' | 'draft' | 'posted' | 'reversed';

type SupplierPaymentRow = {
  id: string;
  number: string;
  supplierId: string;
  supplier?: { id: string; name: string } | null;
  paidAt: string;
  amount: number;
  method: string;
  status: string;
  unappliedAmount: number;
};

export default function SupplierPaymentsPage() {
  const { items: suppliers } = usePolledList<Supplier>('/suppliers');
  const { items: invoices } = usePolledList<PurchaseInvoice>('/purchase-invoices');
  const { items, error: listError, setError, reload } =
    usePolledList<SupplierPaymentRow>('/supplier-payments');
  const { flash, notify } = useFlash();
  const [supplierId, setSupplierId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [amountValue, setAmountValue] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setFormError] = useState<string | null>(null);
  const payableInvoices = invoices.filter(
    (invoice) =>
      invoice.supplierId === supplierId &&
      invoice.balance > 0 &&
      ['posted', 'partially_paid'].includes(invoice.status),
  );

  const displayError = error ?? listError;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supplierId || !invoiceId || Number(amountValue) <= 0) return;
    try {
      await apiPost('/supplier-payments', {
        supplierId,
        paidAt: todayIso(),
        amount: Number(amountValue),
        method,
        reference: reference || null,
        allocations: [{ purchaseInvoiceId: invoiceId, amount: Number(amountValue) }],
      });
      setAmountValue('');
      setReference('');
      await reload();
      notify('Supplier payment saved as draft');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save payment');
    }
  }

  async function approve(id: string) {
    try {
      await apiPost(`/supplier-payments/${id}/approve`, {});
      await reload();
      notify('Supplier payment approved');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not approve payment');
    }
  }

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? items
        : items.filter((item) => item.status === filter),
    [items, filter],
  );

  return (
    <section className={page.page}>
      <h1 className={page.title}>Supplier payments</h1>
      {displayError ? <p className={styles.error}>{displayError}</p> : null}
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.grid}>
          <SearchableSelect
            label="Supplier *"
            value={supplierId}
            onChange={(value) => {
              setSupplierId(value);
              setInvoiceId('');
            }}
            required
            placeholder="Search suppliers…"
            options={suppliers
              .filter((item) => item.active)
              .map((item) => ({ id: item.id, label: item.name }))}
          />
          <SearchableSelect
            label="Allocate to invoice *"
            value={invoiceId}
            onChange={setInvoiceId}
            required
            disabled={!supplierId}
            placeholder="Search invoices…"
            options={payableInvoices.map((invoice) => ({
              id: invoice.id,
              label: `${invoice.number} · balance ${amount(invoice.balance)}`,
            }))}
          />
          <label className={styles.field}>
            <span className={styles.label}>{moneyHeader('Amount')} *</span>
            <input
              className={styles.input}
              required
              type="number"
              min="0.01"
              step="0.01"
              value={amountValue}
              onChange={(event) => setAmountValue(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Method</span>
            <select
              className={styles.select}
              value={method}
              onChange={(event) => setMethod(event.target.value)}
            >
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="card">Card</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Reference</span>
            <input
              className={styles.input}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </label>
        </div>
        <div className={styles.actions}>
          <button className={styles.button}>Save draft</button>
        </div>
      </form>

      <FilterBar
        active={filter}
        onChange={setFilter}
        options={[
          { key: 'all', label: 'All' },
          { key: 'draft', label: 'Draft' },
          { key: 'posted', label: 'Posted' },
          { key: 'reversed', label: 'Reversed' },
        ]}
      />

      {filtered.length === 0 ? (
        <EmptyState>
          {items.length === 0
            ? 'No supplier payments yet.'
            : 'No supplier payments match this filter.'}
        </EmptyState>
      ) : (
        <TableScroll>
          <table className={finance.table}>
            <thead>
              <tr>
                <th>Payment</th>
                <th>Supplier</th>
                <th>Paid</th>
                <th>Status</th>
                <th className={finance.numeric}>{moneyHeader('Amount')}</th>
                <th className={finance.numeric}>{moneyHeader('Unapplied')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.number}</strong>
                    <div className={styles.cardMeta}>{label(item.method)}</div>
                  </td>
                  <td>{item.supplier?.name ?? item.supplierId}</td>
                  <td>{day(item.paidAt)}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td className={finance.numeric}>{amount(item.amount)}</td>
                  <td className={finance.numeric}>{amount(item.unappliedAmount)}</td>
                  <td>
                    <RowActionsBar>
                      {item.status === 'draft' ? (
                        <button
                          className={styles.button}
                          onClick={() => void approve(item.id)}
                        >
                          Approve
                        </button>
                      ) : null}
                    </RowActionsBar>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
      <Toast flash={flash} />
    </section>
  );
}
