# ระบบเว็บอัปโหลดไฟล์เข้า Google Drive แบบไม่จำกัดขนาดไฟล์ (Resumable Direct Upload)

โปรเจกต์หน้าเว็บสำหรับให้ผู้ใช้ทั่วไปสามารถอัปโหลดไฟล์หลายไฟล์พร้อมกัน (Multi-file & Drag-and-Drop) เข้าสู่โฟลเดอร์กลางบน Google Drive ของคุณได้โดยไม่ต้องล็อกอินบัญชี Google และ **ไม่จำกัดขนาดไฟล์** (รองรับไฟล์ขนาดใหญ่ระดับ GB / TB สูงสุดตามพื้นที่ว่างใน Google Drive ของคุณ)

## จุดเด่นของระบบ
- **ไม่จำกัดขนาดไฟล์ (Unlimited File Size):** ใช้เทคนิค **Google Drive Resumable Upload API** โดยให้ Google Apps Script สร้างลิงก์เซสชันอัปโหลดเฉพาะไฟล์นั้นๆ แล้วส่งไฟล์ตรงจากเบราว์เซอร์เข้า Google Drive โดยไม่ติดเพดาน 50 MB ของ Google Apps Script
- **ปลอดภัย:** ไม่มีการส่ง OAuth Access Token ออกมาที่หน้าเว็บ (สร้างเฉพาะ Resumable Upload Session URL เท่านั้น)
- **Real-time Progress Bar:** แสดงเปอร์เซ็นต์ความคืบหน้า (0% - 100%) และจำนวน MB/GB ที่ส่งไปแล้วของแต่ละไฟล์แบบเรียลไทม์

---

## วิธีติดตั้งและเชื่อมต่อกับ Google Drive

### ขั้นตอนที่ 1: เตรียมโฟลเดอร์ใน Google Drive
1. เปิด [Google Drive](https://drive.google.com/) แล้วสร้างโฟลเดอร์สำหรับเก็บไฟล์
2. เปิดเข้าไปในโฟลเดอร์นั้น แล้วดูที่ URL ด้านบน เช่น:
   `https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j`
3. คัดลอกรหัสหลังคำว่า `folders/` เก็บไว้ (นี่คือ **Folder ID**)

### ขั้นตอนที่ 2: สร้าง Google Apps Script Web App
1. ไปที่ [script.google.com](https://script.google.com/) แล้วกด **New project (โครงการใหม่)**
2. ลบโค้ดเดิมใน `Code.gs` ออกทั้งหมด แล้วคัดลอกโค้ดจากไฟล์ `Code.gs` ในโปรเจกต์นี้ไปวางแทน
3. นำ **Folder ID** จากขั้นตอนที่ 1 ไปใส่แทนที่ `PUT_YOUR_FOLDER_ID_HERE` (บรรทัดที่ 13)
4. กดปุ่ม **Deploy (การทำให้ใช้งานได้)** มุมขวาบน > เลือก **New deployment (การทำให้ใช้งานได้รายการใหม่)**
5. คลิกไอคอนรูปเฟืองข้างคำว่า *Select type* แล้วเลือก **Web app (เว็บแอป)**
6. ตั้งค่าดังนี้:
   - **Execute as (ดำเนินการในฐานะ):** `Me` (บัญชีของคุณเอง)
   - **Who has access (ผู้ที่มีสิทธิ์เข้าถึง):** `Anyone` (ทุกคน)
7. กด **Deploy** (ระบบจะขอสิทธิ์เข้าถึง Google Drive ให้กด *Authorize access* > *Advanced* > *Go to Untitled project (unsafe)* > *Allow*)
8. คัดลอก **Web App URL** ที่ลงท้ายด้วย `/exec` เก็บไว้

### ขั้นตอนที่ 3: นำ Web App URL มาใส่ในหน้าเว็บ
- กดปุ่ม **"ตั้งค่า API"** มุมขวาบนของหน้าเว็บ แล้ววาง **Web App URL** ลงไปและกดบันทึก
- หรือใส่ถาวรในไฟล์ `app.js` ที่ตัวแปร `DEFAULT_CONFIG.scriptUrl` (บรรทัดที่ 5)
