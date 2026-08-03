# Tạo sản phẩm & thêm hình ảnh bằng AI

Tài liệu mô tả luồng **sinh ảnh sản phẩm bằng AI** (OpenAI `gpt-image-1`) và cách
gắn ảnh đó vào sản phẩm từ Back-office.

Ý tưởng cốt lõi: BO gửi một **mô tả (prompt)** → API sinh ảnh, **lưu vào chính
`./uploads`** như ảnh tải lên thủ công → trả về **URL cố định của hệ thống** →
URL này được nhét vào `images[]` khi tạo/sửa sản phẩm. Nhờ lưu nội bộ, sản phẩm
không bao giờ phụ thuộc link tạm của nhà cung cấp (link OpenAI hết hạn sau ~1h).

Code liên quan:
- `src/modules/uploads/services/image-gen.service.ts` — sinh ảnh + lưu file
- `src/modules/uploads/controllers/admin-uploads.controller.ts` — endpoint
- `src/modules/uploads/dto/generate-image.dto.ts` — validate prompt
- `src/config/configuration.ts` (khối `openai`) — cấu hình provider
- `src/main.ts` — serve tĩnh thư mục `./uploads` tại `/uploads/*`

---

## 1. Cấu hình môi trường (.env)

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `OPENAI_API_KEY` | `''` (rỗng) | Key OpenAI. **Rỗng ⇒ chế độ MOCK** (trả ảnh SVG placeholder, không gọi API, không tốn tiền). |
| `OPENAI_IMAGE_MODEL` | `gpt-image-1` | Model sinh ảnh. |
| `OPENAI_IMAGE_SIZE` | `1024x1024` | Kích thước ảnh (vd `1024x1024`, `1024x1536`, `1536x1024`). |
| `PUBLIC_URL` | `''` | Base URL công khai để dựng URL ảnh trả về. Rỗng ⇒ tự suy ra từ `protocol://host` của request. Nên set ở production (vd `https://api.shop.vn`). |

> Không có key vẫn chạy được toàn bộ luồng để dev/test — ảnh trả về là SVG có
> nhãn “MOCK · ẢNH AI” kèm prompt, để không nhầm là ảnh thật.

---

## 2. Endpoint sinh ảnh AI

```
POST /api/admin/uploads/generate
```

- **Auth:** Bearer token, cần quyền `catalog.create` **hoặc** `catalog.update`.
- **Body:**

  ```json
  { "prompt": "Ảnh sản phẩm mứt dâu Đà Lạt trong hũ thủy tinh, nền sáng, chụp studio" }
  ```

  `prompt`: chuỗi bắt buộc, độ dài **3–1000** ký tự (tiếng Việt hoặc Anh).

- **Response `201`:**

  ```json
  { "url": "http://localhost:3002/uploads/ai-lz9k2p-6f3a1c9e8b2d.png" }
  ```

  Ảnh thật là `.png`; ở chế độ mock là `.svg`.

- **Lỗi:**
  - `400` — prompt sai định dạng (rỗng/quá ngắn/quá dài).
  - `401/403` — chưa đăng nhập / thiếu quyền `catalog.*`.
  - `502 BadGateway` — không gọi được OpenAI hoặc OpenAI trả lỗi/không có ảnh
    (`"Không kết nối được dịch vụ tạo ảnh."` / `"Dịch vụ tạo ảnh trả về lỗi."`).

**Ví dụ curl:**

```bash
curl -X POST http://localhost:3002/api/admin/uploads/generate \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Áo thun cotton trắng nam, chụp studio nền xám, chính diện"}'
# => { "url": "http://localhost:3002/uploads/ai-....png" }
```

---

## 3. (Tham chiếu) Upload ảnh thủ công

Cùng bộ storage với ảnh AI — dùng khi có sẵn file ảnh:

```
POST /api/admin/uploads      (multipart/form-data, field: files)
```

- Tối đa **10 file**, mỗi file ≤ **5MB**, định dạng `jpeg | png | webp | gif | avif`.
- Response: `{ "urls": ["http://host/uploads/....png", ...] }`.

Ảnh AI và ảnh upload trả về **cùng dạng URL `/uploads/...`**, nên bước gắn vào
sản phẩm (mục 4) xử lý y hệt nhau.

---

## 4. Gắn ảnh vào sản phẩm

URL nhận ở mục 2/3 được đưa vào field `images[]` khi **tạo** hoặc **cập nhật**
sản phẩm.

Tạo mới:
```
POST /api/admin/products      (quyền catalog.create)
```
Cập nhật:
```
PATCH /api/admin/products/:id (quyền catalog.update)
```

Shape của mỗi ảnh (`ProductImageInput`):

| Field | Bắt buộc | Ghi chú |
|-------|----------|---------|
| `url` | ✅ | URL ảnh (lấy từ endpoint AI/upload). |
| `alt` | ❌ | Văn bản thay thế (SEO/accessibility). |
| `isPrimary` | ❌ | Ảnh đại diện. Nếu không set, ảnh đầu danh sách được coi là primary. |

Ví dụ body tạo sản phẩm (rút gọn, chỉ phần ảnh):

```json
{
  "name": "Mứt Dâu Đà Lạt",
  "slug": "mut-dau-da-lat",
  "basePrice": "75000.00",
  "images": [
    { "url": "http://localhost:3002/uploads/ai-....png", "alt": "Hũ mứt dâu", "isPrimary": true }
  ],
  "variants": [ { "sku": "MUT-DAU-250G", "price": "75000.00" } ]
}
```

> Khi cập nhật, `images` là **thay thế toàn bộ** (full-replace): gửi lại đầy đủ
> danh sách ảnh muốn giữ; bỏ field `images` ra khỏi payload nếu không muốn động
> tới ảnh hiện có.

---

## 5. Luồng end-to-end (BO)

```
1. Nhân viên nhập mô tả sản phẩm  ─┐
2. POST /admin/uploads/generate    │  → nhận { url }
3. (lặp lại nếu muốn nhiều ảnh /   │     đổi prompt cho tới khi ưng)
   hoặc POST /admin/uploads upload)│
4. POST/PATCH /admin/products      ┘  → images: [{ url, isPrimary }]
5. Storefront render ảnh trực tiếp từ /uploads/*
```

Mỗi lần gọi `generate` tạo **1 ảnh**. Muốn nhiều ảnh cho một sản phẩm ⇒ gọi
nhiều lần (có thể đổi prompt/góc chụp) rồi gộp các URL vào `images[]`.

---

## 6. Ghi chú vận hành

- **Lưu trữ:** ảnh nằm ở thư mục `./uploads` (được `main.ts` tạo tự động và serve
  tĩnh tại `/uploads/*`, **ngoài** prefix `/api`). Ở production cần đảm bảo thư
  mục này bền vững (volume/disk) hoặc chuyển sang object storage.
- **Đổi nhà cung cấp AI:** tách provider nằm gọn trong `generateBytes()` của
  `ImageGenService` — đổi sang provider khác chỉ cần sửa hàm này, không đụng
  controller/DTO.
- **Chi phí:** mỗi request `generate` = 1 lần gọi API OpenAI có tính phí. Cân
  nhắc rate-limit ở tầng BO nếu cho phép “tạo lại” nhiều lần.
- **Bảo mật key:** key chỉ nằm ở server (env), không bao giờ lộ ra client.
- **Gợi ý prompt tốt:** nêu rõ *sản phẩm + bối cảnh + phong cách chụp*, ví dụ:
  “Ảnh sản phẩm \<tên\>, nền trắng/sáng, chụp studio, chính diện, độ nét cao”.
