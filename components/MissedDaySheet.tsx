import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AnimatePresence, MotiView } from 'moti';

import { colors, fonts, radius } from '@/constants/theme';
import type { MissedBadge, MissedDay } from '@/lib/types';

interface Props {
  habitName: string;
  habitId: string;
  date: string;
  onSave: (entry: MissedDay) => void;
  onClose: () => void;
}

const BADGES: { id: MissedBadge; label: string; emoji: string }[] = [
  { id: 'rest',        label: 'Needed rest',      emoji: '🌙' },
  { id: 'overwhelmed', label: 'Overwhelmed',      emoji: '🌊' },
  { id: 'forgot',      label: 'Slipped my mind',  emoji: '🍃' },
  { id: 'unwell',      label: 'Not feeling well', emoji: '🌷' },
  { id: 'busy',        label: 'Day got full',     emoji: '⏳' },
  { id: 'low-energy',  label: 'Low energy',       emoji: '☁️' },
];

export function MissedDaySheet({ habitName, habitId, date, onSave, onClose }: Props) {
  const [mode, setMode] = useState<'badge' | 'achievement'>('badge');
  const [badge, setBadge] = useState<MissedBadge | null>(null);
  const [achievement, setAchievement] = useState('');

  const canSave =
    mode === 'badge' ? !!badge : achievement.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      date,
      habitId,
      kind: mode,
      badge: mode === 'badge' ? badge ?? undefined : undefined,
      achievement: mode === 'achievement' ? achievement.trim() : undefined,
    });
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <AnimatePresence>
        <MotiView
          key="missed-scrim"
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'timing', duration: 180 }}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </MotiView>
      </AnimatePresence>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrap}
        pointerEvents="box-none"
      >
        <AnimatePresence>
          <MotiView
            key="missed-sheet"
            from={{ translateY: 600 }}
            animate={{ translateY: 0 }}
            exit={{ translateY: 600 }}
            transition={{ type: 'spring', damping: 22, stiffness: 240 }}
            style={styles.sheet}
          >
            <View style={styles.grabber} />
            <Text style={styles.title}>A skipped day is part of the practice.</Text>
            <Text style={styles.sub}>
              Take a soft moment with{' '}
              <Text style={styles.subBold}>{habitName}</Text>. No streak lost.
            </Text>

            <View style={styles.tabs}>
              <Pressable
                onPress={() => setMode('badge')}
                style={[styles.tab, mode === 'badge' && styles.tabActive]}
              >
                <Text style={[styles.tabText, mode === 'badge' && styles.tabTextActive]}>
                  Why today?
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode('achievement')}
                style={[styles.tab, mode === 'achievement' && styles.tabActive]}
              >
                <Text style={[styles.tabText, mode === 'achievement' && styles.tabTextActive]}>
                  A small win instead
                </Text>
              </Pressable>
            </View>

            {mode === 'badge' ? (
              <View style={styles.badgeGrid}>
                {BADGES.map((b) => {
                  const active = badge === b.id;
                  return (
                    <Pressable
                      key={b.id}
                      onPress={() => setBadge(b.id)}
                      style={[styles.badge, active && styles.badgeActive]}
                    >
                      <Text style={styles.badgeEmoji}>{b.emoji}</Text>
                      <Text style={[styles.badgeLabel, active && styles.badgeLabelActive]}>
                        {b.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={{ marginBottom: 20 }}>
                <TextInput
                  value={achievement}
                  onChangeText={(t) => setAchievement(t.slice(0, 160))}
                  placeholder="Something kind you did for yourself today…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  autoFocus
                  style={styles.achievementInput}
                />
                <Text style={styles.counter}>{achievement.length}/160</Text>
              </View>
            )}

            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={({ pressed }) => [
                styles.saveBtn,
                !canSave && { opacity: 0.4 },
                pressed && canSave && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.saveText}>Be gentle, save it</Text>
            </Pressable>
          </MotiView>
        </AnimatePresence>
      </KeyboardAvoidingView>
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
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.foreground,
    marginBottom: 4,
  },
  sub: { fontSize: 13, color: colors.mutedForeground, marginBottom: 20 },
  subBold: { fontWeight: '600', color: colors.foreground },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center' },
  tabActive: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground },
  tabTextActive: { color: colors.foreground },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  badge: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'hsla(230, 25%, 94%, 0.4)',
  },
  badgeActive: {
    borderColor: colors.primary,
    backgroundColor: 'hsla(340, 55%, 75%, 0.15)',
  },
  badgeEmoji: { fontSize: 18 },
  badgeLabel: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground },
  badgeLabelActive: { color: colors.foreground },

  achievementInput: {
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 14,
    fontSize: 14,
    color: colors.foreground,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  counter: { fontSize: 11, color: colors.mutedForeground, marginTop: 4 },

  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  saveText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
});
