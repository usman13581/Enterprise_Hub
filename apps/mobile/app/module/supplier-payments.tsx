import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { PurchaseInvoice, Supplier } from '@marble/types';
import { FormField, FormPicker } from '../../components/FormField';
import { FilterChips } from '../../components/Finance';
import { Toast } from '../../components/ListControls';
import { ScreenScroll } from '../../components/ScreenScroll';
import { SearchablePicker } from '../../components/SearchablePicker';
import { apiPost } from '../../lib/api';
import { useFlash, usePolledList } from '../../lib/useCollection';
import { colors, ui } from '../../lib/ui';

export default function SupplierPaymentsScreen() {
  const params = useLocalSearchParams<{ supplierId?: string }>();
  const { items: suppliers } = usePolledList<Supplier>('/suppliers');
  const { items: invoices } = usePolledList<PurchaseInvoice>('/purchase-invoices');
  const { flash, notify } = useFlash();
  const [supplierId, setSupplierId] = useState(params.supplierId ?? '');
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const activeSuppliers = useMemo(
    () =>
      suppliers
        .filter((item) => item.active)
        .map((item) => ({ id: item.id, label: item.name })),
    [suppliers],
  );
  const payables = invoices.filter(
    (invoice) =>
      invoice.supplierId === supplierId &&
      invoice.balance > 0 &&
      ['posted', 'partially_paid'].includes(invoice.status),
  );
  const invoiceOptions = payables.map((item) => ({
    id: item.id,
    label: `${item.number} · balance ${item.balance.toFixed(2)}`,
  }));

  async function submit() {
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
    <View style={ui.screen}>
      <ScreenScroll>
        <Text style={ui.title}>Supplier payments</Text>
        <Text style={ui.lede}>
          Allocate payments to posted supplier bills or leave an amount as a
          supplier advance.
        </Text>
        {error ? <Text style={ui.error}>{error}</Text> : null}

        <View style={ui.card}>
          <Text style={ui.cardTitle}>Record payment</Text>
          <FormPicker label="Supplier" first>
            <SearchablePicker
              value={supplierId}
              options={activeSuppliers}
              searchPlaceholder="Search suppliers…"
              emptyText="No suppliers match your search."
              onChange={(value) => {
                setSupplierId(value);
                setInvoiceId('');
              }}
            />
          </FormPicker>
          <FormPicker label="Allocate to invoice">
            {invoiceOptions.length === 0 ? (
              <Text style={styles.hint}>
                {supplierId
                  ? 'No posted bills with a balance for this supplier.'
                  : 'Select a supplier first.'}
              </Text>
            ) : (
              <SearchablePicker
                value={invoiceId}
                options={invoiceOptions}
                searchPlaceholder="Search invoices…"
                emptyText="No invoices match your search."
                onChange={setInvoiceId}
              />
            )}
          </FormPicker>
          <FormField
            label="Amount"
            required
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
          <FormPicker label="Method">
            <FilterChips
              active={method}
              onChange={setMethod}
              scrollable
              options={[
                { key: 'bank_transfer', label: 'Bank transfer' },
                { key: 'cash', label: 'Cash' },
                { key: 'cheque', label: 'Cheque' },
                { key: 'card', label: 'Card' },
              ]}
            />
          </FormPicker>
          <FormField
            label="Reference"
            value={reference}
            onChangeText={setReference}
            placeholder="Optional"
          />
          <Pressable style={ui.button} onPress={() => void submit()}>
            <Text style={ui.buttonText}>Record payment</Text>
          </Pressable>
        </View>
      </ScreenScroll>
      <Toast flash={flash} />
    </View>
  );
}

const styles = {
  hint: {
    color: colors.soft,
    fontSize: 13,
    lineHeight: 18,
  },
};
