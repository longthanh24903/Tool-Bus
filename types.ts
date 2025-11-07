export type Language = 'English' | 'Vietnamese';

export interface StoryPart {
  title: string;
  body: string;
  endLine: string;
}

export interface Suggestions {
  thumbnails: string[];
  voicePrompts: string[];
  imagePrompts: string[];
}

export type SeoContentType = 'title' | 'description' | 'hashtags';

export interface SeoContent {
  titles: string[];
  description: string;
  hashtags: string[];
}
