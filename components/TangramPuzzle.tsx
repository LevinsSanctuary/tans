import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MotiView } from 'moti';
import Svg, { Polygon } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, fonts, radius } from '@/constants/theme';
import { TANGRAM_COLORS, type Silhouette } from '@/lib/silhouettes';
import {
  getPieceGeometries,
  pointsToString,
  type PieceGeometry,
} from '@/lib/tangramGeometry';

const { width: SCREEN_W } = Dimensions.get('window');
const BOARD_W = SCREEN_W - 32;
const SILHOUETTE_H = Math.min(280, BOARD_W - 16);
const SCATTER_H = 200;
const BOARD_H = 16 + SILHOUETTE_H + 24 + SCATTER_H + 16;
const SNAP_THRESHOLD = 22;

interface PieceLayout {
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  w: number;
  h: number;
}

function computeLayout(geometries: PieceGeometry[]): PieceLayout[] {
  const allX = geometries.flatMap((g) => g.absolute.map((p) => p.x));
  const allY = geometries.flatMap((g) => g.absolute.map((p) => p.y));
  const minX = Math.min(...allX);
  const minY = Math.min(...allY);
  const maxX = Math.max(...allX);
  const maxY = Math.max(...allY);
  const sw = maxX - minX;
  const sh = maxY - minY;
  const scale = Math.min((BOARD_W - 40) / sw, (SILHOUETTE_H - 16) / sh);
  const offsetX = (BOARD_W - sw * scale) / 2 - minX * scale;
  const offsetY = 16 + (SILHOUETTE_H - sh * scale) / 2 - minY * scale;

  const scatterY0 = 16 + SILHOUETTE_H + 24;
  const scatterRowH = SCATTER_H / 2;
  const colW0 = BOARD_W / 4;
  const colW1 = BOARD_W / 3;

  return geometries.map((g, i) => {
    const w = g.bbox.width * scale;
    const h = g.bbox.height * scale;
    const targetX = offsetX + g.bbox.minX * scale;
    const targetY = offsetY + g.bbox.minY * scale;
    let cx: number;
    let cy: number;
    if (i < 4) {
      cx = i * colW0 + colW0 / 2;
      cy = scatterY0 + scatterRowH / 2;
    } else {
      const j = i - 4;
      cx = j * colW1 + colW1 / 2;
      cy = scatterY0 + scatterRowH + scatterRowH / 2;
    }
    return {
      targetX,
      targetY,
      startX: cx - w / 2,
      startY: cy - h / 2,
      w,
      h,
    };
  });
}

interface DraggableProps {
  geometry: PieceGeometry;
  color: string;
  layout: PieceLayout;
  onPlace: () => void;
  onUnplace: () => void;
}

function DraggablePiece({
  geometry,
  color,
  layout,
  onPlace,
  onUnplace,
}: DraggableProps) {
  const tx = useSharedValue(layout.startX);
  const ty = useSharedValue(layout.startY);
  const startTx = useSharedValue(layout.startX);
  const startTy = useSharedValue(layout.startY);
  const placed = useSharedValue(false);

  const gesture = Gesture.Pan()
    .onStart(() => {
      startTx.value = tx.value;
      startTy.value = ty.value;
      if (placed.value) {
        placed.value = false;
        runOnJS(onUnplace)();
      }
    })
    .onUpdate((e) => {
      tx.value = startTx.value + e.translationX;
      ty.value = startTy.value + e.translationY;
    })
    .onEnd(() => {
      const dx = tx.value - layout.targetX;
      const dy = ty.value - layout.targetY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < SNAP_THRESHOLD) {
        tx.value = withSpring(layout.targetX, {
          damping: 18,
          stiffness: 220,
        });
        ty.value = withSpring(layout.targetY, {
          damping: 18,
          stiffness: 220,
        });
        placed.value = true;
        runOnJS(onPlace)();
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.pieceWrap,
          { width: layout.w, height: layout.h },
          animStyle,
        ]}
      >
        <Svg
          width={layout.w}
          height={layout.h}
          viewBox={`0 0 ${geometry.bbox.width} ${geometry.bbox.height}`}
        >
          <Polygon
            points={pointsToString(geometry.normalized)}
            fill={color}
            stroke={colors.foregroundFaint}
            strokeWidth={0.6}
          />
        </Svg>
      </Animated.View>
    </GestureDetector>
  );
}

interface Props {
  silhouette: Silhouette;
  onSolved: () => void;
  onClose: () => void;
}

