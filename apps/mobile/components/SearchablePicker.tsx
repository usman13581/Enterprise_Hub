import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { searchItems } from '../lib/useCollection';
import { colors } from '../lib/ui';

const DEFAULT_SUGGESTION_LIMIT = 4;

type Option = { id: string; label: string };

function buildSuggestions(
  options: Option[],
  suggestedIds: string[] | undefined,
  value: string,
  limit: number,
): Option[] {
  const byId = new Map(options.map((option) => [option.id, option]));
  const picked: Option[] = [];
  const seen = new Set<string>();

  function add(id: string) {
    if (seen.has(id) || picked.length >= limit) return;
    const option = byId.get(id);
    if (!option) return;
    seen.add(id);
    picked.push(option);
  }

  if (value) add(value);
  for (const id of suggestedIds ?? []) add(id);
  for (const option of [...options].sort((a, b) =>
    a.label.localeCompare(b.label),
  )) {
    add(option.id);
  }

  return picked;
}

export function SearchablePicker({
  value,
  options,
  onChange,
  variant = 'search',
  allowEmpty = false,
  emptyLabel = 'None',
  suggestedIds,
  suggestionLimit = DEFAULT_SUGGESTION_LIMIT,
  searchPlaceholder = 'Search…',
  browseLabel,
  emptyText = 'No matches.',
}: {
  value: string;
  options: Option[];
  onChange: (id: string) => void;
  variant?: 'search' | 'suggest';
  allowEmpty?: boolean;
  emptyLabel?: string;
  suggestedIds?: string[];
  suggestionLimit?: number;
  searchPlaceholder?: string;
  browseLabel?: string;
  emptyText?: string;
}) {
  const [expanded, setExpanded] = useState(variant === 'search');
  const [query, setQuery] = useState('');

  const listOptions = useMemo(() => {
    const entityOptions = options.filter((option) => option.id !== '');
    if (!allowEmpty) return entityOptions;
    return [{ id: '', label: emptyLabel }, ...entityOptions];
  }, [allowEmpty, emptyLabel, options]);

  const suggestions = useMemo(
    () =>
      buildSuggestions(
        listOptions.filter((option) => option.id !== ''),
        suggestedIds,
        value,
        suggestionLimit,
      ),
    [listOptions, suggestedIds, value, suggestionLimit],
  );

  const selected = listOptions.find((option) => option.id === value);
  const filtered = useMemo(
    () => searchItems(listOptions, query),
    [listOptions, query],
  );
  const hiddenCount = Math.max(0, listOptions.length - suggestions.length);
  const chipOptions = useMemo(() => {
    if (!selected?.id || suggestions.some((option) => option.id === selected.id)) {
      return suggestions;
    }
    return [selected, ...suggestions].slice(0, suggestionLimit + 1);
  }, [selected, suggestions, suggestionLimit]);

  function pick(id: string) {
    onChange(id);
    if (variant !== 'search') {
      setExpanded(false);
    }
    setQuery('');
  }

  if (variant === 'search') {
    return (
      <View style={styles.wrap}>
        <View style={styles.panel}>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.soft}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          <ScrollView
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {filtered.length === 0 ? (
              <Text style={styles.empty}>{emptyText}</Text>
            ) : (
              filtered.map((option) => {
                const active = option.id === value;
                return (
                  <Pressable
                    key={option.id || '__empty'}
                    style={({ pressed }) => [
                      styles.row,
                      active && styles.rowActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => pick(option.id)}
                  >
                    <Text
                      style={[styles.rowText, active && styles.rowTextActive]}
                      numberOfLines={2}
                    >
                      {option.label}
                    </Text>
                    {active ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {allowEmpty ? (
          <Pressable
            style={[styles.chip, !value && styles.chipActive]}
            onPress={() => pick('')}
          >
            <Text style={[styles.chipText, !value && styles.chipTextActive]}>
              {emptyLabel}
            </Text>
          </Pressable>
        ) : null}
        {chipOptions.map((option) => {
          const active = option.id === value;
          return (
            <Pressable
              key={option.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => pick(option.id)}
            >
              <Text
                style={[styles.chipText, active && styles.chipTextActive]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={({ pressed }) => [styles.browseBtn, pressed && styles.pressed]}
        onPress={() => setExpanded((open) => !open)}
      >
        <Text style={styles.browseText}>
          {expanded
            ? 'Hide list'
            : browseLabel ??
              (hiddenCount > 0
                ? `Search all (${listOptions.length})`
                : 'Search all')}
        </Text>
      </Pressable>

      {expanded ? (
        <View style={styles.panel}>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.soft}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          <ScrollView
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {filtered.length === 0 ? (
              <Text style={styles.empty}>{emptyText}</Text>
            ) : (
              filtered.map((option) => {
                const active = option.id === value;
                return (
                  <Pressable
                    key={option.id || '__empty'}
                    style={({ pressed }) => [
                      styles.row,
                      active && styles.rowActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => pick(option.id)}
                  >
                    <Text
                      style={[styles.rowText, active && styles.rowTextActive]}
                      numberOfLines={2}
                    >
                      {option.label}
                    </Text>
                    {active ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: '100%',
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  browseBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  browseText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  panel: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  search: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  list: {
    maxHeight: 220,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowActive: {
    backgroundColor: colors.accentSoft,
  },
  rowText: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
  },
  rowTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  check: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  empty: {
    padding: 14,
    color: colors.soft,
    fontSize: 13,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
