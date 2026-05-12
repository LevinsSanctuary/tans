import { MotiView } from 'moti';
import Svg, { G, Polygon } from 'react-native-svg';
import { colors } from '@/constants/theme';
import {
  SILHOUETTES,
  TANGRAM_COLORS,
  type Silhouette,
} from '@/lib/silhouettes';
import { getPieceGeometries, pointsToString } from '@/lib/tangramGeometry';

interface TangramProps {
  earned: number;
  size?: number;
  silhouette?: Silhouette;
  newestIndex?: number | null;
}

export function Tangram({
  earned,
  size = 200,
  silhouette,
  newestIndex = null,
}: TangramProps) {
  const sil = silhouette ?? SILHOUETTES[0];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G transform={sil.transform}>
        {sil.pieces.map((points, i) => {
          const isEarned = i < earned;
          const isNew = newestIndex === i;
          const color = TANGRAM_COLORS[i];
          // Plain Polygon for non-newest pieces; MotiView wrap on the
          // newest one would require SVG-aware animation. For the simple
          // pop-in we just render the polygon — the Falling animation
          // overlay handles the celebratory bit.
          return (
            <Polygon
              key={`${sil.name}-${i}-${isNew ? 'new' : 'old'}`}
              points={points}
              fill={isEarned ? color : 'transparent'}
              stroke={isEarned ? colors.foregroundFaint : colors.mutedForegroundFaint}
              strokeWidth={0.6}
              strokeDasharray={isEarned ? undefined : '1.5 1.5'}
            />
          );
        })}
      </G>
    </Svg>
  );
}

export function TangramPiece({
  index,
  size = 120,
  silhouette,
}: {
  index: number;
  size?: number;
  silhouette?: Silhouette;
}) {
  const sil = silhouette ?? SILHOUETTES[0];
  const i = ((index % 7) + 7) % 7;
  const geom = getPieceGeometries(sil)[i];
  const color = TANGRAM_COLORS[i];
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${geom.bbox.width} ${geom.bbox.height}`}
    >
      <Polygon
        points={pointsToString(geom.normalized)}
        fill={color}
        stroke={colors.foregroundFaint}
        strokeWidth={0.8}
      />
    </Svg>
  );
}

// Re-export so callers can keep a single import.
export { MotiView };
