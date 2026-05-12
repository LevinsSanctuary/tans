import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
}

export function WeekStrip({ silhouette, completedDays, todayIdx }: Props) {
  const geometries = useMemo(
    () => getPieceGeometries(silhouette),
    [silhouette],
  );

  return (
    <View style={styles.row}>
      {DAY_LETTERS.map((letter, i) => {
        const completed = completedDays[i];
        const isToday = i === todayIdx;
        const geom = geometries[i];
        const color = TANGRAM_COLORS[i];
        return (
          <View
            key={i}
            style={[
              styles.cell,
              completed && styles.cellCompleted,
              isToday && !completed && styles.cellToday,
            ]}
          >
            <Text
              style={[
                styles.dayLetter,
                completed && styles.dayLetterCompleted,
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
          </View>
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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cellToday: {
    borderColor: colors.primary,
    backgroundColor: 'hsla(340, 55%, 75%, 0.12)',
  },
  cellCompleted: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  dayLetter: {
    fontSize: 10,
    fontFamily: fonts.sansBold,
    color: colors.mutedForeground,
    letterSpacing: 0.5,
  },
  dayLetterCompleted: { color: colors.foreground },
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
