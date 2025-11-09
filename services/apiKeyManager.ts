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
     * Lấy API key hiện tại (chưa exhausted) và tự động rotate sang key tiếp theo
     */
    getCurrentKey(): string | null {
        this.initialize();
        
        if (this.keys.length === 0) {
            return null;
        }

        // Tìm key chưa exhausted, bắt đầu từ currentIndex
        const startIndex = this.currentIndex;
        let attempts = 0;
        
        while (attempts < this.keys.length) {
            const keyInfo = this.keys[this.currentIndex];
            if (!keyInfo.isExhausted) {
                const selectedKey = keyInfo.key;
                // Cập nhật lastUsed
                keyInfo.lastUsed = Date.now();
                this.save();
                
                // Tự động rotate sang key tiếp theo để load balancing
                // (chỉ rotate nếu có nhiều hơn 1 key available)
                const availableKeys = this.keys.filter(k => !k.isExhausted);
                if (availableKeys.length > 1) {
                    this.rotateToNextAvailableKey();
                }
                
                return selectedKey;
            }
            // Key đã exhausted, chuyển sang key tiếp theo
            this.currentIndex = (this.currentIndex + 1) % this.keys.length;
            attempts++;
            
            // Nếu đã quay lại vị trí bắt đầu, break
            if (this.currentIndex === startIndex && attempts > 0) {
                break;
            }
        }

        // Tất cả keys đã exhausted, trả về key đầu tiên để thử lại (có thể đã reset)
        console.warn('[API Key Manager] All keys exhausted, returning first key as fallback');
        return this.keys[0]?.key || null;
    }

    /**
     * Đánh dấu một key cụ thể là exhausted (hết quota/pro)
     * @param key - API key cần mark exhausted (nếu không có, mark key tại currentIndex)
     */
    markKeyExhausted(key?: string, error?: string): void {
        if (this.keys.length === 0) return;

        let keyToMark: ApiKeyInfo | null = null;
        
        if (key) {
            // Tìm key theo giá trị
            keyToMark = this.keys.find(k => k.key === key) || null;
        } else {
            // Mark key tại currentIndex
            keyToMark = this.keys[this.currentIndex] || null;
        }
        
        if (keyToMark && !keyToMark.isExhausted) {
            keyToMark.isExhausted = true;
            keyToMark.lastError = error;
            keyToMark.lastUsed = Date.now();
            this.save();
            console.log(`[API Key Manager] ✅ Marked key as exhausted: ${keyToMark.key.substring(0, 10)}..., error: ${error?.substring(0, 50)}`);
            
            // Nếu key vừa mark là key tại currentIndex, rotate sang key khác
            if (this.keys[this.currentIndex] === keyToMark) {
                this.rotateToNextAvailableKey();
            }
        } else if (keyToMark && keyToMark.isExhausted) {
            console.log(`[API Key Manager] Key already exhausted: ${keyToMark.key.substring(0, 10)}...`);
        } else {
            console.warn(`[API Key Manager] Key not found to mark as exhausted`);
        }
    }
    
    /**
     * Đánh dấu key hiện tại là exhausted (hết quota/pro)
     * @deprecated - Sử dụng markKeyExhausted() với key cụ thể
     */
    markCurrentKeyExhausted(error?: string): void {
        this.markKeyExhausted(undefined, error);
    }
    
    /**
     * Chuyển sang key tiếp theo chưa exhausted
     */
    private rotateToNextAvailableKey(): void {
        if (this.keys.length === 0) return;
        
        const startIndex = this.currentIndex;
        let attempts = 0;
        
        // Tìm key tiếp theo chưa exhausted
        while (attempts < this.keys.length) {
            this.currentIndex = (this.currentIndex + 1) % this.keys.length;
            const keyInfo = this.keys[this.currentIndex];
            
            if (!keyInfo.isExhausted) {
                console.log(`[API Key Manager] ✅ Rotated to key: ${keyInfo.key.substring(0, 10)}...`);
                return;
            }
            
            attempts++;
            
            // Nếu đã quay lại vị trí bắt đầu, break
            if (this.currentIndex === startIndex && attempts > 0) {
                break;
            }
        }
        
        console.warn('[API Key Manager] ⚠️ No available keys found after rotation');
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

