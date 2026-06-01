import { useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { TodoItem, TodoStatus } from '@/lib/types';
import { TODO_STALE_DAYS, useTodoStore } from '@/lib/todoStore';
import { colors, radius } from '@/constants/theme';

const STATUS_LABEL: Record<TodoStatus, string> = {
  open: 'Open',
  started: 'Started',
  completed: 'Completed',
};

// started first, then open, then completed (completed clears at rollover).
const order = (s: TodoStatus) => (s === 'started' ? 0 : s === 'open' ? 1 : 2);

interface Props {
  todo: ReturnType<typeof useTodoStore>;
  // The delete sheet is rendered at the screen root (in app/index.tsx) so its
  // keyboard avoidance works — it can't live inside the ScrollView.
  onRequestDelete: (item: TodoItem) => void;
}

export function TodoList({ todo, onRequestDelete }: Props) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const items = todo.state.items;
  const slots = Array.from({ length: todo.state.slotCount });
  const sorted = [...items].sort((a, b) => order(a.status) - order(b.status));
  const inProgress = items.filter((i) => i.status === 'started').length;

  const commitDraft = (idx: number) => {
    const draft = (drafts[idx] ?? '').trim();
    if (!draft) return;
    todo.addItem(draft);
    setDrafts((d) => ({ ...d, [idx]: '' }));
  };

  const statusIcon = (s: TodoStatus) =>
    s === 'completed' ? 'checkmark' : s === 'started' ? 'play' : 'ellipse-outline';

  const statusBg = (s: TodoStatus) =>
    s === 'completed'
      ? colors.success
      : s === 'started'
        ? colors.brickYellow
        : colors.muted;

  const statusFg = (s: TodoStatus) =>
    s === 'completed' ? colors.successForeground : colors.foreground;

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.headerRow}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.eyebrow}>Today’s five</Text>
          <Text style={styles.sub}>Tap to cycle: Open → Started → Completed</Text>
        </View>
        <Text style={styles.inProgress}>{inProgress} in progress</Text>
      </View>

      {todo.penaltyPieces > 0 && (
        <View style={styles.penaltyBanner}>
          <Ionicons
            name="warning-outline"
            size={16}
            color={colors.destructiveForeground}
          />
          <Text style={styles.penaltyText}>
            Stale items cost you {todo.penaltyPieces} tangram piece
            {todo.penaltyPieces > 1 ? 's' : ''} this week.
          </Text>
        </View>
      )}

      {slots.map((_, idx) => {
        const item = sorted[idx];

        if (!item) {
          return (
            <View key={`slot-${idx}`} style={styles.emptySlot}>
              <View style={styles.slotNum}>
                <Text style={styles.slotNumText}>{idx + 1}</Text>
              </View>
              <TextInput
                value={drafts[idx] ?? ''}
                onChangeText={(t) => setDrafts((d) => ({ ...d, [idx]: t }))}
                onSubmitEditing={() => commitDraft(idx)}
                onEndEditing={() => commitDraft(idx)}
                blurOnSubmit
                placeholder={`Slot ${idx + 1} — what needs doing?`}
                placeholderTextColor={colors.mutedForeground}
                style={styles.slotInput}
              />
            </View>
          );
        }

        const age = todo.staleAgeDays(item);
        const isStale = age >= TODO_STALE_DAYS;
        const isWarning = age >= TODO_STALE_DAYS - 1 && !isStale;
        const completed = item.status === 'completed';

        return (
          <MotiView
            key={item.id}
            from={{ opacity: 0, translateY: 6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 200 }}
            style={[
              styles.itemCard,
              isStale
                ? { borderColor: colors.destructive }
                : isWarning
                  ? { borderColor: colors.brickOrange }
                  : null,
            ]}
          >
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                Haptics.selectionAsync();
                todo.cycleStatus(item.id);
              }}
              style={[styles.statusBtn, { backgroundColor: statusBg(item.status) }]}
            >
              <Ionicons
                name={statusIcon(item.status)}
                size={18}
                color={statusFg(item.status)}
              />
            </Pressable>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={[
                  styles.itemText,
                  completed && {
                    color: colors.mutedForeground,
                    textDecorationLine: 'line-through',
                  },
                ]}
              >
                {item.text}
              </Text>
              <Text style={styles.itemMeta}>
                {STATUS_LABEL[item.status]} ·{' '}
                {age === 0 ? 'today' : `${age}d old`}
                {isStale && ' · stale'}
              </Text>
            </View>

            <Pressable
              onPress={() => onRequestDelete(item)}
              hitSlop={8}
              style={styles.deleteBtn}
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>
          </MotiView>
        );
      })}

      <Text style={styles.footer}>
        Started items roll over so you can finish tomorrow. Completed ones
        disappear at midnight.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
    fontWeight: '700',
  },
  sub: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  inProgress: { fontSize: 12, color: colors.mutedForeground },

  penaltyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'hsla(5, 55%, 75%, 0.18)',
    borderWidth: 1,
    borderColor: 'hsla(5, 55%, 75%, 0.4)',
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  penaltyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.foreground,
  },

  emptySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: 12,
  },
  slotNum: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotNumText: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground },
  slotInput: { flex: 1, fontSize: 14, color: colors.foreground, padding: 0 },

  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
  },
  statusBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  itemMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  deleteBtn: { padding: 6 },

  footer: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingTop: 4,
  },
});
