import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  apiDelete,
  apiPost,
  apiPut,
  apiUploadImage,
  assetUrl,
} from "../../lib/api";
import {
  searchItems,
  useFlash,
  usePagination,
  usePolledList,
} from "../../lib/useCollection";
import { Pagination, SearchBox, Toast } from "../../components/ListControls";
import { ScreenScroll } from "../../components/ScreenScroll";
import { LinkAction, RecordRow, UploadChip } from "../../components/Finance";
import type { Product, Supplier } from "../../lib/types";
import { colors, ui } from "../../lib/ui";

type Draft = {
  name: string;
  sku: string;
  unit: string;
  purchasePrice: string;
  sellPrice: string;
  supplierId: string;
  description: string;
};

const EMPTY: Draft = {
  name: "",
  sku: "",
  unit: "sqm",
  purchasePrice: "0",
  sellPrice: "0",
  supplierId: "",
  description: "",
};

export default function ProductsScreen() {
  const { items, loading, error, setError, reload } =
    usePolledList<Product>("/products");
  const { items: suppliers } = usePolledList<Supplier>("/suppliers", 10000);
  const { flash, notify } = useFlash();
  const [query, setQuery] = useState("");
  const filtered = searchItems(items, query);
  const pager = usePagination(filtered);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  async function save() {
    if (!draft.name.trim() || saving) return;
    setSaving(true);
    const wasEditing = Boolean(editingId);
    try {
      const payload = {
        name: draft.name,
        sku: draft.sku || null,
        unit: draft.unit,
        purchasePrice: Number(draft.purchasePrice) || 0,
        sellPrice: Number(draft.sellPrice) || 0,
        supplierId: draft.supplierId || null,
        description: draft.description || null,
      };
      if (editingId) {
        await apiPut(`/products/${editingId}`, payload);
      } else {
        await apiPost("/products", payload);
      }
      setShowForm(false);
      setDraft(EMPTY);
      setEditingId(null);
      await reload();
      notify(wasEditing ? "Product saved" : "Product added");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiDelete(`/products/${id}`);
      await reload();
      notify("Product deleted", "danger");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function pickImage(productId: string) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo permission is required to upload product images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploadingFor(productId);
    try {
      const uploaded = await apiUploadImage(result.assets[0].uri, {
        productId,
        purpose: 'product',
      });
      // Offline queue already attaches the image after upload — do not POST a
      // local file:// URL to the API (server rejects non-/static paths).
      if (!uploaded.queued) {
        await apiPost(`/products/${productId}/images`, { url: uploaded.url });
      }
      await reload();
      notify(uploaded.queued ? 'Photo queued for upload' : 'Image uploaded');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingFor(null);
    }
  }

  return (
    <View style={ui.screen}>
      <ScreenScroll>
        <Text style={ui.title}>Products</Text>
        <Text style={ui.lede}>
          Purchase and sell defaults, optional supplier, and multiple photos.
          The default photo prints on PDFs.
        </Text>

        {error ? <Text style={ui.error}>{error}</Text> : null}

        {showForm ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>
              {editingId ? "Edit product" : "New product"}
            </Text>
            <Text style={ui.label}>Name *</Text>
            <TextInput
              style={ui.input}
              value={draft.name}
              onChangeText={(v) => setDraft({ ...draft, name: v })}
            />
            <Text style={ui.label}>SKU</Text>
            <TextInput
              style={ui.input}
              value={draft.sku}
              onChangeText={(v) => setDraft({ ...draft, sku: v })}
            />
            <Text style={ui.label}>Unit</Text>
            <TextInput
              style={ui.input}
              value={draft.unit}
              onChangeText={(v) => setDraft({ ...draft, unit: v })}
            />
            <Text style={ui.label}>Purchase price (AED)</Text>
            <TextInput
              style={ui.input}
              value={draft.purchasePrice}
              keyboardType="decimal-pad"
              onChangeText={(v) => setDraft({ ...draft, purchasePrice: v })}
            />
            <Text style={ui.label}>Sell price (AED)</Text>
            <TextInput
              style={ui.input}
              value={draft.sellPrice}
              keyboardType="decimal-pad"
              onChangeText={(v) => setDraft({ ...draft, sellPrice: v })}
            />
            <Text style={ui.label}>Supplier (optional)</Text>
            <View style={styles.chips}>
              <Pressable
                style={[
                  styles.chip,
                  draft.supplierId === "" && styles.chipActive,
                ]}
                onPress={() => setDraft({ ...draft, supplierId: "" })}
              >
                <Text
                  style={[
                    styles.chipText,
                    draft.supplierId === "" && styles.chipTextActive,
                  ]}
                >
                  None
                </Text>
              </Pressable>
              {suppliers.map((s) => (
                <Pressable
                  key={s.id}
                  style={[
                    styles.chip,
                    draft.supplierId === s.id && styles.chipActive,
                  ]}
                  onPress={() => setDraft({ ...draft, supplierId: s.id })}
                >
                  <Text
                    style={[
                      styles.chipText,
                      draft.supplierId === s.id && styles.chipTextActive,
                    ]}
                  >
                    {s.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={ui.label}>Description</Text>
            <TextInput
              style={[ui.input, { height: 80 }]}
              value={draft.description}
              multiline
              onChangeText={(v) => setDraft({ ...draft, description: v })}
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
              <Text style={ui.count}>{items.length} products</Text>
              <Pressable
                style={ui.button}
                onPress={() => {
                  setDraft(EMPTY);
                  setEditingId(null);
                  setShowForm(true);
                }}
              >
                <Text style={ui.buttonText}>New product</Text>
              </Pressable>
            </View>

            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Search products by name, SKU, supplier…"
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
                    ? "No products match your search."
                    : "No products yet."}
                </Text>
              </View>
            ) : (
              pager.paged.map((item) => (
                <View key={item.id}>
                  <RecordRow
                    title={item.name}
                    meta={[
                      item.sku,
                      `per ${item.unit}`,
                      item.supplier?.name,
                      `buy ${item.purchasePrice.toFixed(2)}`,
                      `sell ${item.sellPrice.toFixed(2)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  >
                    <UploadChip
                      label="Add photo"
                      busy={uploadingFor === item.id}
                      onPress={() => void pickImage(item.id)}
                    />
                    <LinkAction
                      label="Edit"
                      onPress={() => {
                        setDraft({
                          name: item.name,
                          sku: item.sku ?? "",
                          unit: item.unit,
                          purchasePrice: String(item.purchasePrice),
                          sellPrice: String(item.sellPrice),
                          supplierId: item.supplierId ?? "",
                          description: item.description ?? "",
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
                  {item.images.length > 0 ? (
                    <ScrollView
                      horizontal
                      style={styles.imageRow}
                      contentContainerStyle={{ paddingLeft: 4 }}
                    >
                      {item.images.map((img) => (
                        <View key={img.id} style={styles.thumbWrap}>
                          <Image
                            source={{ uri: assetUrl(img.url) }}
                            style={[
                              styles.thumb,
                              img.isDefault && styles.thumbDefault,
                            ]}
                          />
                          {img.isDefault ? (
                            <Text style={styles.defaultLabel}>DEFAULT</Text>
                          ) : (
                            <View style={styles.thumbActions}>
                              <Pressable
                                onPress={async () => {
                                  await apiPut(
                                    `/products/${item.id}/images/${img.id}/default`,
                                  );
                                  await reload();
                                  notify("Default image updated");
                                }}
                              >
                                <Text style={styles.thumbBtn}>Set</Text>
                              </Pressable>
                              <Pressable
                                onPress={async () => {
                                  await apiDelete(
                                    `/products/${item.id}/images/${img.id}`,
                                  );
                                  await reload();
                                  notify("Image removed", "danger");
                                }}
                              >
                                <Text style={[styles.thumbBtn, ui.dangerText]}>
                                  ✕
                                </Text>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      ))}
                    </ScrollView>
                  ) : null}
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
      </ScreenScroll>

      <Toast flash={flash} />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(20,32,43,0.14)",
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.muted,
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.accent,
    fontWeight: "600",
  },
  imageRow: {
    marginTop: 12,
  },
  thumbWrap: {
    marginRight: 10,
    width: 88,
  },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "#eceff2",
  },
  thumbDefault: {
    borderColor: colors.accent,
  },
  defaultLabel: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    color: colors.accent,
    marginTop: 4,
  },
  thumbActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 4,
  },
  thumbBtn: {
    fontSize: 12,
    color: colors.muted,
  },
});
