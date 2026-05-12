import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatePresence, MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Tangram } from '@/components/Tangram';
import { FallingTangram } from '@/components/FallingTangram';
import { EveningCheckInPanel } from '@/components/EveningCheckIn';
import { MissedDaySheet } from '@/components/MissedDaySheet';
import { TangramPuzzle } from '@/components/TangramPuzzle';
import { WeekStrip } from '@/components/WeekStrip';
import { DevMenu } from '@/components/DevMenu';
import { getSilhouetteForWeek } from '@/lib/silhouettes';
import { useHabitStore } from '@/lib/store';
import { isEvening } from '@/lib/date';
import { colors, fonts, habitBorders, radius } from '@/constants/theme';

export default function Index() {
  const store = useHabitStore();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [fallingPiece, setFallingPiece] = useState<number | null>(null);
  const [missedFor, setMissedFor] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [showPuzzle, setShowPuzzle] = useState(false);

  const today = store.today;
  const isFirstHabit = store.activeHabits.length === 0;
  const evening = isEvening();

  const weekDays = useMemo(() => {
    const days: string[] = [];
    const d = new Date(store.currentWeekStart + 'T00:00:00');
    for (let i = 0; i < 7; i++) {
      days.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      );
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [store.currentWeekStart]);

  const completedDaysBool = weekDays.map(
    (day) =>
      store.activeHabits.length > 0 &&
      store.activeHabits.every(
        (h) => store.getDayEntry(h.id, day)?.completed,
      ),
  );
  const earnedPieces = completedDaysBool.filter(Boolean).length;
  const weekComplete = earnedPieces >= 7;
  const weekSilhouette = getSilhouetteForWeek(store.currentWeekStart);
  const puzzleSolved = store.isPuzzleSolved(store.currentWeekStart);
  const todayIdx = weekDays.indexOf(today);

  const handleAddHabit = () => {
    if (!newHabitName.trim()) return;
    store.addHabit(newHabitName.trim());
    setNewHabitName('');
    setShowAddSheet(false);
  };

  const handleEdit = (id: string) => {
    if (!editName.trim()) return;
    store.editHabit(id, editName.trim());
    setEditingId(null);
    setEditName('');
  };

  const todayLabel = useMemo(() => {
    const d = new Date(today + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, [today]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>
              t<Text style={{ color: colors.primary }}>a</Text>n
              <Text style={{ color: colors.accent }}>s</Text>
            </Text>
            <Text style={styles.dateLabel}>{todayLabel}</Text>
          </View>
          <View style={styles.pieceCounter}>
            <Text style={styles.pieceCounterText}>
              {earnedPieces}
              <Text style={{ color: colors.mutedForeground }}>/7 pieces</Text>
            </Text>
          </View>
        </View>

        {/* Tangram board */}
        {!isFirstHabit && (
          <View style={styles.boardCard}>
            {puzzleSolved ? (
              <View style={styles.solvedRow}>
                <Tangram earned={7} size={96} silhouette={weekSilhouette} />
                <View style={{ flex: 1, marginLeft: 20 }}>
                  <Text style={styles.boardEyebrow}>This week’s puzzle</Text>
                  <Text style={styles.boardTitle}>{weekSilhouette.name}</Text>
                  <View style={styles.completeBadge}>
                    <Ionicons
                      name="checkmark"
                      size={12}
                      color={colors.successForeground}
                    />
                    <Text style={styles.completeBadgeText}>Assembled</Text>
                  </View>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.boardHeader}>
                  <Text style={styles.boardEyebrow}>This week’s puzzle</Text>
                  <Text style={styles.boardSub}>
                    {weekComplete
                      ? 'Ready to assemble'
                      : `${earnedPieces} of 7 · one per day you show up`}
                  </Text>
                </View>
                <WeekStrip
                  silhouette={weekSilhouette}
                  completedDays={completedDaysBool}
                  todayIdx={todayIdx}
                />
                {weekComplete && (
                  <Pressable
                    onPress={() => setShowPuzzle(true)}
                    style={({ pressed }) => [
                      styles.assembleBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.assembleBtnText}>
                      ◆ Assemble the puzzle
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}

        {/* Empty state */}
        {isFirstHabit && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Begin Your Tangram</Text>
            <Text style={styles.emptySub}>
              Each habit you keep becomes a piece. Seven pieces, one shape.
            </Text>
            <Pressable
              onPress={() => setShowAddSheet(true)}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.primaryBtnText}>+ Add First Habit</Text>
            </Pressable>
          </View>
        )}

        {/* Today's habits */}
        <View style={{ gap: 12 }}>
          {store.activeHabits.map((habit, index) => {
            const entry = store.getDayEntry(habit.id, today);
            const completed = entry?.completed ?? false;
            const reflection = entry?.reflection ?? '';
            const borderColor = habitBorders[index % habitBorders.length];
            const missed = store.getMissedDay(habit.id, today);

            return (
              <View
                key={habit.id}
                style={[styles.habitCard, { borderLeftColor: borderColor }]}
              >
                <View style={styles.habitRow}>
                  <Pressable
                    onPress={() => {
                      const wasCompleted = completed;
                      store.toggleDay(habit.id, today);
                      if (!wasCompleted) {
                        Haptics.notificationAsync(
                          Haptics.NotificationFeedbackType.Success,
                        );
                        const todayIdx = weekDays.indexOf(today);
                        setFallingPiece(todayIdx >= 0 ? todayIdx : 0);
                      }
                    }}
                    style={[
                      styles.checkBtn,
                      completed && { backgroundColor: colors.success },
                    ]}
                  >
                    {completed && (
                      <Ionicons name="checkmark" size={22} color={colors.successForeground} />
                    )}
                  </Pressable>

                  {editingId === habit.id ? (
                    <View style={styles.editRow}>
                      <TextInput
                        value={editName}
                        onChangeText={setEditName}
                        onSubmitEditing={() => handleEdit(habit.id)}
                        autoFocus
                        style={styles.editInput}
                      />
                      <Pressable onPress={() => handleEdit(habit.id)} hitSlop={8}>
                        <Ionicons name="checkmark" size={20} color={colors.success} />
                      </Pressable>
                      <Pressable onPress={() => setEditingId(null)} hitSlop={8}>
                        <Ionicons name="close" size={20} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.nameRow}>
                      <Text
                        style={[
                          styles.habitName,
                          completed && {
                            color: colors.mutedForeground,
                            textDecorationLine: 'line-through',
                          },
                        ]}
                      >
                        {habit.name}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <Pressable
                          onPress={() => {
                            setEditingId(habit.id);
                            setEditName(habit.name);
                          }}
                          hitSlop={8}
                          style={styles.iconBtn}
                        >
                          <Ionicons
                            name="pencil-outline"
                            size={14}
                            color={colors.mutedForeground}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            Alert.alert(
                              'Delete habit?',
                              `This will remove "${habit.name}" and its history.`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Delete',
                                  style: 'destructive',
                                  onPress: () => store.deleteHabit(habit.id),
                                },
                              ],
                            )
                          }
                          hitSlop={8}
                          style={styles.iconBtn}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={14}
                            color={colors.mutedForeground}
                          />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>

                {/* Missed-day chip / reflection */}
                {!completed && (
                  <View style={styles.missedRow}>
                    {missed ? (
                      <Text style={styles.missedLogged}>
                        {missed.kind === 'badge'
                          ? `Logged: ${missed.badge?.replace('-', ' ')} 🌱`
                          : `Small win: "${missed.achievement}"`}
                      </Text>
                    ) : (
                      <Pressable
                        onPress={() =>
                          setMissedFor({ id: habit.id, name: habit.name })
                        }
                        hitSlop={6}
                      >
                        <View style={styles.missedTrigger}>
                          <Ionicons
                            name="cloud-offline-outline"
                            size={14}
                            color={colors.mutedForeground}
                          />
                          <Text style={styles.missedTriggerText}>
                            I missed today — be gentle
                          </Text>
                        </View>
                      </Pressable>
                    )}
                  </View>
                )}

                {completed && (
                  <View style={styles.reflectionWrap}>
                    <TextInput
                      value={reflection}
                      onChangeText={(t) => store.setReflection(habit.id, today, t)}
                      maxLength={200}
                      placeholder="How are you doing? (optional)"
                      placeholderTextColor={colors.mutedForeground}
                      multiline
                      style={styles.reflection}
                    />
                    <Text style={styles.reflectionCount}>{reflection.length}/200</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {evening && store.activeHabits.length > 0 && (
          <EveningCheckInPanel
            date={today}
            existing={store.getEveningCheckIn(today)}
            onSave={store.saveEveningCheckIn}
          />
        )}

        <View style={{ height: 96 }} />
      </ScrollView>

      {/* FAB */}
      {!isFirstHabit && store.canAddNewHabit() && (
        <Pressable
          onPress={() => setShowAddSheet(true)}
          style={({ pressed }) => [
            styles.fab,
            pressed && { transform: [{ scale: 0.92 }] },
          ]}
        >
          <Ionicons name="add" size={28} color={colors.primaryForeground} />
        </Pressable>
      )}

      {/* Falling tangram piece overlay */}
      <AnimatePresence>
        {fallingPiece !== null && (
          <FallingTangram
            pieceIndex={fallingPiece}
            silhouette={weekSilhouette}
            onComplete={() => setFallingPiece(null)}
          />
        )}
      </AnimatePresence>

      {/* Missed day sheet */}
      {missedFor && (
        <MissedDaySheet
          habitName={missedFor.name}
          habitId={missedFor.id}
          date={today}
          onClose={() => setMissedFor(null)}
          onSave={(entry) => {
            store.saveMissedDay(entry);
            setMissedFor(null);
          }}
        />
      )}

      {/* Assembly puzzle */}
      <AnimatePresence>
        {showPuzzle && (
          <TangramPuzzle
            key="puzzle"
            silhouette={weekSilhouette}
            onSolved={() => {
              store.markPuzzleSolved(store.currentWeekStart);
              setShowPuzzle(false);
            }}
            onClose={() => setShowPuzzle(false)}
          />
        )}
      </AnimatePresence>

      <DevMenu
        puzzleSolved={puzzleSolved}
        onFillWeek={store.devFillWeek}
        onClearWeek={store.devClearWeek}
        onTogglePuzzleSolved={store.devTogglePuzzleSolved}
        onReset={store.devResetAll}
      />

      {/* Add habit bottom sheet */}
      <AnimatePresence>
        {showAddSheet && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <MotiView
              key="add-scrim"
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: 180 }}
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
            >
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setShowAddSheet(false)}
              />
            </MotiView>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.sheetWrap}
              pointerEvents="box-none"
            >
              <MotiView
                key="add-sheet"
                from={{ translateY: 600 }}
                animate={{ translateY: 0 }}
                exit={{ translateY: 600 }}
                transition={{ type: 'spring', damping: 22, stiffness: 240 }}
                style={styles.sheet}
              >
                <View style={styles.grabber} />
                <Text style={styles.sheetTitle}>
                  ◆ {isFirstHabit ? 'Begin Your Tangram' : 'Add a New Habit'}
                </Text>
                <TextInput
                  value={newHabitName}
                  onChangeText={setNewHabitName}
                  onSubmitEditing={handleAddHabit}
                  placeholder="e.g. Meditate for 5 minutes"
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus
                  style={styles.sheetInput}
                />
                <Pressable
                  onPress={handleAddHabit}
                  disabled={!newHabitName.trim()}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { marginTop: 8 },
                    !newHabitName.trim() && { opacity: 0.5 },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.primaryBtnText}>Add piece ◆</Text>
                </Pressable>
              </MotiView>
            </KeyboardAvoidingView>
          </View>
        )}
      </AnimatePresence>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  dateLabel: { fontSize: 12, color: colors.mutedForeground, fontWeight: '500', marginTop: 2 },
  pieceCounter: {
    backgroundColor: colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.lg,
  },
  pieceCounterText: { fontSize: 14, fontWeight: '700', color: colors.foreground },

  boardCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    padding: 16,
    marginBottom: 24,
  },
  boardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  boardEyebrow: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
    fontWeight: '700',
  },
  boardTitle: { fontSize: 16, fontFamily: fonts.display, color: colors.foreground },
  boardSub: { fontSize: 12, color: colors.mutedForeground },
  solvedRow: { flexDirection: 'row', alignItems: 'center' },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.success,
    borderRadius: 999,
  },
  completeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.successForeground,
  },
  assembleBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  assembleBtnText: {
    color: colors.primaryForeground,
    fontWeight: '700',
    fontSize: 14,
  },

  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.foreground,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 24,
  },

  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.primaryForeground,
    fontWeight: '700',
    fontSize: 14,
  },

  habitCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
  },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  habitName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    flexShrink: 1,
  },
  editRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  editInput: {
    flex: 1,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.foreground,
  },
  iconBtn: { padding: 6 },

  missedRow: { marginTop: 12, paddingLeft: 52 },
  missedLogged: { fontSize: 12, color: colors.mutedForeground, fontStyle: 'italic' },
  missedTrigger: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  missedTriggerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
  },

  reflectionWrap: { marginTop: 12, paddingLeft: 52 },
  reflection: {
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    fontSize: 14,
    color: colors.foreground,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  reflectionCount: { fontSize: 11, color: colors.mutedForeground, marginTop: 4 },

  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
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
    marginBottom: 24,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.foreground,
    marginBottom: 16,
  },
  sheetInput: {
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 14,
    fontSize: 15,
    color: colors.foreground,
    marginBottom: 16,
  },
});
