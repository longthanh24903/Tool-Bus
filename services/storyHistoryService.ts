import type { StoryHistoryItem, StoryPart } from "../types";

class StoryHistoryService {
  private readonly STORAGE_KEY = "storyHistory";

  /**
   * Lấy tất cả lịch sử kịch bản
   */
  getAll(): StoryHistoryItem[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error("Failed to load story history:", error);
    }
    return [];
  }

  /**
   * Lưu một kịch bản vào lịch sử
   */
  save(
    topic: string,
    storyParts: StoryPart[],
    storyOutline: string,
    storyNumber?: number
  ): string {
    const history = this.getAll();
    const newItem: StoryHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      topic,
      storyParts,
      storyOutline,
      createdAt: Date.now(),
      storyNumber,
    };

    history.unshift(newItem); // Thêm vào đầu danh sách
    this.saveAll(history);
    return newItem.id;
  }

  /**
   * Lưu toàn bộ lịch sử
   */
  private saveAll(history: StoryHistoryItem[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error("Failed to save story history:", error);
      // Nếu localStorage đầy, xóa các item cũ nhất
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        // Giữ lại 100 item mới nhất
        const limitedHistory = history.slice(0, 100);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(limitedHistory));
      }
    }
  }

  /**
   * Xóa một kịch bản khỏi lịch sử
   */
  delete(id: string): boolean {
    const history = this.getAll();
    const filtered = history.filter((item) => item.id !== id);
    if (filtered.length !== history.length) {
      this.saveAll(filtered);
      return true;
    }
    return false;
  }

  /**
   * Xóa nhiều kịch bản
   */
  deleteMany(ids: string[]): number {
    const history = this.getAll();
    const filtered = history.filter((item) => !ids.includes(item.id));
    const deletedCount = history.length - filtered.length;
    if (deletedCount > 0) {
      this.saveAll(filtered);
    }
    return deletedCount;
  }

  /**
   * Xóa tất cả lịch sử
   */
  clearAll(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Lấy một kịch bản theo ID
   */
  getById(id: string): StoryHistoryItem | null {
    const history = this.getAll();
    return history.find((item) => item.id === id) || null;
  }

  /**
   * Lấy số lượng kịch bản đã lưu
   */
  getCount(): number {
    return this.getAll().length;
  }

  /**
   * Tạo nội dung text từ story parts để tải về
   */
  formatStoryForDownload(item: StoryHistoryItem): string {
    return item.storyParts
      .map((p) => `TIÊU ĐỀ: ${p.title}\n\n${p.body}\n\n${p.endLine}`)
      .join("\n\n---\n\n");
  }

  /**
   * Tải về một kịch bản
   */
  downloadStory(item: StoryHistoryItem): void {
    const content = this.formatStoryForDownload(item);
    const filename = `${item.topic.replace(/[^a-z0-9]/gi, "_").substring(0, 50)}_${new Date(item.createdAt).toISOString().split("T")[0]}.txt`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Tải về nhiều kịch bản (tải từng file)
   */
  downloadStories(items: StoryHistoryItem[]): void {
    // Tải từng file một (vì browser không hỗ trợ tạo ZIP trực tiếp)
    items.forEach((item, index) => {
      setTimeout(() => {
        this.downloadStory(item);
      }, index * 300); // Delay 300ms giữa mỗi file để tránh browser block
    });
  }

  /**
   * Tải về tất cả kịch bản
   */
  downloadAll(): void {
    const all = this.getAll();
    this.downloadStories(all);
  }
}

export const storyHistoryService = new StoryHistoryService();
