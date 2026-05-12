import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { AnimatePresence, MotiView } from 'moti';
import { TangramPiece } from './Tangram';
import type { Silhouette } from '@/lib/silhouettes';

interface FallingTangramProps {
  pieceIndex: number;
  silhouette?: Silhouette;
  onComplete: () => void;
}

export function FallingTangram({ pieceIndex, silhouette, onComplete }: FallingTangramProps) {
  useEffect(() => {
    const t = setTimeout(onComplete, 1600);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <AnimatePresence>
        <MotiView
          key="scrim"
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'timing', duration: 250 }}
          style={[StyleSheet.absoluteFill, styles.scrim]}
        />
      </AnimatePresence>
      <View style={styles.center}>
        <MotiView
          from={{ translateY: -400, rotate: '-25deg', scale: 0.7, opacity: 0 }}
          animate={{ translateY: 0, rotate: '0deg', scale: 1, opacity: 1 }}
          transition={{
            type: 'spring',
            damping: 12,
            stiffness: 130,
          }}
        >
          <TangramPiece index={pieceIndex} size={140} silhouette={silhouette} />
        </MotiView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: 'hsla(36, 40%, 97%, 0.7)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
