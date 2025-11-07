/**
 * API Key Manager - Quản lý và xoay vòng các API keys
 * Tự động chuyển sang API key khác khi hết quota/pro
 */

export interface ApiKeyInfo {
    key: string;
    isExhausted: boolean; // Đánh dấu key đã hết quota/pro
    lastError?: string; // Lưu lỗi cuối cùng
    lastUsed?: number; // Timestamp lần sử dụng cuối
}

const STORAGE_KEY = 'gemini_api_keys';
const MAX_RETRY_ATTEMPTS = 3;

class ApiKeyManager {
    private keys: ApiKeyInfo[] = [];
    private currentIndex: number = 0;
    private initialized: boolean = false;

    /**
     * Khởi tạo từ localStorage hoặc environment variable
     */
    initialize(): void {
        if (this.initialized) return;

        try {
            // Load từ localStorage
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                this.keys = JSON.parse(stored);
            } else {
                // Nếu không có trong localStorage, thử lấy từ env (chỉ trong môi trường build)
                // Trong Vite, env variables cần prefix VITE_ và được inject tại build time
                let envKey: string | undefined;
                
                // Thử các cách khác nhau để lấy env key
                if (typeof import.meta !== 'undefined' && import.meta.env) {
                    envKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
                }
                
                // Fallback cho Node.js environment (nếu có)
                if (!envKey && typeof process !== 'undefined' && process.env) {
                    envKey = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
                }
                
                if (envKey && envKey.trim().length > 0) {
                    this.keys = [{ key: envKey.trim(), isExhausted: false }];
                    this.save();
                }
            }

            // Đảm bảo có ít nhất 1 key
            if (this.keys.length === 0) {
                console.warn('Không có API key nào được cấu hình. Vui lòng thêm API key qua modal cài đặt.');
            }

            this.initialized = true;
        } catch (error) {
            console.error('Lỗi khi khởi tạo API Key Manager:', error);
            this.keys = [];
            this.initialized = true;
        }
    }

    /**
     * Lưu keys vào localStorage
     */
    private save(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.keys));
        } catch (error) {
            console.error('Lỗi khi lưu API keys:', error);
        }
    }

    /**
     * Thêm hoặc cập nhật API keys
     */
    setKeys(keys: string[]): void {
        // Loại bỏ các key trùng lặp và rỗng
        const uniqueKeys = Array.from(new Set(keys.filter(k => k.trim().length > 0)));
        
        // Tạo ApiKeyInfo từ keys mới, giữ lại trạng thái exhausted nếu key đã tồn tại
        const existingKeys = new Map(this.keys.map(k => [k.key, k]));
        this.keys = uniqueKeys.map(key => {
            const existing = existingKeys.get(key);
            return existing || { key, isExhausted: false };
        });

        // Reset currentIndex nếu key hiện tại bị xóa
        if (this.currentIndex >= this.keys.length) {
            this.currentIndex = 0;
        }

        this.save();
    }

    /**
     * Lấy danh sách tất cả keys
     */
    getAllKeys(): ApiKeyInfo[] {
        return [...this.keys];
    }

    /**
     * Lấy API key hiện tại (chưa exhausted)
     */
    getCurrentKey(): string | null {
        this.initialize();
        
        if (this.keys.length === 0) {
            return null;
        }

        // Tìm key chưa exhausted, bắt đầu từ currentIndex
        let attempts = 0;
        while (attempts < this.keys.length) {
            const keyInfo = this.keys[this.currentIndex];
            if (!keyInfo.isExhausted) {
                return keyInfo.key;
            }
            this.currentIndex = (this.currentIndex + 1) % this.keys.length;
            attempts++;
        }

        // Tất cả keys đã exhausted, trả về key đầu tiên (sẽ dùng flash model)
        return this.keys[0]?.key || null;
    }

    /**
     * Đánh dấu key hiện tại là exhausted (hết quota/pro)
     */
    markCurrentKeyExhausted(error?: string): void {
        if (this.keys.length === 0) return;

        const currentKeyInfo = this.keys[this.currentIndex];
        if (currentKeyInfo) {
            currentKeyInfo.isExhausted = true;
            currentKeyInfo.lastError = error;
            currentKeyInfo.lastUsed = Date.now();
            this.save();

            // Chuyển sang key tiếp theo
            this.currentIndex = (this.currentIndex + 1) % this.keys.length;
        }
    }

    /**
     * Kiểm tra xem tất cả keys đã exhausted chưa
     */
    areAllKeysExhausted(): boolean {
        return this.keys.length > 0 && this.keys.every(k => k.isExhausted);
    }

    /**
     * Reset trạng thái exhausted của một key (khi user muốn thử lại)
     */
    resetKeyExhausted(key: string): void {
        const keyInfo = this.keys.find(k => k.key === key);
        if (keyInfo) {
            keyInfo.isExhausted = false;
            keyInfo.lastError = undefined;
            this.save();
        }
    }

    /**
     * Reset tất cả keys về trạng thái chưa exhausted
     */
    resetAllKeys(): void {
        this.keys.forEach(k => {
            k.isExhausted = false;
            k.lastError = undefined;
        });
        this.currentIndex = 0;
        this.save();
    }

    /**
     * Xóa một key
     */
    removeKey(key: string): void {
        this.keys = this.keys.filter(k => k.key !== key);
        if (this.currentIndex >= this.keys.length) {
            this.currentIndex = 0;
        }
        this.save();
    }

    /**
     * Kiểm tra xem có key nào chưa exhausted không
     */
    hasAvailableKey(): boolean {
        return this.keys.some(k => !k.isExhausted);
    }
}

// Export singleton instance
export const apiKeyManager = new ApiKeyManager();

