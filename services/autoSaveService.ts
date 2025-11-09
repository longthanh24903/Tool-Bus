import type { AutoSaveConfig, FileSystemDirectoryHandle } from '../types';

const STORAGE_KEY = 'auto_save_config';

class AutoSaveService {
  private config: AutoSaveConfig | null = null;
  private directoryHandle: FileSystemDirectoryHandle | null = null;

  /**
   * Khởi tạo config từ localStorage
   */
  initialize(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.config = JSON.parse(stored);
      } else {
        // Default config
        this.config = {
          enabled: false,
          useFileSystemAPI: false,
          folderNameTemplate: 'auto-{date}',
          fileNameTemplate: '{topic}-{timestamp}.txt',
          autoCreateFolder: true,
        };
        this.saveConfig();
      }
    } catch (error) {
      console.error('Failed to load auto save config:', error);
      this.config = {
        enabled: false,
        useFileSystemAPI: false,
        folderNameTemplate: 'auto-{date}',
        fileNameTemplate: '{topic}-{timestamp}.txt',
        autoCreateFolder: true,
      };
    }
  }

  /**
   * Lưu config vào localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save auto save config:', error);
    }
  }

  /**
   * Lấy config hiện tại
   */
  getConfig(): AutoSaveConfig {
    if (!this.config) {
      this.initialize();
    }
    return this.config!;
  }

  /**
   * Cập nhật config
   */
  updateConfig(updates: Partial<AutoSaveConfig>): void {
    if (!this.config) {
      this.initialize();
    }
    this.config = { ...this.config!, ...updates };
    this.saveConfig();
  }

  /**
   * Kiểm tra xem File System Access API có được hỗ trợ không
   */
  isFileSystemAPISupported(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const win = window as any;
    return (
      'showDirectoryPicker' in win &&
      typeof win.showDirectoryPicker === 'function'
    );
  }

  /**
   * Yêu cầu quyền truy cập thư mục (File System Access API)
   */
  async requestDirectoryAccess(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.isFileSystemAPISupported()) {
      console.warn('File System Access API is not supported in this browser');
      return null;
    }

    try {
      // File System Access API - cần cast type
      const showDirectoryPicker = (window as any).showDirectoryPicker;
      if (!showDirectoryPicker) {
        return null;
      }
      
      const handle = await showDirectoryPicker({
        mode: 'readwrite',
      });
      this.directoryHandle = handle as FileSystemDirectoryHandle;
      
      // Lưu directory handle (chỉ lưu name vì không thể serialize handle)
      this.updateConfig({
        useFileSystemAPI: true,
        directoryPath: handle.name,
      });
      
      return this.directoryHandle;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('User cancelled directory picker');
      } else {
        console.error('Failed to request directory access:', error);
      }
      return null;
    }
  }

  /**
   * Lưu directory handle từ storage (không thể serialize, cần request lại)
   */
  async restoreDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.isFileSystemAPISupported() || !this.config?.useFileSystemAPI) {
      return null;
    }

    // File System Access API không cho phép serialize handle
    // Cần người dùng chọn lại thư mục mỗi lần
    // Hoặc sử dụng Persistent File System (experimental)
    return this.directoryHandle;
  }

  /**
   * Tạo thư mục trong directory handle
   */
  async createFolder(
    parentHandle: FileSystemDirectoryHandle,
    folderName: string
  ): Promise<FileSystemDirectoryHandle | null> {
    try {
      const folderHandle = await parentHandle.getDirectoryHandle(folderName, {
        create: true,
      });
      return folderHandle as FileSystemDirectoryHandle;
    } catch (error) {
      console.error('Failed to create folder:', error);
      return null;
    }
  }

  /**
   * Lưu file vào directory handle
   */
  async saveToDirectory(
    content: string,
    filename: string,
    directoryHandle?: FileSystemDirectoryHandle
  ): Promise<boolean> {
    const handle = directoryHandle || this.directoryHandle;
    if (!handle) {
      return false;
    }

    try {
      const fileHandle = await handle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (error) {
      console.error('Failed to save file to directory:', error);
      return false;
    }
  }

  /**
   * Tự động download file (fallback khi không có File System API)
   */
  async autoDownload(content: string, filename: string): Promise<void> {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  /**
   * Tạo tên file từ template
   */
  generateFileName(topic: string, template?: string): string {
    const config = this.getConfig();
    const tpl = template || config.fileNameTemplate;
    
    const timestamp = Date.now();
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    
    let filename = tpl
      .replace(/{topic}/g, topic.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
      .replace(/{timestamp}/g, timestamp.toString())
      .replace(/{date}/g, date)
      .replace(/{time}/g, time);
    
    // Đảm bảo có extension .txt
    if (!filename.endsWith('.txt')) {
      filename += '.txt';
    }
    
    return filename;
  }

  /**
   * Tạo tên thư mục từ template
   */
  generateFolderName(template?: string): string {
    const config = this.getConfig();
    const tpl = template || config.folderNameTemplate;
    
    const date = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    
    return tpl
      .replace(/{date}/g, date)
      .replace(/{timestamp}/g, timestamp.toString())
      .replace(/{time}/g, new Date().toTimeString().split(' ')[0].replace(/:/g, '-'));
  }

  /**
   * Tự động lưu file (chính)
   */
  async autoSave(
    content: string,
    topic: string,
    forceSave: boolean = false // Force save ngay cả khi config.enabled = false (dùng trong auto loop)
  ): Promise<{ success: boolean; message: string; method: 'filesystem' | 'download' }> {
    const config = this.getConfig();
    
    // Nếu forceSave = true (auto loop mode), bỏ qua check config.enabled
    if (!forceSave && !config.enabled) {
      return {
        success: false,
        message: 'Auto save is not enabled',
        method: 'download',
      };
    }

    const filename = this.generateFileName(topic);
    
    // Nếu forceSave = true (auto loop mode), luôn dùng auto download để đảm bảo file được tải về
    // Nếu không, thử dùng File System API nếu được bật
    if (!forceSave && config.useFileSystemAPI && this.isFileSystemAPISupported()) {
      let targetDirectory = this.directoryHandle;
      
      // Nếu cần tạo thư mục tự động
      if (config.autoCreateFolder && targetDirectory) {
        const folderName = this.generateFolderName();
        const folderHandle = await this.createFolder(targetDirectory, folderName);
        if (folderHandle) {
          targetDirectory = folderHandle;
        }
      }
      
      // Thử lưu vào directory
      if (targetDirectory) {
        const success = await this.saveToDirectory(content, filename, targetDirectory);
        if (success) {
          return {
            success: true,
            message: `Đã lưu vào thư mục: ${targetDirectory.name}/${filename}`,
            method: 'filesystem',
          };
        }
      }
      
      // Nếu không có directory handle, fallback về auto download
      // (không return false để đảm bảo file vẫn được tải về)
    }
    
    // Fallback: Auto download (luôn hoạt động)
    await this.autoDownload(content, filename);
    return {
      success: true,
      message: `Đã tải xuống: ${filename}`,
      method: 'download',
    };
  }
}

export const autoSaveService = new AutoSaveService();

