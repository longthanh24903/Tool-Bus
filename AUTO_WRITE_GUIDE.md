# Hướng Dẫn Sử Dụng Tính Năng Auto Write

## 🎯 Tổng Quan

Tính năng **Auto Write** cho phép tự động:

1. ✅ Gợi ý topic (nếu bật)
2. ✅ Tạo outline
3. ✅ Viết tất cả các parts tự động
4. ✅ Tự động lưu file sau khi hoàn thành

### 🔄 Auto Loop Mode (Mới)

Tính năng **Auto Loop** cho phép tự động lặp lại vô hạn:

1. ✅ Tự động gợi ý topic mới
2. ✅ Tự động viết tất cả các parts
3. ✅ Tự động tải về file sau mỗi story
4. ✅ Tự động bắt đầu story mới
5. ✅ Lặp lại vô hạn cho đến khi dừng thủ công

## 🚀 Cách Sử Dụng

### Bước 1: Mở Cài Đặt Auto Write

1. Click vào nút **"Auto Write"** ở góc trên bên phải màn hình
2. Modal cài đặt sẽ hiển thị

### Bước 2: Cấu Hình Auto Write Mode

#### **Auto Write Mode**

- ✅ **Bật Auto Write Mode**: Kích hoạt chế độ tự động viết
- ✅ **Tự động gợi ý topic**: Tự động tạo topic nếu ô topic trống
- ✅ **Delay giữa các phần**: Thời gian chờ giữa mỗi phần (mặc định: 2000ms)
  - Giúp tránh rate limit API
  - Khuyến nghị: 2000-5000ms
- ✅ **Auto Loop - Tự động lặp lại vô hạn**:
  - Sau khi hoàn thành một story, tự động gợi ý topic mới
  - Tự động viết story tiếp theo
  - Tự động tải về file sau mỗi story
  - Lặp lại vô hạn cho đến khi dừng thủ công
  - ⚠️ **Lưu ý**: Sẽ tạo nhiều files, đảm bảo có đủ dung lượng lưu trữ

#### **Auto Save Configuration**

- ✅ **Bật Auto Save**: Tự động lưu file sau khi hoàn thành
- ✅ **Sử dụng File System API**:
  - Chỉ hỗ trợ Chrome/Edge
  - Cho phép chọn thư mục để lưu file tự động
  - Cần chọn thư mục lần đầu (không thể lưu permission)
- ✅ **Tự động tạo thư mục con**: Tạo thư mục con theo template
- ✅ **Template tên thư mục**: Sử dụng `{date}`, `{timestamp}`, `{time}`
- ✅ **Template tên file**: Sử dụng `{topic}`, `{timestamp}`, `{date}`, `{time}`

### Bước 3: Sử Dụng Auto Write

#### **Chế độ Auto Write thông thường:**

1. **Nhập topic** (hoặc để trống nếu bật auto suggest)
2. **Cấu hình số parts và số từ**
3. **Click "Bắt đầu Auto Write"** (hoặc "Tạo truyện" nếu auto write mode đã bật)
4. **Theo dõi tiến độ** trên progress bar
5. **File sẽ tự động lưu** sau khi hoàn thành (nếu bật auto save)

#### **Chế độ Auto Loop:**

1. **Bật Auto Loop** trong cài đặt
2. **Nhập topic** (sẽ được tự động gợi ý nếu để trống)
3. **Click "Bắt đầu Auto Write"**
4. **Hệ thống sẽ tự động**:
   - Gợi ý topic mới
   - Viết tất cả parts
   - Tự động tải về file
   - Bắt đầu story mới
   - Lặp lại vô hạn
5. **Theo dõi tiến độ** - sẽ hiển thị số story hiện tại (Story #1, Story #2, ...)
6. **Nhấn "Dừng Auto Loop"** để dừng khi muốn

## 📋 Templates

### Template Tên File

- `{topic}`: Tên topic (đã được làm sạch)
- `{timestamp}`: Timestamp (milliseconds)
- `{date}`: Ngày tháng (YYYY-MM-DD)
- `{time}`: Thời gian (HH-MM-SS)

**Ví dụ:**

- Template: `{topic}-{timestamp}.txt`
- Kết quả: `dong-sang-lap-da-anh-cap-y-tuong-startup-1704067200000.txt`

### Template Tên Thư Mục

- `{date}`: Ngày tháng (YYYY-MM-DD)
- `{timestamp}`: Timestamp (milliseconds)
- `{time}`: Thời gian (HH-MM-SS)

**Ví dụ:**

- Template: `auto-{date}`
- Kết quả: `auto-2024-01-01`

## ⚙️ Cấu Hình Nâng Cao

### File System API (Chrome/Edge)

1. Bật "Sử dụng File System API"
2. Click "Chọn thư mục"
3. Chọn thư mục muốn lưu file
4. Files sẽ được lưu vào thư mục đã chọn

**Lưu ý:**

- Cần chọn lại thư mục mỗi lần mở app (do browser security)
- Không hỗ trợ trên Firefox/Safari (sẽ dùng auto download thay thế)

### Fallback Mode (Tất cả trình duyệt)

- Nếu File System API không được hỗ trợ hoặc không được bật
- Files sẽ được tự động download vào thư mục Downloads
- Tên file sẽ theo template đã cấu hình

## 🔧 Troubleshooting

### Auto Write không chạy

- Kiểm tra xem Auto Write Mode đã được bật chưa
- Kiểm tra xem có topic hoặc đã bật auto suggest topic chưa
- Kiểm tra API keys

### Auto Save không hoạt động

- Kiểm tra xem Auto Save đã được bật chưa
- Nếu dùng File System API: Đảm bảo đã chọn thư mục
- Kiểm tra console để xem lỗi chi tiết

### Rate Limit API

- Tăng delay giữa các parts (3000-5000ms)
- Kiểm tra số lượng API keys
- Giảm số parts hoặc số từ mỗi part

## 💡 Tips

1. **Delay giữa các parts**:

   - 2000ms: Tốc độ nhanh, có thể gặp rate limit
   - 3000-5000ms: Cân bằng tốt
   - 5000ms+: An toàn nhất, nhưng chậm

2. **Auto Suggest Topic**:

   - Hữu ích khi bạn chưa có ý tưởng
   - Topic được gợi ý dựa trên lịch sử

3. **File System API**:

   - Chỉ dùng trên Chrome/Edge
   - Cần chọn lại thư mục mỗi lần mở app
   - Tổ chức files tốt hơn với auto create folder

4. **Template**:
   - Sử dụng `{date}` để tổ chức files theo ngày
   - Sử dụng `{topic}` để dễ tìm file sau này

## 📝 Lưu Ý

- Auto Write Mode sẽ tự động viết tất cả parts, không cần click từng part
- Progress bar hiển thị tiến độ real-time
- Có thể cancel bằng cách refresh trang (nhưng sẽ mất dữ liệu)
- Auto save chỉ chạy sau khi hoàn thành tất cả parts
- File System API permission không được lưu giữ (do browser security)

## 🎉 Kết Luận

Tính năng Auto Write giúp tự động hóa toàn bộ quá trình tạo bài viết, từ gợi ý topic đến lưu file. Chỉ cần cấu hình một lần và click "Bắt đầu"!
