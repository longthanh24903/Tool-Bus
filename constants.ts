import type { Language } from './types';

export const PART_OPTIONS: number[] = Array.from({ length: 10 }, (_, i) => i + 1);

interface LanguageOption {
  value: Language;
  label: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'English', label: 'English 🇺🇸' },
  { value: 'Vietnamese', label: 'Vietnamese 🇻🇳' },
];
