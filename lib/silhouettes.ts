import { colors } from '@/constants/theme';

export const TANGRAM_COLORS = [
  colors.brickRed,
  colors.brickOrange,
  colors.brickYellow,
  colors.brickGreen,
  colors.brickCyan,
  colors.brickBlue,
  colors.brickPurple,
];

export interface Silhouette {
  name: string;
  pieces: string[];
  transform?: string;
}

export const SILHOUETTES: Silhouette[] = [
  {
    name: 'Square',
    pieces: [
      '0,0 50,0 0,50',
      '50,0 100,0 100,50',
      '50,50 100,50 75,75',
      '0,50 25,75 0,100',
      '0,100 25,75 50,100',
      '25,75 50,50 75,75 50,100',
      '75,75 100,50 100,100 50,100',
    ],
  },
  {
    name: 'Diamond',
    transform: 'rotate(45 50 50)',
    pieces: [
      '0,0 50,0 0,50',
      '50,0 100,0 100,50',
      '50,50 100,50 75,75',
      '0,50 25,75 0,100',
      '0,100 25,75 50,100',
      '25,75 50,50 75,75 50,100',
      '75,75 100,50 100,100 50,100',
    ],
  },
  {
    name: 'House',
    pieces: [
      '0,50 50,50 50,0',
      '50,0 100,50 50,50',
      '50,50 100,50 75,75',
      '0,50 25,75 0,100',
      '0,100 25,75 50,100',
      '37.5,62.5 62.5,62.5 62.5,87.5 37.5,87.5',
      '75,75 100,50 100,100 50,100',
    ],
  },
  {
    name: 'Mountain',
    pieces: [
      '10,100 40,20 50,100',
      '50,100 60,20 90,100',
      '40,20 60,20 50,55',
      '0,100 12,80 25,100',
      '75,100 88,80 100,100',
      '45,15 55,15 55,5 45,5',
      '25,100 40,75 60,75 75,100',
    ],
  },
  {
    name: 'Boat',
    pieces: [
      '50,5 50,55 15,55',
      '50,5 50,55 85,55',
      '45,55 55,55 50,15',
      '0,70 50,70 25,95',
      '50,70 100,70 75,95',
      '40,60 60,60 60,70 40,70',
      '25,95 75,95 65,100 35,100',
    ],
  },
];

export function getSilhouetteForWeek(weekStart: string): Silhouette {
  let h = 0;
  for (let i = 0; i < weekStart.length; i++) {
    h = (h * 31 + weekStart.charCodeAt(i)) >>> 0;
  }
  return SILHOUETTES[h % SILHOUETTES.length];
}
