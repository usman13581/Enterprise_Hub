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
  usePolledList,
} from "../../lib/useCollection";
import { Pagination, SearchBox, Toast } from "../../components/ListControls";
import type { Supplier } from "../../lib/types";
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

export default function SuppliersScreen() {
  const { items, loading, error, setError, reload } =
    usePolledList<Supplier>("/suppliers");
  const { flash, notify } = useFlash();
  const [query, setQuery] = useState("");
  const filtered = searchItems(items, query);
  const pager = usePagination(filtered);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!draft.name.trim() || saving) return;
    setSaving(true);
    const wasEditing = Boolean(editingId);
    try {
      if (editingId) {
        await apiPut(`/suppliers/${editingId}`, draft);
      } else {
        await apiPost("/suppliers", draft);
      }
      setShowForm(false);
      setDraft(EMPTY);
      setEditingId(null);
      await reload();
      notify(wasEditing ? "Supplier saved" : "Supplier added");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiDelete(`/suppliers/${id}`);
      await reload();
      notify("Supplier deleted", "danger");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content}>
        <Text style={ui.title}>Suppliers</Text>
        <Text style={ui.lede}>
          Supplier directory. Products can optionally be tagged to a supplier.
        </Text>

        {error ? <Text style={ui.error}>{error}</Text> : null}

        {showForm ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>
              {editingId ? "Edit supplier" : "New supplier"}
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
              <Text style={ui.count}>{items.length} suppliers</Text>
              <Pressable
                style={ui.button}
                onPress={() => {
                  setDraft(EMPTY);
                  setEditingId(null);
                  setShowForm(true);
                }}
              >
                <Text style={ui.buttonText}>New supplier</Text>
              </Pressable>
            </View>

            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Search suppliers by name, contact, phone…"
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
                    ? "No suppliers match your search."
                    : "No suppliers yet."}
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
                  <Text style={ui.tag}>
                    {item._count?.products ?? 0} products
                  </Text>
                  <View style={ui.cardActions}>
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
