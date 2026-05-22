import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, fonts, radius } from '@/constants/theme';
import { HOLIDAY_DANGER_DAYS, MAX_HOLIDAY_DAYS } from '@/lib/store';

interface Props {
  habitName: string;
  // Days remaining on an existing hold, if one is already active.
  activeRemaining?: number;
  onClose: () => void;
  onConfirm: (days: number) => void;
  onResume: () => void;
}

export function HolidaySheet({
  habitName,
  activeRemaining,
  onClose,
  onConfirm,
  onResume,
}: Props) {
  const [days, setDays] = useState(3);
  const danger = days >= HOLIDAY_DANGER_DAYS;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ type: 'timing', duration: 180 }}
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </MotiView>

      <View style={styles.wrap} pointerEvents="box-none">
        <MotiView
          from={{ translateY: 600 }}
          animate={{ translateY: 0 }}
          exit={{ translateY: 600 }}
          transition={{ type: 'spring', damping: 22, stiffness: 240 }}
          style={styles.sheet}
        >
          <View style={styles.grabber} />
          <Text style={styles.title}>🏝️ Holiday hold</Text>
          <Text style={styles.sub}>
            Pause counting for{' '}
            <Text style={{ fontWeight: '700' }}>{habitName}</Text> — it won’t
            break while you’re away.
          </Text>

          {activeRemaining != null && (
            <View style={styles.activeBox}>
              <Text style={styles.activeText}>
                On hold · {activeRemaining}{' '}
                {activeRemaining === 1 ? 'day' : 'days'} left
              </Text>
              <Pressable onPress={onResume} hitSlop={6}>
                <Text style={styles.resumeText}>End now</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.label}>How many days?</Text>
          <View style={styles.dayRow}>
            {Array.from({ length: MAX_HOLIDAY_DAYS }, (_, i) => i + 1).map(
              (n) => {
                const active = days === n;
                const isDanger = n >= HOLIDAY_DANGER_DAYS;
                return (
                  <Pressable
                    key={n}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setDays(n);
                    }}
                    style={[
                      styles.dayChip,
                      active && styles.dayChipActive,
                      active && isDanger && styles.dayChipDanger,
                    ]}
                    hitSlop={4}
                  >
                    <Text
                      style={[styles.dayText, active && styles.dayTextActive]}
                    >
                      {n}
                    </Text>
                  </Pressable>
                );
              },
            )}
          </View>

          <View
            style={[styles.note, danger ? styles.noteDanger : styles.noteSafe]}
          >
            <Ionicons
              name={danger ? 'warning-outline' : 'leaf-outline'}
              size={16}
              color={danger ? colors.destructiveForeground : colors.successForeground}
            />
            <Text style={styles.noteText}>
              {danger
                ? 'Danger zone: past 3 days, habits start to slip. Use sparingly.'
                : 'Within the safe range — research suggests up to 3 days is fine.'}
            </Text>
          </View>

          <Pressable
            onPress={() => onConfirm(days)}
            style={({ pressed }) => [styles.confirm, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.confirmText}>
              Hold for {days} {days === 1 ? 'day' : 'days'}
            </Text>
          </Pressable>
        </MotiView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.muted,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.foreground },
  sub: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.mutedForeground,
    marginTop: 6,
  },
  activeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 16,
  },
  activeText: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  resumeText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: 20,
    marginBottom: 10,
  },
  dayRow: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  dayChip: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: { backgroundColor: colors.primary },
  dayChipDanger: { backgroundColor: colors.destructive },
  dayText: { fontSize: 14, fontWeight: '700', color: colors.mutedForeground },
  dayTextActive: { color: colors.primaryForeground },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.lg,
    padding: 12,
    marginTop: 16,
  },
  noteSafe: { backgroundColor: 'hsla(150, 40%, 70%, 0.18)' },
  noteDanger: { backgroundColor: 'hsla(5, 55%, 75%, 0.22)' },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.foreground },
  confirm: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  confirmText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
});
