import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '@/constants/theme';

interface Props {
  puzzleSolved: boolean;
  onFillWeek: () => void;
  onClearWeek: () => void;
  onTogglePuzzleSolved: () => void;
  onReset: () => void;
}

export function DevMenu({
  puzzleSolved,
  onFillWeek,
  onClearWeek,
  onTogglePuzzleSolved,
  onReset,
}: Props) {
  const [open, setOpen] = useState(false);
  if (!__DEV__) return null;

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.pill}
        hitSlop={6}
      >
        <Text style={styles.pillText}>🧪 dev</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Dev menu</Text>
        <Pressable onPress={() => setOpen(false)} hitSlop={8}>
          <Ionicons name="close" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <Pressable onPress={onFillWeek} style={styles.btn}>
        <Text style={styles.btnText}>Fill current week</Text>
      </Pressable>
      <Pressable onPress={onClearWeek} style={styles.btn}>
        <Text style={styles.btnText}>Clear current week</Text>
      </Pressable>
      <Pressable onPress={onTogglePuzzleSolved} style={styles.btn}>
        <Text style={styles.btnText}>
          {puzzleSolved ? 'Unmark puzzle solved' : 'Mark puzzle solved'}
        </Text>
      </Pressable>
      <Pressable onPress={onReset} style={[styles.btn, styles.danger]}>
        <Text style={[styles.btnText, styles.dangerText]}>Reset all data</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    backgroundColor: 'hsla(280, 45%, 80%, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    zIndex: 999,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: 0.5,
  },
  panel: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    minWidth: 180,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 999,
    gap: 6,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  panelTitle: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: colors.mutedForeground,
  },
  btn: {
    backgroundColor: colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  btnText: { fontSize: 12, fontWeight: '600', color: colors.foreground },
  danger: { backgroundColor: 'hsla(5, 55%, 75%, 0.2)' },
  dangerText: { color: colors.destructive },
});