export function TangramPuzzle({ silhouette, onSolved, onClose }: Props) {
  const geometries = useMemo(
    () => getPieceGeometries(silhouette),
    [silhouette],
  );
  const layout = useMemo(() => computeLayout(geometries), [geometries]);
  const [placed, setPlaced] = useState<boolean[]>(() => Array(7).fill(false));
  const [celebrating, setCelebrating] = useState(false);

  // onSolved is an inline prop (new reference every parent render); keep it
  // in a ref so it can't be an effect dependency and retrigger the timer.
  const onSolvedRef = useRef(onSolved);
  onSolvedRef.current = onSolved;

  const allPlaced = placed.every(Boolean);

  // Latch the celebration once every piece is placed.
  useEffect(() => {
    if (allPlaced) setCelebrating(true);
  }, [allPlaced]);

  // When the celebration latches, fire haptics and hand back to the parent
  // after a beat. Depends only on `celebrating` (which never flips back),
  // so the timer is scheduled exactly once and isn't cancelled by an
  // unrelated re-render.
  useEffect(() => {
    if (!celebrating) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    const t = setTimeout(() => onSolvedRef.current(), 1400);
    return () => clearTimeout(t);
  }, [celebrating]);

  const setPlacedAt = (i: number, v: boolean) =>
    setPlaced((prev) => {
      if (prev[i] === v) return prev;
      const next = [...prev];
      next[i] = v;
      return next;
    });

  const placedCount = placed.filter(Boolean).length;

  return (
    <View style={StyleSheet.absoluteFill}>
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ type: 'timing', duration: 220 }}
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
        pointerEvents="none"
      />

      <MotiView
        from={{ translateY: 800 }}
        animate={{ translateY: 0 }}
        exit={{ translateY: 800 }}
        transition={{ type: 'spring', damping: 22, stiffness: 220 }}
        exitTransition={{ type: 'timing', duration: 260 }}
        style={styles.sheet}
      >
        <View style={styles.grabber} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Seven days. Seven pieces.</Text>
            <Text style={styles.title}>
              Assemble the {silhouette.name.toLowerCase()}
            </Text>
          </View>
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {placedCount}
              <Text style={{ color: colors.mutedForeground }}>/7</Text>
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={[styles.board, { width: BOARD_W, height: BOARD_H }]}>
          {/* Unified silhouette ghost — all pieces drawn as a single faint
              shape (filled, no internal strokes) so only the outer outline
              of the target shape is suggested. */}
          {geometries.map((g, i) => (
            <View
              key={`outline-${i}`}
              style={[
                styles.outline,
                {
                  left: layout[i].targetX,
                  top: layout[i].targetY,
                  width: layout[i].w,
                  height: layout[i].h,
                },
              ]}
              pointerEvents="none"
            >
              <Svg
                width={layout[i].w}
                height={layout[i].h}
                viewBox={`0 0 ${g.bbox.width} ${g.bbox.height}`}
              >
                <Polygon
                  points={pointsToString(g.normalized)}
                  fill={colors.border}
                  stroke="none"
                />
              </Svg>
            </View>
          ))}

          {/* Draggable pieces */}
          {geometries.map((g, i) => (
            <DraggablePiece
              key={`piece-${i}`}
              geometry={g}
              color={TANGRAM_COLORS[i]}
              layout={layout[i]}
              onPlace={() => setPlacedAt(i, true)}
              onUnplace={() => setPlacedAt(i, false)}
            />
          ))}

          {celebrating && (
            <MotiView
              from={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 14, stiffness: 200 }}
              style={styles.checkOverlay}
              pointerEvents="none"
            >
              <View style={styles.checkBubble}>
                <Ionicons
                  name="checkmark"
                  size={48}
                  color={colors.successForeground}
                />
              </View>
            </MotiView>
          )}
        </View>

        <Text style={styles.hint}>
          {celebrating
            ? 'A whole shape, made of seven days.'
            : 'Drag each piece onto its outline.'}
        </Text>
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.muted,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
    fontWeight: '700',
    marginBottom: 2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.foreground,
  },
  counter: {
    backgroundColor: colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.lg,
    marginRight: 8,
  },
  counterText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  board: {
    backgroundColor: 'hsla(36, 40%, 97%, 0.6)',
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    alignSelf: 'center',
  },
  outline: { position: 'absolute' },
  pieceWrap: { position: 'absolute' },
  checkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBubble: {
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  hint: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 12,
    paddingHorizontal: 16,
  },
});
