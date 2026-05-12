import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, fonts, radius } from '@/constants/theme';
import type { EveningCheckIn } from '@/lib/types';

interface Props {
  date: string;
  existing?: EveningCheckIn;
  onSave: (entry: EveningCheckIn) => void;
}

export function EveningCheckInPanel({ date, existing, onSave }: Props) {
  const [score, setScore] = useState(existing?.likelihoodScore ?? 5);
  const [idea, setIdea] = useState(existing?.nextHabitIdea ?? '');
  const [saved, setSaved] = useState(!!existing);

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSave({ date, likelihoodScore: score, nextHabitIdea: idea });
    setSaved(true);
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 280 }}
      style={styles.card}
    >
      <View style={styles.headerRow}>
        <Ionicons name="moon-outline" size={18} color={colors.accent} />
        <Text style={styles.title}>Evening Check-in</Text>
      </View>

      <Text style={styles.label}>How likely will you complete tomorrow’s habit?</Text>
      <View style={styles.scoreRow}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const active = score === n;
          return (
            <Pressable
              key={n}
              onPress={() => {
                setScore(n);
                setSaved(false);
              }}
              style={[styles.scoreChip, active && styles.scoreChipActive]}
              hitSlop={4}
            >
              <Text style={[styles.scoreText, active && styles.scoreTextActive]}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { marginTop: 16 }]}>
        What habit could you add next week?
      </Text>
      <TextInput
        value={idea}
        onChangeText={(t) => {
          setIdea(t);
          setSaved(false);
        }}
        placeholder="e.g. Read for 15 minutes"
        placeholderTextColor={colors.mutedForeground}
        style={styles.input}
      />

      <Pressable
        onPress={handleSave}
        disabled={saved}
        style={({ pressed }) => [
          styles.saveBtn,
          saved && styles.saveBtnDone,
          pressed && !saved && { opacity: 0.85 },
        ]}
      >
        <Text style={[styles.saveText, saved && styles.saveTextDone]}>
          {saved ? '✓ Saved' : 'Save Check-in'}
        </Text>
      </Pressable>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 24,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  title: { fontFamily: fonts.display, fontSize: 17, color: colors.foreground },
  label: { fontSize: 13, fontWeight: '500', color: colors.foreground, marginBottom: 10 },
  scoreRow: { flexDirection: 'row', gap: 4, justifyContent: 'space-between' },
  scoreChip: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreChipActive: { backgroundColor: colors.primary },
  scoreText: { fontSize: 13, fontWeight: '700', color: colors.mutedForeground },
  scoreTextActive: { color: colors.primaryForeground },
  input: {
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.foreground,
  },
  saveBtn: {
    marginTop: 18,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  saveBtnDone: { backgroundColor: 'hsla(150, 40%, 70%, 0.2)' },
  saveText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
  saveTextDone: { color: colors.success },
});
