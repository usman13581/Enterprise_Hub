import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#f4f6f8',
  surface: '#ffffff',
  ink: '#14202b',
  muted: '#5d6b78',
  soft: '#7a8794',
  accent: '#1a6b7a',
  accentSoft: 'rgba(26,107,122,0.1)',
  line: 'rgba(20,32,43,0.08)',
  danger: '#c23b3b',
};

export const ui = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  title: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  lede: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 2,
  },
  count: {
    color: colors.soft,
    fontSize: 13,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  ghost: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(20,32,43,0.14)',
  },
  ghostText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  dangerText: {
    color: colors.danger,
  },
  /** Form / detail cards — keep roomy. List rows use RecordRow instead. */
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginTop: 10,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(20,32,43,0.14)',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.ink,
  },
  error: {
    color: colors.danger,
    marginTop: 12,
    fontSize: 14,
  },
  empty: {
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(20,32,43,0.14)',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.muted,
    textAlign: 'center',
  },
  tag: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600',
    overflow: 'hidden',
  },
});
