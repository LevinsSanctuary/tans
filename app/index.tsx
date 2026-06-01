import { useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
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
import { GameRules } from '@/components/GameRules';
import { HolidaySheet } from '@/components/HolidaySheet';
import { TodoList } from '@/components/TodoList';
import { DeleteTodoSheet } from '@/components/DeleteTodoSheet';
import { DevMenu } from '@/components/DevMenu';
import { getSilhouetteForWeek } from '@/lib/silhouettes';
import { GRADUATION_WEEKS, useHabitStore } from '@/lib/store';
import { useTodoStore } from '@/lib/todoStore';
import { isEvening } from '@/lib/date';
import type { TodoItem } from '@/lib/types';
import { colors, fonts, habitBorders, radius } from '@/constants/theme';

export default function Index() {
  const store = useHabitStore();
  const todo = useTodoStore();
  const [activeTab, setActiveTab] = useState<'today' | 'todo'>('today');
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [fallingPiece, setFallingPiece] = useState<number | null>(null);
  const [missedFor, setMissedFor] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [showPuzzle, setShowPuzzle] = useState(false);
  const [weekDonePrompt, setWeekDonePrompt] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [holidayFor, setHolidayFor] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [deleteTodoTarget, setDeleteTodoTarget] = useState<TodoItem | null>(null);

  const today = store.today;
  const [selectedDay, setSelectedDay] = useState(today);
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

  const completedDaysBool = weekDays.map((day) => store.isDayEarned(day));
  // Stale to-dos subtract from the week's earned pieces (never below zero).
  const rawEarned = completedDaysBool.filter(Boolean).length;
  const earnedPieces = Math.max(0, rawEarned - todo.penaltyPieces);
  const weekComplete = earnedPieces >= 7;
  const weekSilhouette = getSilhouetteForWeek(store.currentWeekStart);
  const puzzleSolved = store.isPuzzleSolved(store.currentWeekStart);
  const todayIdx = weekDays.indexOf(today);

  // The day the habit list reads from / writes to. Falls back to today if
  // a previously-selected day is no longer in the current week.
  const selIdx = weekDays.indexOf(selectedDay);
  const selectedIdx = selIdx >= 0 ? selIdx : todayIdx;
  const activeDay = weekDays[selectedIdx];
  const viewingToday = activeDay === today;

  const closeAddSheet = () => {
    setShowAddSheet(false);
    setWeekDonePrompt(false);
    setNewHabitName('');
  };

  const handleAddHabit = () => {
    if (!newHabitName.trim()) return;
    store.addHabit(newHabitName.trim());
    closeAddSheet();
  };

  const handleEdit = (id: string) => {
    if (!editName.trim()) return;
    store.editHabit(id, editName.trim());
    setEditingId(null);
    setEditName('');
  };

  const selectedLabel = useMemo(() => {
    const d = new Date(activeDay + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, [activeDay]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Fixed header — lives outside the ScrollView so it stays pinned */}
      <View style={styles.header}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.brand}>
            t<Text style={{ color: colors.primary }}>a</Text>n
            <Text style={{ color: colors.accent }}>s</Text>
          </Text>
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>{selectedLabel}</Text>
            {!viewingToday && (
              <Pressable
                onPress={() => setSelectedDay(today)}
                hitSlop={6}
                style={styles.todayBtn}
              >
                <Ionicons
                  name="arrow-back"
                  size={11}
                  color={colors.primaryForeground}
                />
                <Text style={styles.todayBtnText}>Today</Text>
              </Pressable>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.pieceCounter}>
            <Text style={styles.pieceCounterText}>
              {earnedPieces}
              <Text style={{ color: colors.mutedForeground }}>/7 pieces</Text>
            </Text>
          </View>
          <Pressable
            onPress={() => setShowRules(true)}
            hitSlop={8}
            style={styles.infoBtn}
          >
            <Ionicons
              name="help-circle-outline"
              size={24}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
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
                  {todo.penaltyPieces > 0 && (
                    <Text style={styles.penaltyNote}>
                      −{todo.penaltyPieces} from stale to-dos
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <>
                <View style={styles.boardHeader}>
                  <Text style={styles.boardEyebrow}>This week’s puzzle</Text>
                  <Text style={styles.boardSub}>
                    {weekComplete
                      ? 'Ready to assemble'
                      : `${earnedPieces} of 7 · ${
                          store.activeHabits.length > 1
                            ? 'finish all your habits each day'
                            : 'one per day you show up'
                        }`}
                  </Text>
                </View>
                <WeekStrip
                  silhouette={weekSilhouette}
                  completedDays={completedDaysBool}
                  todayIdx={todayIdx}
                  selectedIdx={selectedIdx}
                  onSelectDay={(i) => setSelectedDay(weekDays[i])}
                />
                {todo.penaltyPieces > 0 && (
                  <Text style={[styles.penaltyNote, { paddingHorizontal: 4 }]}>
                    −{todo.penaltyPieces} from stale to-dos
                  </Text>
                )}
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

        {/* Today / To-Do tab toggle */}
        {!isFirstHabit && (
          <View style={styles.tabBar}>
            {(['today', 'todo'] as const).map((tab) => {
              const active = activeTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                >
                  <Text
                    style={[styles.tabBtnText, active && styles.tabBtnTextActive]}
                  >
                    {tab === 'today' ? 'Today' : 'To-Do'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {activeTab === 'todo' && !isFirstHabit && (
          <TodoList todo={todo} onRequestDelete={setDeleteTodoTarget} />
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
        {activeTab === 'today' && (
        <View style={{ gap: 12 }}>
          {store.activeHabits.map((habit, index) => {
            const entry = store.getDayEntry(habit.id, activeDay);
            const completed = entry?.completed ?? false;
            const reflection = entry?.reflection ?? '';
            const borderColor = habitBorders[index % habitBorders.length];
            const missed = store.getMissedDay(habit.id, activeDay);
            const holiday = store.getHabitHolidayInfo(habit);
            const pausedToday = store.isHabitPausedOn(habit, activeDay);
            const slipped = store.habitSlipped(habit);
            const gradWeeks = store.habitGraduationProgress(habit).current;

            return (
              <View
                key={habit.id}
                style={[styles.habitCard, { borderLeftColor: borderColor }]}
              >
                <View style={styles.habitRow}>
                  <Pressable
                    onPress={() => {
                      Keyboard.dismiss();
                      const wasCompleted = completed;
                      store.toggleDay(habit.id, activeDay);
                      if (!wasCompleted) {
                        Haptics.notificationAsync(
                          Haptics.NotificationFeedbackType.Success,
                        );
                        setFallingPiece(selectedIdx);
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
                      <View style={{ flexShrink: 1 }}>
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
                        <Text style={styles.gradProgress}>
                          {gradWeeks >= GRADUATION_WEEKS
                            ? 'Ready to graduate ✦'
                            : `Week ${gradWeeks}/${GRADUATION_WEEKS} kept`}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <Pressable
                          onPress={() =>
                            setHolidayFor({ id: habit.id, name: habit.name })
                          }
                          hitSlop={8}
                          style={styles.iconBtn}
                        >
                          <Ionicons
                            name={holiday ? 'airplane' : 'airplane-outline'}
                            size={14}
                            color={holiday ? colors.primary : colors.mutedForeground}
                          />
                        </Pressable>
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

                {/* Slipped-last-week prompt to drop */}
                {slipped && !holiday && (
                  <View style={styles.slipBanner}>
                    <Text style={styles.slipText}>
                      This one slipped last week. Keep going, or drop it to
                      lighten your load?
                    </Text>
                    <Pressable
                      onPress={() =>
                        Alert.alert(
                          'Drop habit?',
                          `This will remove "${habit.name}" and its history.`,
                          [
                            { text: 'Keep it', style: 'cancel' },
                            {
                              text: 'Drop',
                              style: 'destructive',
                              onPress: () => store.deleteHabit(habit.id),
                            },
                          ],
                        )
                      }
                      hitSlop={6}
                    >
                      <Text style={styles.slipDrop}>Drop</Text>
                    </Pressable>
                  </View>
                )}

                {/* Holiday chip / missed-day chip / reflection */}
                {pausedToday ? (
                  <View style={styles.missedRow}>
                    <Text style={styles.pausedChip}>
                      🏝️ On holiday
                      {holiday
                        ? ` · ${holiday.remaining} ${holiday.remaining === 1 ? 'day' : 'days'} left`
                        : ''}
                    </Text>
                  </View>
                ) : (
                  !completed && (
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
                              {viewingToday
                                ? 'I missed today — be gentle'
                                : 'I missed this day — be gentle'}
                            </Text>
                          </View>
                        </Pressable>
                      )}
                    </View>
                  )
                )}

                {completed && (
                  <View style={styles.reflectionWrap}>
                    <TextInput
                      value={reflection}
                      onChangeText={(t) =>
                        store.setReflection(habit.id, activeDay, t)
                      }
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
        )}

        {/* Why you can't add a new habit yet */}
        {activeTab === 'today' && !isFirstHabit && !store.canAddNewHabit() && (
          <View style={styles.addHint}>
            <Ionicons
              name="lock-closed-outline"
              size={14}
              color={colors.mutedForeground}
            />
            <Text style={styles.addHintText}>{store.addHabitBlockReason()}</Text>
          </View>
        )}

        {/* Permanent habit box */}
        {activeTab === 'today' && store.graduatedHabits.length > 0 && (
          <View style={styles.permanentBox}>
            <Text style={styles.permanentEyebrow}>Permanent habits</Text>
            <Text style={styles.permanentSub}>
              Kept for 9 weeks — now second nature.
            </Text>
            {store.graduatedHabits.map((h) => (
              <View key={h.id} style={styles.permanentRow}>
                <Text style={styles.permanentStar}>✦</Text>
                <Text style={styles.permanentName}>{h.name}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'today' && evening && viewingToday && store.activeHabits.length > 0 && (
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
          date={activeDay}
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
              if (store.canAddNewHabit()) {
                const idea = store.getLatestNextHabitIdea();
                setTimeout(() => {
                  setNewHabitName(idea);
                  setWeekDonePrompt(true);
                  setShowAddSheet(true);
                }, 380);
              }
            }}
            onClose={() => setShowPuzzle(false)}
          />
        )}
      </AnimatePresence>

      {/* Game rules */}
      <AnimatePresence>
        {showRules && <GameRules key="rules" onClose={() => setShowRules(false)} />}
      </AnimatePresence>

      {/* Delete to-do sheet */}
      <AnimatePresence>
        {deleteTodoTarget && (
          <DeleteTodoSheet
            key="delete-todo"
            text={deleteTodoTarget.text}
            onClose={() => setDeleteTodoTarget(null)}
            onConfirm={(reason) => {
              todo.deleteItem(deleteTodoTarget.id, reason);
              setDeleteTodoTarget(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Holiday hold */}
      <AnimatePresence>
        {holidayFor && (
          <HolidaySheet
            key="holiday"
            habitName={holidayFor.name}
            activeRemaining={(() => {
              const h = store.activeHabits.find((x) => x.id === holidayFor.id);
              return h ? store.getHabitHolidayInfo(h)?.remaining : undefined;
            })()}
            onClose={() => setHolidayFor(null)}
            onConfirm={(days) => {
              store.setHabitHoliday(holidayFor.id, days);
              setHolidayFor(null);
            }}
            onResume={() => {
              store.clearHabitHoliday(holidayFor.id);
              setHolidayFor(null);
            }}
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
                onPress={closeAddSheet}
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
                  ◆{' '}
                  {weekDonePrompt
                    ? 'Puzzle complete — what’s next?'
                    : isFirstHabit
                      ? 'Begin Your Tangram'
                      : 'Add a New Habit'}
                </Text>
                {weekDonePrompt && (
                  <Text style={styles.sheetSub}>
                    Your shape is whole — carry the momentum into your next
                    habit.
                  </Text>
                )}
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  dateLabel: { fontSize: 12, color: colors.mutedForeground, fontWeight: '500' },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  todayBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryForeground,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoBtn: { padding: 2 },
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
  penaltyNote: { fontSize: 12, color: 'hsl(5, 60%, 52%)', marginTop: 6 },
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
  nameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  habitName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  gradProgress: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontWeight: '600',
    marginTop: 2,
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
  pausedChip: { fontSize: 12, fontWeight: '600', color: colors.primary },
  slipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    marginLeft: 52,
    backgroundColor: 'hsla(5, 55%, 75%, 0.18)',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  slipText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.foreground },
  slipDrop: { fontSize: 13, fontWeight: '700', color: colors.destructiveForeground },
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

  addHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
  },
  addHintText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.mutedForeground },

  permanentBox: {
    marginTop: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    padding: 16,
  },
  permanentEyebrow: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
    fontWeight: '700',
  },
  permanentSub: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  permanentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  permanentStar: { fontSize: 16, color: colors.success },
  permanentName: { fontSize: 15, fontWeight: '600', color: colors.foreground },

  tabBar: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.muted,
    padding: 4,
    borderRadius: radius.xl,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabBtnText: { fontSize: 14, fontWeight: '700', color: colors.mutedForeground },
  tabBtnTextActive: { color: colors.foreground },

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
  sheetSub: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: -8,
    marginBottom: 16,
    lineHeight: 18,
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
