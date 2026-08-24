import { Pressable, Text, View } from 'react-native';
import {
  QUOTATION_LOOKUP_CATEGORY_LABELS,
  type QuotationLookup,
} from '@marble/types';
import { colors, ui } from '../lib/ui';

const attachCategories = ['terms', 'notes', 'bank'] as const;
type AttachCategory = (typeof attachCategories)[number];

const chip = {
  option: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(20,32,43,0.14)',
    backgroundColor: colors.surface,
    marginTop: 8,
  },
  optionActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  optionText: { color: colors.muted, fontSize: 13 },
  optionTextActive: { color: colors.accent, fontWeight: '700' as const },
};

export function LookupAttachPicker({
  items,
  selectedIds,
  onChange,
  emptyMessage = 'No lookup items for this type yet. Add them in the Terms / Notes / Bank tabs.',
}: {
  items: QuotationLookup[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <Text style={ui.cardMeta}>{emptyMessage}</Text>;
  }

  const byCategory: Record<AttachCategory, QuotationLookup[]> = {
    terms: items.filter((row) => row.category === 'terms'),
    notes: items.filter((row) => row.category === 'notes'),
    bank: items.filter((row) => row.category === 'bank'),
  };

  return (
    <View>
      {attachCategories.map((category) => {
        const rows = byCategory[category];
        if (rows.length === 0) return null;
        return (
          <View key={category} style={{ marginTop: 10 }}>
            <Text style={ui.label}>
              {QUOTATION_LOOKUP_CATEGORY_LABELS[category]}
            </Text>
            {rows.map((row) => {
              const on = selectedIds.includes(row.id);
              const preview =
                row.body.length > 120
                  ? `${row.body.slice(0, 120)}…`
                  : row.body;
              return (
                <Pressable
                  key={row.id}
                  style={[chip.option, on && chip.optionActive]}
                  onPress={() =>
                    onChange(
                      on
                        ? selectedIds.filter((id) => id !== row.id)
                        : [...selectedIds, row.id],
                    )
                  }
                >
                  <Text
                    style={on ? chip.optionTextActive : chip.optionText}
                  >
                    {row.title}
                  </Text>
                  {preview ? (
                    <Text style={[ui.cardMeta, { marginTop: 4 }]}>{preview}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
