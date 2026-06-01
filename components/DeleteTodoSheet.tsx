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
import { MotiView } from 'moti';

import { colors, fonts, radius } from '@/constants/theme';
import { TODO_DELETE_MIN_CHARS } from '@/lib/todoStore';

interface Props {
  text: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function DeleteTodoSheet({ text, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const ok = reason.trim().length >= TODO_DELETE_MIN_CHARS;

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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrap}
        pointerEvents="box-none"
      >
        <MotiView
          from={{ translateY: 600 }}
          animate={{ translateY: 0 }}
          exit={{ translateY: 600 }}
          transition={{ type: 'spring', damping: 22, stiffness: 240 }}
          style={styles.sheet}
        >
          <View style={styles.grabber} />
          <Text style={styles.title}>Delete this to-do?</Text>
          <Text style={styles.quote}>“{text}”</Text>
          <Text style={styles.hint}>
            Deletion needs at least {TODO_DELETE_MIN_CHARS} characters of
            reasoning — so you know why future-you let it go.
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={4}
            placeholder="I’m letting this go because…"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            style={styles.input}
          />
          <Text style={[styles.count, ok && { color: colors.success }]}>
            {reason.trim().length}/{TODO_DELETE_MIN_CHARS} characters
          </Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.keepBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.keepText}>Keep it</Text>
            </Pressable>
            <Pressable
              onPress={() => ok && onConfirm(reason.trim())}
              disabled={!ok}
              style={({ pressed }) => [
                styles.deleteBtn,
                !ok && { opacity: 0.4 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        </MotiView>
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
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.foreground },
  quote: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 12,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.mutedForeground,
    marginBottom: 10,
  },
  input: {
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    fontSize: 14,
    color: colors.foreground,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  count: { fontSize: 12, color: colors.mutedForeground, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  keepBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
    alignItems: 'center',
  },
  keepText: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  deleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.destructive,
    alignItems: 'center',
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.destructiveForeground,
  },
});
