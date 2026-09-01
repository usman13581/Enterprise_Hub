'use client';

import { useState } from 'react';
import { dateInputValue, dueDateIso, todayIso } from '@/lib/dates';
import { usePolledList } from '@/lib/useCollection';
import type { Lpo, Product, PurchaseInvoice, Supplier } from '@marble/types';
import {
  discountFromStored,
  discountPayload,
  EMPTY_DISCOUNT,
  type DiscountDraft,
} from '@/components/DiscountFields';
import { SearchableSelect } from '@/components/SearchableSelect';
import {
  EMPTY_PURCHASE_LINE,
  lpoLinePayload,
  lpoLinesToDraft,
  purchaseInvoiceLinesToDraft,
  purchaseLinePayload,
  PurchasingLineEditor,
} from '@/components/PurchasingLineEditor';
import styles from './crud.module.css';

export type LpoSavePayload = {
  supplierId: string;
  requestedDeliveryDate?: string | null;
  lines: Array<{
    productId?: string | null;
    productName: string;
    unit: string;
    orderedQty: number;
    unitCost: number;
    discountMode: DiscountDraft['discountMode'];
    discountValue: number;
  }>;
  discountMode: DiscountDraft['discountMode'];
  discountValue: number;
};

export type PurchaseInvoiceDetail = PurchaseInvoice & {
  taxInclusive: boolean;
  supplier: { id: string; name: string };
  lines: Array<{
    id: string;
    productId: string | null;
    productName: string;
    unit: string;
    qty: number;
    unitCost: number;
    discountMode: DiscountDraft['discountMode'];
    discountValue: number;
    lineTotal: number;
  }>;
};

export type PurchaseInvoiceSavePayload = {
  supplierId: string;
  lpoId: string | null;
  supplierInvoiceNumber: string | null;
  issueDate: string;
  dueDate: string | null;
  taxInclusive: boolean;
  discountMode: DiscountDraft['discountMode'];
  discountValue: number;
  lines: ReturnType<typeof purchaseLinePayload>;
};

