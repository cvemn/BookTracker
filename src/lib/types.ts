export type Status = 'read' | 'reading' | 'want';

export const STATUSES: { id: Status; label: string; emoji: string }[] = [
  { id: 'read', label: 'Read it', emoji: '📗' },
  { id: 'reading', label: 'Reading', emoji: '📖' },
  { id: 'want', label: 'Want to read', emoji: '🔖' },
];

export const VIBES: { id: string; emoji: string; label: string }[] = [
  { id: 'cried', emoji: '😭', label: 'made me cry' },
  { id: 'laughed', emoji: '😂', label: 'made me laugh' },
  { id: 'cozy', emoji: '🫶', label: 'cozy' },
  { id: 'spicy', emoji: '🌶️', label: 'spicy' },
  { id: 'mindblown', emoji: '🤯', label: 'mind-blown' },
  { id: 'unputdownable', emoji: '🔥', label: 'couldn’t put it down' },
  { id: 'spooky', emoji: '👻', label: 'spooky' },
  { id: 'slow', emoji: '🐌', label: 'slow burn' },
  { id: 'meh', emoji: '😐', label: 'meh' },
];

/** One reader's personal take on a book. */
export interface Take {
  status: Status;
  rating: number; // 0 = unrated, 1-5 hearts
  vibes: string[];
  note: string;
  finishedOn?: string; // yyyy-mm-dd
  updatedAt: number;
}

export interface Book {
  kind: 'book';
  id: string;
  title: string;
  authors: string[];
  cover?: string;
  year?: number;
  pages?: number;
  description?: string;
  source?: 'openlibrary' | 'google' | 'manual';
  sourceKey?: string;
  isbn?: string;
  addedBy: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  takes: Record<string, Take>;
}

export interface Profile {
  kind: 'profile';
  id: string; // `profile:<readerId>`
  readerId: string;
  name: string;
  critter: string;
  updatedAt: number;
}

export type Entry = Book | Profile;

export interface Me {
  readerId: string;
  name: string;
  critter: string;
}


export const CRITTERS = ['🐶', '🐱', '🦊', '🐻', '🐰', '🐸', '🐼', '🦉', '🐧', '🦔', '🐨', '🐙'];
