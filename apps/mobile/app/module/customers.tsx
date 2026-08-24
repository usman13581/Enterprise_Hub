import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiDelete, apiPost, apiPut } from "../../lib/api";
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledItem,
  usePolledList,
} from "../../lib/useCollection";
import { Pagination, SearchBox, Toast } from "../../components/ListControls";
import { ScreenScroll } from "../../components/ScreenScroll";
import {
  ActionButton,
  BalanceCard,
  FilterChips,
  LinkAction,
  RecordRow,
  RowActions,
  StatCard,
} from "../../components/Finance";
import { AdvanceForm } from "../../components/MoneyForms";
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
  const params = useLocalSearchParams<{ open?: string }>();
  const router = useRouter();
  const { flash, notify } = useFlash();
  const [query, setQuery] = useState("");
  const filtered = searchItems(items, query);
  const pager = usePagination(filtered);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hubId, setHubId] = useState<string | null>(
    typeof params.open === "string" && params.open ? params.open : null,
  );

  useEffect(() => {
    if (typeof params.open === "string" && params.open) {
      setHubId(params.open);
    }
  }, [params.open]);

  if (hubId) {
    return (
      <CustomerHubScreen
        customerId={hubId}
        onBack={() => {
          setHubId(null);
          if (params.open) router.setParams({ open: "" });
        }}
      />
    );
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
      <ScreenScroll>
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
                <RecordRow
                  key={item.id}
                  title={item.name}
                  onPress={() => setHubId(item.id)}
                  meta={[
                    item.contact,
                    item.phone,
                    item.email,
                    item.trn ? `TRN ${item.trn}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No contact details"}
                >
                  <LinkAction
                    label="Open hub"
                    tone="primary"
                    onPress={() => setHubId(item.id)}
                  />
                  <LinkAction
                    label="Edit"
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
                  />
                  <LinkAction
                    label="Delete"
                    tone="danger"
                    onPress={() => void remove(item.id)}
                  />
                </RecordRow>
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
      </ScreenScroll>

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
  const router = useRouter();
  const { item, error, setError, reload } = usePolledItem<CustomerHub>(
    `/customers/${customerId}/hub`,
  );
  const { flash, notify } = useFlash();
  const [tab, setTab] = useState<"jobs" | "quotations" | "invoices" | "advances" | "ledger">(
    "jobs",
  );
  const [showAdvance, setShowAdvance] = useState(false);

  if (!item) {
    return (
      <View style={ui.screen}>
        <ScreenScroll>
          <Pressable onPress={onBack}>
            <Text style={{ color: colors.muted, marginBottom: 8 }}>← Customers</Text>
          </Pressable>
          {error ? (
            <Text style={ui.error}>{error}</Text>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
        </ScreenScroll>
      </View>
    );
  }

  const { customer, summary, byJob, quotations, jobs, invoices, advances, ledger } =
    item;

  return (
    <View style={ui.screen}>
      <ScreenScroll>
        <Pressable onPress={onBack}>
          <Text style={{ color: colors.muted, marginBottom: 8 }}>← Customers</Text>
        </Pressable>
        <Text style={ui.title}>{customer.name}</Text>
        <Text style={ui.lede}>
          {[customer.trn ? `TRN ${customer.trn}` : null, customer.contact, customer.phone, customer.email]
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
          {summary.credited > 0 ? (
            <StatCard title="Credit notes" value={money(summary.credited)} />
          ) : null}
        </View>

        <RowActions>
          <ActionButton
            label="New quotation"
            tone="primary"
            onPress={() => router.push("/module/quotations" as never)}
          />
          <ActionButton
            label="Record advance"
            onPress={() => setShowAdvance(true)}
          />
          <ActionButton
            label="New invoice"
            onPress={() => router.push("/module/invoices" as never)}
          />
        </RowActions>

        {showAdvance ? (
          <AdvanceForm
            customerId={customer.id}
            onSaved={async (message) => {
              setShowAdvance(false);
              await reload();
              notify(message);
            }}
            onError={setError}
            onCancel={() => setShowAdvance(false)}
          />
        ) : null}

        <Text style={[ui.label, { marginTop: 18 }]}>Where the money sits</Text>
        {byJob.map((row) => (
          <RecordRow
            key={row.jobId}
            title={row.jobNumber}
            status={row.status}
            onPress={() =>
              router.push(`/module/jobs?open=${row.jobId}` as never)
            }
            meta={`Value ${money(row.jobValue)} · invoiced ${money(row.invoiced)} · advances ${money(row.advances)} · bal ${money(row.balance)}`}
          />
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
              <RecordRow
                key={job.id}
                title={job.number}
                status={job.status}
                onPress={() =>
                  router.push(`/module/jobs?open=${job.id}` as never)
                }
                meta={[job.title || "No subject", money(job.jobValue), day(job.createdAt)].join(" · ")}
              />
            ))
          : null}

        {tab === "quotations"
          ? quotations.map((quotation) => (
              <RecordRow
                key={quotation.id}
                title={quotation.number}
                status={quotation.status}
                pdfPath={`/documents/quotations/${quotation.id}.pdf`}
                onPdfError={setError}
                meta={[quotation.title || "No subject", money(quotation.total)].join(" · ")}
              />
            ))
          : null}

        {tab === "invoices"
          ? invoices.map((invoice) => (
              <RecordRow
                key={invoice.id}
                title={invoice.number}
                status={invoice.status}
                pdfPath={`/documents/invoices/${invoice.id}.pdf`}
                onPdfError={setError}
                meta={[
                  label(invoice.kind),
                  money(invoice.netPayable),
                  invoice.job ? `Job ${invoice.job.number}` : null,
                  day(invoice.issueDate),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))
          : null}

        {tab === "advances"
          ? advances.map((advance) => (
              <RecordRow
                key={advance.id}
                title={advance.number}
                pdfPath={`/documents/advances/${advance.id}.pdf`}
                onPdfError={setError}
                meta={[
                  label(advance.method),
                  advance.job ? `Job ${advance.job.number}` : null,
                  day(advance.receivedAt),
                  money(advance.amount),
                  `spare ${money(advance.unallocatedAmount)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))
          : null}

        {tab === "ledger"
          ? ledger.map((row) => (
              <RecordRow
                key={row.id}
                title={label(row.entryType)}
                meta={[
                  day(row.occurredAt),
                  `${row.direction} ${money(row.amount)}`,
                  `bal ${money(row.runningBalance)}`,
                  row.memo,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))
          : null}
      </ScreenScroll>
      <Toast flash={flash} />
    </View>
  );
}