export function PurchaseInvoiceForm({
  invoice,
  onSave,
  onCancel,
  saving,
}: {
  invoice?: PurchaseInvoiceDetail;
  onSave: (payload: PurchaseInvoiceSavePayload) => void | Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const editing = Boolean(invoice);
  const { items: suppliers } = usePolledList<Supplier>('/suppliers');
  const { items: products } = usePolledList<Product>('/products');
  const [supplierId, setSupplierId] = useState(invoice?.supplierId ?? '');
  const [lpoId, setLpoId] = useState(invoice?.lpoId ?? '');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState(
    invoice?.supplierInvoiceNumber ?? '',
  );
  const [issueDate, setIssueDate] = useState(
    dateInputValue(invoice?.issueDate) || todayIso(),
  );
  const [dueDate, setDueDate] = useState(
    invoice ? dateInputValue(invoice.dueDate) : dueDateIso(),
  );
  const [taxInclusive, setTaxInclusive] = useState(invoice?.taxInclusive ?? false);
  const [documentDiscount, setDocumentDiscount] = useState<DiscountDraft>(() =>
    invoice
      ? discountFromStored(invoice.discountMode, invoice.discountValue)
      : { ...EMPTY_DISCOUNT },
  );
  const [lines, setLines] = useState(() =>
    invoice?.lines?.length
      ? purchaseInvoiceLinesToDraft(invoice.lines)
      : [{ ...EMPTY_PURCHASE_LINE }],
  );
  const { items: lpos } = usePolledList<Lpo>(
    supplierId ? `/lpos?supplierId=${supplierId}&status=sent` : '/lpos?status=sent',
  );

  const payloadLines = purchaseLinePayload(lines);
  const canSave =
    supplierId &&
    payloadLines.length > 0 &&
    payloadLines.every((line) => line.productName.trim() && line.qty > 0);

  const supplierName =
    invoice?.supplier?.name ??
    suppliers.find((item) => item.id === supplierId)?.name ??
    '';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave || saving) return;
    await onSave({
      supplierId,
      lpoId: lpoId || null,
      supplierInvoiceNumber: supplierInvoiceNumber.trim() || null,
      issueDate,
      dueDate: dueDate || null,
      taxInclusive,
      ...discountPayload(documentDiscount),
      lines: payloadLines,
    });
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <p className={styles.formTitle}>
        {editing ? `Edit ${invoice?.number ?? 'purchase invoice'}` : 'New purchase invoice'}
      </p>
      <div className={styles.grid}>
        {editing ? (
          <label className={styles.field}>
            <span className={styles.label}>Supplier</span>
            <input className={styles.input} value={supplierName} readOnly />
          </label>
        ) : (
          <SearchableSelect
            label="Supplier *"
            value={supplierId}
            onChange={(value) => {
              setSupplierId(value);
              setLpoId('');
              setLines([{ ...EMPTY_PURCHASE_LINE }]);
            }}
            required
            placeholder="Search suppliers…"
            options={suppliers
              .filter((item) => item.active)
              .map((item) => ({ id: item.id, label: item.name }))}
          />
        )}
        <SearchableSelect
          label="LPO"
          value={lpoId}
          onChange={setLpoId}
          allowEmpty
          emptyLabel="No LPO"
          disabled={!supplierId}
          placeholder="Search LPOs…"
          options={lpos.map((item) => ({ id: item.id, label: item.number }))}
        />
        <label className={styles.field}>
          <span className={styles.label}>Supplier invoice no.</span>
          <input
            className={styles.input}
            value={supplierInvoiceNumber}
            onChange={(event) => setSupplierInvoiceNumber(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Issue date *</span>
          <input
            className={styles.input}
            type="date"
            required
            value={issueDate}
            onChange={(event) => setIssueDate(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Due date</span>
          <input
            className={styles.input}
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </label>
      </div>
      <label className={styles.label} style={{ marginTop: '0.75rem' }}>
        <input
          type="checkbox"
          checked={taxInclusive}
          onChange={(event) => setTaxInclusive(event.target.checked)}
        />{' '}
        Prices include input VAT
      </label>
      <PurchasingLineEditor
        lines={lines}
        onChange={setLines}
        products={products}
        supplierId={supplierId}
        documentDiscount={documentDiscount}
        onDocumentDiscountChange={setDocumentDiscount}
        taxInclusive={taxInclusive}
        currency={invoice?.currency}
      />
      <div className={styles.actions}>
        <button className={styles.button} disabled={saving || !canSave}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Save draft'}
        </button>
        <button className={styles.ghost} type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function LpoForm({
  suppliers,
  products,
  lpo,
  onSave,
  onCancel,
  saving,
}: {
  suppliers: Supplier[];
  products: Product[];
  lpo?: Lpo;
  onSave: (payload: LpoSavePayload) => void | Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const editing = Boolean(lpo);
  const [supplierId, setSupplierId] = useState(lpo?.supplierId ?? '');
  const [lines, setLines] = useState(() =>
    lpo?.lines?.length ? lpoLinesToDraft(lpo.lines) : [{ ...EMPTY_PURCHASE_LINE }],
  );
  const [documentDiscount, setDocumentDiscount] = useState<DiscountDraft>(() =>
    lpo
      ? discountFromStored(lpo.discountMode, lpo.discountValue)
      : { ...EMPTY_DISCOUNT },
  );
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState(
    dateInputValue(lpo?.requestedDeliveryDate) || dueDateIso(),
  );

  const payloadLines = purchaseLinePayload(lines);
  const canSave =
    supplierId &&
    payloadLines.length > 0 &&
    payloadLines.every((line) => line.productName.trim() && line.qty > 0);

  const supplierName =
    lpo?.supplier?.name ??
    suppliers.find((item) => item.id === supplierId)?.name ??
    '';

  return (
    <div className={styles.form}>
      <h2 className={styles.formTitle}>
        {editing ? `Edit ${lpo?.number ?? 'LPO'}` : 'New LPO'}
      </h2>
      <div className={styles.grid}>
        {editing ? (
          <label className={styles.field}>
            <span className={styles.label}>Supplier</span>
            <input className={styles.input} value={supplierName} readOnly />
          </label>
        ) : (
          <SearchableSelect
            label="Supplier"
            value={supplierId}
            onChange={(value) => {
              setSupplierId(value);
              setLines([{ ...EMPTY_PURCHASE_LINE }]);
            }}
            placeholder="Search suppliers…"
            options={suppliers
              .filter((item) => item.active)
              .map((item) => ({ id: item.id, label: item.name }))}
          />
        )}
        <label className={styles.field}>
          <span className={styles.label}>Requested delivery</span>
          <input
            className={styles.input}
            type="date"
            value={requestedDeliveryDate}
            onChange={(event) => setRequestedDeliveryDate(event.target.value)}
          />
        </label>
      </div>
      <PurchasingLineEditor
        lines={lines}
        onChange={setLines}
        products={products}
        supplierId={supplierId}
        documentDiscount={documentDiscount}
        onDocumentDiscountChange={setDocumentDiscount}
        currency={lpo?.currency}
      />
      <div className={styles.actions}>
        <button
          className={styles.button}
          onClick={() => {
            if (!canSave) return;
            void onSave({
              supplierId,
              requestedDeliveryDate: requestedDeliveryDate || null,
              ...discountPayload(documentDiscount),
              lines: lpoLinePayload(lines),
            });
          }}
          disabled={saving || !canSave}
        >
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Save draft'}
        </button>
        <button className={styles.ghost} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function LpoQuickForm({
  suppliers,
  products,
  onCreate,
  onCancel,
  saving,
}: {
  suppliers: Supplier[];
  products: Product[];
  onCreate: (payload: LpoSavePayload) => void | Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <LpoForm
      suppliers={suppliers}
      products={products}
      onSave={onCreate}
      onCancel={onCancel}
      saving={saving}
    />
  );
}
