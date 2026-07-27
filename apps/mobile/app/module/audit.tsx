import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import {
  searchItems,
  usePagination,
  usePolledList,
} from "../../lib/useCollection";
import { Pagination, SearchBox } from "../../components/ListControls";
import { RecordRow } from "../../components/Finance";
import { colors, ui } from "../../lib/ui";

type AuditRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
};

export default function AuditScreen() {
  const { items, loading, error } = usePolledList<AuditRow>("/audit");
  const [query, setQuery] = useState("");
  const filtered = searchItems(items, query);
  const pager = usePagination(filtered);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Text style={ui.title}>Audit</Text>
      <Text style={ui.lede}>
        History of creates, updates, and status changes.
      </Text>

      {error ? <Text style={ui.error}>{error}</Text> : null}

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search by action or entity…"
      />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : filtered.length === 0 ? (
        <View style={ui.empty}>
          <Text style={ui.emptyText}>
            {query ? "No entries match your search." : "No audit entries yet."}
          </Text>
        </View>
      ) : (
        pager.paged.map((row) => (
          <RecordRow
            key={row.id}
            title={`${row.action} · ${row.entityType}`}
            meta={new Date(row.createdAt).toLocaleString()}
          />
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
    </ScrollView>
  );
}
