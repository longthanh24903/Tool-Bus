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

// Auto Write Configuration
export interface AutoWriteConfig {
  enabled: boolean;
  autoSuggestTopic: boolean;
  delayBetweenParts: number; // milliseconds
  autoLoop: boolean; // Tự động lặp lại: sau khi hoàn thành một story, tự động bắt đầu story mới
  maxStories?: number; // Số kịch bản tối đa sẽ được tạo trong auto loop (0 = vô hạn)
}

// Auto Save Configuration
export interface AutoSaveConfig {
  enabled: boolean;
  useFileSystemAPI: boolean;
  folderNameTemplate: string;
  fileNameTemplate: string;
  autoCreateFolder: boolean;
  directoryPath?: string; // Saved directory path (serialized)
}

// Story History - Lưu trữ các kịch bản đã tạo
export interface StoryHistoryItem {
  id: string; // Unique ID
  topic: string;
  storyParts: StoryPart[];
  storyOutline: string;
  createdAt: number; // Timestamp
  storyNumber?: number; // Số thứ tự trong auto loop (nếu có)
}

// File System Directory Handle (for TypeScript)
export interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

export interface FileSystemDirectoryHandle extends FileSystemHandle {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<FileSystemHandle>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
  kind: 'directory';
}

export interface FileSystemFileHandle extends FileSystemHandle {
  getFile(): Promise<File>;
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
  kind: 'file';
}
