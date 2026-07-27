import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { PAGE_SIZES, type Flash } from "../lib/useCollection";
import { colors, ui } from "../lib/ui";

export function Toast({ flash }: { flash: Flash }) {
  if (!flash) return null;
  return (
    <View style={styles.toast} pointerEvents="none">
      <View
        style={[
          styles.toastDot,
          flash.tone === "danger" && styles.toastDotDanger,
        ]}
      />
      <Text style={styles.toastText}>{flash.text}</Text>
    </View>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder = "Search records…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <TextInput
      style={styles.search}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.soft}
      autoCapitalize="none"
      autoCorrect={false}
      clearButtonMode="while-editing"
    />
  );
}

export function Pagination({
  page,
  setPage,
  pageSize,
  setPageSize,
  pageCount,
  total,
}: {
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  pageCount: number;
  total: number;
}) {
  if (total === 0) return null;

  return (
    <View style={styles.pagination}>
      <Text style={ui.count}>
        Page {page} of {pageCount} · {total} records
      </Text>
      <View style={styles.sizeRow}>
        <Text style={ui.count}>Rows</Text>
        {PAGE_SIZES.map((size) => (
          <Pressable
            key={size}
            style={[styles.size, pageSize === size && styles.sizeActive]}
            onPress={() => setPageSize(size)}
          >
            <Text
              style={[
                styles.sizeText,
                pageSize === size && styles.sizeTextActive,
              ]}
            >
              {size}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.buttons}>
        <Pressable
          style={[ui.ghost, page <= 1 && styles.disabled]}
          disabled={page <= 1}
          onPress={() => setPage(page - 1)}
        >
          <Text style={ui.ghostText}>‹ Previous</Text>
        </Pressable>
        <Pressable
          style={[ui.ghost, page >= pageCount && styles.disabled]}
          disabled={page >= pageCount}
          onPress={() => setPage(page + 1)}
        >
          <Text style={ui.ghostText}>Next ›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    shadowColor: "#14202b",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  toastDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#4ade80",
  },
  toastDotDanger: {
    backgroundColor: "#fca5a5",
  },
  toastText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    flexShrink: 1,
  },
  search: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(20,32,43,0.14)",
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: colors.ink,
    fontSize: 15,
  },
  pagination: {
    marginTop: 18,
    gap: 12,
  },
  sizeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  size: {
    minWidth: 34,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(20,32,43,0.14)",
    alignItems: "center",
  },
  sizeActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  sizeText: {
    color: colors.muted,
    fontSize: 12,
  },
  sizeTextActive: {
    color: colors.accent,
    fontWeight: "700",
  },
  buttons: {
    flexDirection: "row",
    gap: 8,
  },
  disabled: {
    opacity: 0.4,
  },
});
