'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/api';
import { useFlash, usePolledList } from '@/lib/useCollection';
import { Toast } from '@/components/ListControls';
import { SearchableSelect } from '@/components/SearchableSelect';
import type { PurchaseInvoice, Supplier } from '@marble/types';
import page from '../page.module.css';
import styles from '@/components/crud.module.css';

export default function SupplierPaymentsPage() {
  const { items: suppliers } = usePolledList<Supplier>('/suppliers');
  const { items: invoices } = usePolledList<PurchaseInvoice>('/purchase-invoices');
  const { flash, notify } = useFlash();
  const [supplierId, setSupplierId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const payableInvoices = invoices.filter(
    (invoice) =>
      invoice.supplierId === supplierId &&
      invoice.balance > 0 &&
      ['posted', 'partially_paid'].includes(invoice.status),
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supplierId || !invoiceId || Number(amount) <= 0) return;
    try {
      await apiPost('/supplier-payments', {
        supplierId,
        paidAt: new Date().toISOString(),
        amount: Number(amount),
        method,
        reference: reference || null,
        allocations: [{ purchaseInvoiceId: invoiceId, amount: Number(amount) }],
      });
      setAmount('');
      setReference('');
      notify('Supplier payment recorded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record payment');
    }
  }

  return (
    <section className={page.page}>
      <h1 className={page.title}>Supplier payments</h1>
      <p className={page.lede}>
        Allocate payments to posted supplier bills or leave an amount as a supplier advance.
      </p>
      {error ? <p className={styles.error}>{error}</p> : null}
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
              label: `${invoice.number} · balance ${invoice.balance.toFixed(2)}`,
            }))}
          />
          <label className={styles.field}>
            <span className={styles.label}>Amount *</span>
            <input
              className={styles.input}
              required
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
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
          <button className={styles.button}>Record payment</button>
        </div>
      </form>
      <Toast flash={flash} />
    </section>
  );
}
