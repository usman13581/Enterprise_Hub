import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiDelete, apiPost, apiPut } from "../../lib/api";
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledItem,
  usePolledList,
} from "../../lib/useCollection";
import { Pagination, SearchBox, Toast } from "../../components/ListControls";
import {
  ActionButton,
  BalanceCard,
  FilterChips,
  RowActions,
  StatCard,
  StatusPill,
} from "../../components/Finance";
import { day, label, money } from "../../lib/format";
import type { Customer, CustomerHub } from "../../lib/types";
import { colors, ui } from "../../lib/ui";

type Draft = {
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  trn: string;
  notes: string;
};

const EMPTY: Draft = {
  name: "",
  contact: "",
  phone: "",
  email: "",
  address: "",
  trn: "",
  notes: "",
};

export default function CustomersScreen() {
  const { items, loading, error, setError, reload } =
    usePolledList<Customer>("/customers");
  const { flash, notify } = useFlash();
  const [query, setQuery] = useState("");
  const filtered = searchItems(items, query);
  const pager = usePagination(filtered);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hubId, setHubId] = useState<string | null>(null);

  if (hubId) {
    return <CustomerHubScreen customerId={hubId} onBack={() => setHubId(null)} />;
  }

  async function save() {
    if (!draft.name.trim() || saving) return;
    setSaving(true);
    const wasEditing = Boolean(editingId);
    try {
      if (editingId) {
        await apiPut(`/customers/${editingId}`, draft);
      } else {
        await apiPost("/customers", draft);
      }
      setShowForm(false);
      setDraft(EMPTY);
      setEditingId(null);
      await reload();
      notify(wasEditing ? "Customer saved" : "Customer added");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiDelete(`/customers/${id}`);
      await reload();
      notify("Customer deleted", "danger");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content}>
        <Text style={ui.title}>Customers</Text>
        <Text style={ui.lede}>
          Customer records for quotations, jobs, and invoices.
        </Text>

        {error ? <Text style={ui.error}>{error}</Text> : null}

        {showForm ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>
              {editingId ? "Edit customer" : "New customer"}
            </Text>
            <Text style={ui.label}>Name *</Text>
            <TextInput
              style={ui.input}
              value={draft.name}
              onChangeText={(v) => setDraft({ ...draft, name: v })}
            />
            <Text style={ui.label}>Contact person</Text>
            <TextInput
              style={ui.input}
              value={draft.contact}
              onChangeText={(v) => setDraft({ ...draft, contact: v })}
            />
            <Text style={ui.label}>Phone</Text>
            <TextInput
              style={ui.input}
              value={draft.phone}
              keyboardType="phone-pad"
              onChangeText={(v) => setDraft({ ...draft, phone: v })}
            />
            <Text style={ui.label}>Email</Text>
            <TextInput
              style={ui.input}
              value={draft.email}
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={(v) => setDraft({ ...draft, email: v })}
            />
            <Text style={ui.label}>TRN</Text>
            <TextInput
              style={ui.input}
              value={draft.trn}
              onChangeText={(v) => setDraft({ ...draft, trn: v })}
            />
            <Text style={ui.label}>Address</Text>
            <TextInput
              style={ui.input}
              value={draft.address}
              onChangeText={(v) => setDraft({ ...draft, address: v })}
            />
            <Text style={ui.label}>Notes</Text>
            <TextInput
              style={[ui.input, { height: 80 }]}
              value={draft.notes}
              multiline
              onChangeText={(v) => setDraft({ ...draft, notes: v })}
            />
            <View style={ui.cardActions}>
              <Pressable style={ui.button} onPress={() => void save()}>
                <Text style={ui.buttonText}>
                  {saving ? "Saving…" : editingId ? "Save" : "Create"}
                </Text>
              </Pressable>
              <Pressable style={ui.ghost} onPress={() => setShowForm(false)}>
                <Text style={ui.ghostText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={ui.toolbar}>
              <Text style={ui.count}>{items.length} customers</Text>
              <Pressable
                style={ui.button}
                onPress={() => {
                  setDraft(EMPTY);
                  setEditingId(null);
                  setShowForm(true);
                }}
              >
                <Text style={ui.buttonText}>New customer</Text>
              </Pressable>
            </View>

            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Search customers by name, phone, TRN…"
            />

            {loading ? (
              <ActivityIndicator
                color={colors.accent}
                style={{ marginTop: 24 }}
              />
            ) : filtered.length === 0 ? (
              <View style={ui.empty}>
                <Text style={ui.emptyText}>
                  {query
                    ? "No customers match your search."
                    : "No customers yet."}
                </Text>
              </View>
            ) : (
              pager.paged.map((item) => (
                <View key={item.id} style={ui.card}>
                  <Text style={ui.cardTitle}>{item.name}</Text>
                  <Text style={ui.cardMeta}>
                    {[item.contact, item.phone, item.email]
                      .filter(Boolean)
                      .join(" · ") || "No contact details"}
                  </Text>
                  {item.trn ? (
                    <Text style={ui.cardMeta}>TRN {item.trn}</Text>
                  ) : null}
                  <View style={ui.cardActions}>
                    <Pressable
                      style={ui.button}
                      onPress={() => setHubId(item.id)}
                    >
                      <Text style={ui.buttonText}>Open hub</Text>
                    </Pressable>
                    <Pressable
                      style={ui.ghost}
                      onPress={() => {
                        setDraft({
                          name: item.name,
                          contact: item.contact ?? "",
                          phone: item.phone ?? "",
                          email: item.email ?? "",
                          address: item.address ?? "",
                          trn: item.trn ?? "",
                          notes: item.notes ?? "",
                        });
                        setEditingId(item.id);
                        setShowForm(true);
                      }}
                    >
                      <Text style={ui.ghostText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      style={ui.ghost}
                      onPress={() => void remove(item.id)}
                    >
                      <Text style={[ui.ghostText, ui.dangerText]}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}

            <Pagination
              page={pager.page}
              setPage={pager.setPage}
              pageSize={pager.pageSize}
              setPageSize={pager.setPageSize}
              pageCount={pager.pageCount}
              total={pager.total}
            />
          </>
        )}
      </ScrollView>

      <Toast flash={flash} />
    </View>
  );
}

function CustomerHubScreen({
  customerId,
  onBack,
}: {
  customerId: string;
  onBack: () => void;
}) {
  const { item, error, setError, reload } = usePolledItem<CustomerHub>(
    `/customers/${customerId}/hub`,
  );
  const { flash, notify } = useFlash();
  const [tab, setTab] = useState<"jobs" | "quotations" | "invoices" | "advances" | "ledger">(
    "jobs",
  );
  const [showAdvance, setShowAdvance] = useState(false);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  if (!item) {
    return (
      <View style={ui.screen}>
        <ScrollView contentContainerStyle={ui.content}>
          <Pressable onPress={onBack}>
            <Text style={{ color: colors.muted, marginBottom: 8 }}>← Customers</Text>
          </Pressable>
          {error ? (
            <Text style={ui.error}>{error}</Text>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
        </ScrollView>
      </View>
    );
  }

  const { customer, summary, byJob, quotations, jobs, invoices, advances, ledger } =
    item;

  async function recordAdvance() {
    if (saving) return;
    setSaving(true);
    try {
      await apiPost("/advances", {
        customerId: customer.id,
        amount: Number(amount),
        method: "cash",
      });
      setShowAdvance(false);
      setAmount("");
      await reload();
      notify("Advance recorded");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content}>
        <Pressable onPress={onBack}>
          <Text style={{ color: colors.muted, marginBottom: 8 }}>← Customers</Text>
        </Pressable>
        <Text style={ui.title}>{customer.name}</Text>
        <Text style={ui.lede}>
          {[customer.contact, customer.phone, customer.email]
            .filter(Boolean)
            .join(" · ") || "No contact details"}
        </Text>
        {error ? <Text style={ui.error}>{error}</Text> : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <StatCard title="Billed" value={money(summary.billed)} />
          <StatCard
            title="Advances"
            value={money(summary.advancesReceived)}
          />
          <BalanceCard title="Balance due" amount={summary.balanceDue} />
          <StatCard
            title="Unapplied"
            value={money(summary.unallocatedAdvances)}
          />
        </View>

        <RowActions>
          <ActionButton
            label="Record advance"
            tone="primary"
            onPress={() => setShowAdvance(true)}
          />
        </RowActions>

        {showAdvance ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>Record advance</Text>
            <Text style={ui.label}>Amount *</Text>
            <TextInput
              style={ui.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <RowActions>
              <ActionButton
                label={saving ? "Saving…" : "Record"}
                tone="primary"
                disabled={saving}
                onPress={() => void recordAdvance()}
              />
              <ActionButton
                label="Cancel"
                onPress={() => setShowAdvance(false)}
              />
            </RowActions>
          </View>
        ) : null}

        <Text style={[ui.label, { marginTop: 18 }]}>Where the money sits</Text>
        {byJob.map((row) => (
          <View key={row.jobId} style={ui.card}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={ui.cardTitle}>{row.jobNumber}</Text>
              <StatusPill status={row.status} />
            </View>
            <Text style={ui.cardMeta}>
              Value {money(row.jobValue)} · invoiced {money(row.invoiced)} ·
              advances {money(row.advances)}
            </Text>
            <Text style={ui.cardMeta}>Balance {money(row.balance)}</Text>
          </View>
        ))}

        <FilterChips
          active={tab}
          onChange={setTab}
          options={[
            { key: "jobs", label: `Jobs (${jobs.length})` },
            { key: "quotations", label: `Quotations (${quotations.length})` },
            { key: "invoices", label: `Invoices (${invoices.length})` },
            { key: "advances", label: `Advances (${advances.length})` },
            { key: "ledger", label: `Ledger (${ledger.length})` },
          ]}
        />

        {tab === "jobs"
          ? jobs.map((job) => (
              <View key={job.id} style={ui.card}>
                <Text style={ui.cardTitle}>{job.number}</Text>
                <Text style={ui.cardMeta}>
                  {job.title || "No subject"} · {money(job.jobValue)} ·{" "}
                  {day(job.createdAt)}
                </Text>
              </View>
            ))
          : null}

        {tab === "quotations"
          ? quotations.map((quotation) => (
              <View key={quotation.id} style={ui.card}>
                <Text style={ui.cardTitle}>{quotation.number}</Text>
                <Text style={ui.cardMeta}>
                  {quotation.title || "No subject"} · {money(quotation.total)}
                </Text>
                <StatusPill status={quotation.status} />
              </View>
            ))
          : null}

        {tab === "invoices"
          ? invoices.map((invoice) => (
              <View key={invoice.id} style={ui.card}>
                <Text style={ui.cardTitle}>{invoice.number}</Text>
                <Text style={ui.cardMeta}>
                  {label(invoice.kind)} · {day(invoice.issueDate)} ·{" "}
                  {money(invoice.total)}
                </Text>
              </View>
            ))
          : null}

        {tab === "advances"
          ? advances.map((advance) => (
              <View key={advance.id} style={ui.card}>
                <Text style={ui.cardTitle}>{advance.number}</Text>
                <Text style={ui.cardMeta}>
                  {day(advance.receivedAt)} · {money(advance.amount)} · spare{" "}
                  {money(advance.unallocatedAmount)}
                </Text>
              </View>
            ))
          : null}

        {tab === "ledger"
          ? ledger.map((row) => (
              <View key={row.id} style={ui.card}>
                <Text style={ui.cardTitle}>{label(row.entryType)}</Text>
                <Text style={ui.cardMeta}>
                  {day(row.occurredAt)} · {row.direction} {money(row.amount)} ·
                  balance {money(row.runningBalance)}
                </Text>
              </View>
            ))
          : null}
      </ScrollView>
      <Toast flash={flash} />
    </View>
  );
}
