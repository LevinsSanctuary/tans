import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts, radius } from '@/constants/theme';

interface Props {
  onClose: () => void;
}

const RULES: { icon: string; title: string; body: string }[] = [
  {
    icon: '🧩',
    title: 'One shape a week',
    body: 'Every day you keep your habits, you earn one of seven tangram pieces. Seven days assembles the week’s silhouette.',
  },
  {
    icon: '◆',
    title: 'All or nothing',
    body: 'With two or more habits, a day only counts when you finish all of them. If you can’t hold them all, that’s your sign to carry fewer next week.',
  },
  {
    icon: '➕',
    title: 'Earn your next habit',
    body: 'Add at most one new habit per week, and only after completing a full week. You can stack three habits at a time — no more.',
  },
  {
    icon: '🌱',
    title: 'Graduation',
    body: 'Keep a habit for 9 straight weeks (63 days) and it becomes second nature: it leaves the board for your Permanent Habits, freeing a slot. With three habits kept, the first won’t graduate until its own week 9.',
  },
  {
    icon: '🏝️',
    title: 'Holiday hold',
    body: 'Going away? Put a habit on hold for up to 7 days and it won’t break. Research points to ~3 days as the safe limit — 4 to 7 days is the danger zone where habits start to slip.',
  },
  {
    icon: '💛',
    title: 'Be gentle',
    body: 'Missed a day? Log a small win instead. Slip a whole week and tans will gently ask whether you’d like to drop that habit to lighten the load.',
  },
];

export function GameRules({ onClose }: Props) {
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
          from={{ translateY: 700 }}
          animate={{ translateY: 0 }}
          exit={{ translateY: 700 }}
          transition={{ type: 'spring', damping: 24, stiffness: 240 }}
          style={styles.sheet}
        >
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.eyebrow}>The rules of the game</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <Text style={styles.title}>How tans works</Text>

          <ScrollView
            style={{ marginTop: 8 }}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {RULES.map((r) => (
              <View key={r.title} style={styles.ruleRow}>
                <Text style={styles.ruleIcon}>{r.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleTitle}>{r.title}</Text>
                  <Text style={styles.ruleBody}>{r.body}</Text>
                </View>
              </View>
            ))}

            <View style={styles.goal}>
              <Text style={styles.goalText}>
                tans isn’t about chasing streaks. It’s about building a few
                habits so deeply they no longer need tracking.
              </Text>
            </View>
          </ScrollView>
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
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: colors.border,
    maxHeight: '88%',
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.muted,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
    fontWeight: '700',
  },
  closeBtn: { padding: 2 },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.foreground,
    marginTop: 4,
  },
  ruleRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 20,
    alignItems: 'flex-start',
  },
  ruleIcon: { fontSize: 22, width: 28, textAlign: 'center', marginTop: 2 },
  ruleTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.foreground,
    marginBottom: 3,
  },
  ruleBody: { fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  goal: {
    marginTop: 28,
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    padding: 16,
  },
  goalText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.foreground,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
