import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { colors, fonts, radius } from '@/constants/theme';
import { TANGRAM_COLORS, type Silhouette } from '@/lib/silhouettes';
import { getPieceGeometries, pointsToString } from '@/lib/tangramGeometry';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const CELL_PIECE_SIZE = 32;

interface Props {
  silhouette: Silhouette;
  completedDays: boolean[]; // length 7, Mon..Sun
  todayIdx: number;
  selectedIdx: number;
  onSelectDay: (idx: number) => void;
}

export function WeekStrip({
  silhouette,
  completedDays,
  todayIdx,
  selectedIdx,
  onSelectDay,
}: Props) {
  const geometries = useMemo(
    () => getPieceGeometries(silhouette),
    [silhouette],
  );

  return (
    <View style={styles.row}>
      {DAY_LETTERS.map((letter, i) => {
        const completed = completedDays[i];
        const isToday = i === todayIdx;
        const isSelected = i === selectedIdx;
        const locked = i > todayIdx;
        const geom = geometries[i];
        const color = TANGRAM_COLORS[i];
        return (
          <Pressable
            key={i}
            disabled={locked}
            onPress={() => onSelectDay(i)}
            style={({ pressed }) => [
              styles.cell,
              completed && styles.cellCompleted,
              isSelected && styles.cellSelected,
              locked && styles.cellLocked,
              pressed && !locked && { opacity: 0.6 },
            ]}
          >
            <Text
              style={[
                styles.dayLetter,
                completed && styles.dayLetterCompleted,
                isToday && styles.dayLetterToday,
              ]}
            >
              {letter}
            </Text>
            <View style={styles.pieceWrap}>
              {completed ? (
                <Svg
                  width={CELL_PIECE_SIZE}
                  height={CELL_PIECE_SIZE}
                  viewBox={`0 0 ${geom.bbox.width} ${geom.bbox.height}`}
                >
                  <Polygon
                    points={pointsToString(geom.normalized)}
                    fill={color}
                    stroke={colors.foregroundFaint}
                    strokeWidth={0.8}
                  />
                </Svg>
              ) : (
                <View style={styles.placeholder} />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  cell: {
    flex: 1,
    aspectRatio: 0.7,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellSelected: {
    borderColor: colors.primary,
    backgroundColor: 'hsla(340, 55%, 75%, 0.12)',
  },
  cellCompleted: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  cellLocked: { opacity: 0.4 },
  dayLetter: {
    fontSize: 10,
    fontFamily: fonts.sansBold,
    color: colors.mutedForeground,
    letterSpacing: 0.5,
  },
  dayLetterCompleted: { color: colors.foreground },
  dayLetterToday: { color: colors.primary },
  pieceWrap: {
    width: CELL_PIECE_SIZE,
    height: CELL_PIECE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.mutedForegroundFaint,
  },
});
