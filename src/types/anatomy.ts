export type AnatomyCategory =
  | 'chamber'
  | 'vessel'
  | 'valve'
  | 'tissue'
  | 'neural'
  | 'organ'
  | 'duct';

export interface AnatomyPin {
  id: string;
  label: string;
  category: AnatomyCategory;
  side: 'left' | 'right';
  /** Normalized horizontal coordinate on the specimen image (0 to 100). */
  x: number;
  /** Normalized vertical coordinate on the specimen image (0 to 100). */
  y: number;
  /** Clear anatomical & physiological explanation for students. */
  description: string;
  /** High-yield clinical or exam pearl for medical students and teachers. */
  clinicalNote: string;
}

export interface AnatomyAtlas {
  id: string;
  title: string;
  shortName: string;
  system: string;
  summary: string;
  imageUrl: string;
  pins: AnatomyPin[];
  suggestedPrompts: string[];
}

export interface LaidOutAtlasPin extends AnatomyPin {
  /** Computed non-overlapping label slot vertical percentage (0 to 100). */
  labelY: number;
  /** 1-based display index used for quiz mode & guided tours. */
  orderIndex: number;
}
