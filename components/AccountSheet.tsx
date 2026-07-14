import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useUser } from '@clerk/expo';

import { colors, fonts, radius } from '@/constants/theme';

interface Props {
  onClose: () => void;
}

// Account controls (Clerk has no drop-in <UserButton> for React Native).
// Shows the signed-in email and a sign-out action.
export function AccountSheet({ onClose }: Props) {
  const { user } = useUser();
  const { signOut } = useAuth();

  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;

  const onSignOut = async () => {
    onClose();
    await signOut();
  };

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
          from={{ translateY: 500 }}
          animate={{ translateY: 0 }}
          exit={{ translateY: 500 }}
          transition={{ type: 'spring', damping: 24, stiffness: 240 }}
          style={styles.sheet}
        >
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Account</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={22} color={colors.primaryForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.signedInAs}>Signed in as</Text>
              <Text style={styles.email} numberOfLines={1}>
                {email ?? 'your account'}
              </Text>
            </View>
          </View>

          <Pressable onPress={onSignOut} style={styles.signOutBtn}>
            <Ionicons name="log-out-outline" size={18} color={colors.destructiveForeground} />
            <Text style={styles.signOutText}>Sign out</Text>
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
    paddingHorizontal: 24,
    paddingTop: 12,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  eyebrow: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signedInAs: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  email: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.foreground,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.destructive,
    borderRadius: radius.lg,
    paddingVertical: 15,
  },
  signOutText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.destructiveForeground,
  },
});
