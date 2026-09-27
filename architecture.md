# Student Portfolio - Architecture & Design

โปรเจกต์ "Student Portfolio" (เดิมชื่อ Swift Port) สร้างด้วย React + TypeScript + Tailwind CSS + Firebase (Firestore + Auth)

## 1. Firestore Data Model (TypeScript Schema)

ระบบแบ่งออกเป็น 2 Role หลักคือ Student และ Organizer โครงสร้าง Database ออกแบบเป็น NoSQL Collection ดังนี้

```typescript
type Role = 'student' | 'organizer' | 'admin';
type Tag = string; // เช่น "Science", "Math", "Leadership", "Online"

// Collection: users
interface User {
  id: string; // Firebase Auth UID
  email: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

// Collection: users (Document ย่อยตาม Role หรือเก็บฟิลด์รวมกัน)
interface StudentProfile extends User {
  role: 'student';
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  school: string;
  grade: number; // เช่น 10, 11, 12 (ม.4, ม.5, ม.6)
  interests: Tag[]; // สำหรับ Matching
  skills: string[];
  portfolioScore: number; // คะแนน Gamification
  level: number;
}

interface OrganizerProfile extends User {
  role: 'organizer';
  organizationName: string;
  contactEmail: string;
  website?: string;
  logoUrl?: string;
  description: string;
  verified: boolean;
}

// Collection: camps
type CampStatus = 'draft' | 'published' | 'closed';

interface Camp {
  id: string;
  organizerId: string;
  title: string;
  description: string;
  coverImageUrl: string;
  tags: Tag[]; // สำหรับ Matching
  startDate: Date;
  endDate: Date;
  location: string; // หรือ URL ถ้าเป็น Online
  isOnline: boolean;
  applicationDeadline: Date;
  status: CampStatus;
  capacity?: number;
  cost: number; // 0 = Free
  createdAt: Date;
  metrics: {
    views: number;
    swipesRight: number;
    applications: number;
  }
}

// Collection: swipeHistory
type SwipeAction = 'left' | 'right' | 'super_right';

interface SwipeHistory {
  id: string;
  studentId: string;
  campId: string;
  action: SwipeAction;
  timestamp: Date;
}

// Collection: portfolioChecklist
interface QuestStatus {
  taskId: string;
  completed: boolean;
  completedAt?: Date;
  proofUrl?: string; // หลักฐานการทำ Quest
}

interface PortfolioChecklist {
  id: string; // ปกติใช้ studentId เป็น ID
  studentId: string;
  universityTarget?: string; // มหาวิทยาลัยเป้าหมาย
  facultyTarget?: string; // คณะเป้าหมาย
  progressPercentage: number;
  quests: QuestStatus[];
  lastUpdated: Date;
}

// Collection: adListings
interface AdListing {
  id: string;
  organizerId: string;
  campId?: string; // ผูกกับแคมป์ หรืออาจเป็นลิงก์ภายนอก
  imageUrl: string;
  targetUrl: string;
  startDate: Date;
  endDate: Date;
  budget: number;
  impressions: number;
  clicks: number;
  isActive: boolean;
}
```

## 2. Route & Page Structure

โครงสร้างเส้นทาง (Routing) แบ่งตามผู้ใช้งานอย่างชัดเจน:

- `/` - **Landing Page** (หน้าแนะนำแอปพลิเคชัน)
- `/login` - **Login / Signup** (เข้าสู่ระบบ)
- `/role-select` - **Role Selection** (เลือกบทบาท Student หรือ Organizer หลังสมัครสมาชิกครั้งแรก)
- `/app` (โซนของ **Student**)
  - `/app/explore` - **Explore/Swipe** (หน้าปัดการ์ดหาแคมป์แบบ Tinder ซ้าย/ขวา)
  - `/app/feed` - **Feed** (หน้าฟีดรวมแคมป์ที่สนใจ, รายการที่ Match, ข่าวสาร)
  - `/app/checklist` - **Checklist Quest** (หน้าสะสมพอร์ตแบบ Gamification, เควสต์)
  - `/app/profile` - **Student Profile** (จัดการข้อมูลพอร์ต)
- `/organizer` (โซนของ **Organizer**)
  - `/organizer/dashboard` - **Dashboard** (ภาพรวม Analytics, สถิติการเข้าชมและ Swipe)
  - `/organizer/camps` - **Manage Camps** (ดูรายการค่ายทั้งหมดที่ตัวเองจัด)
  - `/organizer/camps/new` - **Create Camp** (ลงข้อมูลค่ายใหม่)
  - `/organizer/ads` - **Ad Management** (จัดการโฆษณา)
  - `/organizer/profile` - **Organizer Profile** (แก้ไขข้อมูลองค์กร)

## 3. Matching Algorithm (Initial Version)

แนวทางการจับคู่แบบไม่ใช้ ML model ในเวอร์ชันแรก เพื่อความรวดเร็วและใช้ Resource น้อย จะใช้วิธีคำนวณ **Match Score (0-100%)** ระหว่าง Student กับ Camp:

**ปัจจัยที่นำมาคำนวณ:**
1. **Tag Intersection (น้ำหนัก 50%)**: ดูความตรงกันของ `camp.tags` กับ `student.interests`
   - *คำนวณ:* `(จำนวน Tag ที่ตรงกัน / จำนวน Tag ทั้งหมดของค่าย) * 50`
2. **Grade & Location Preference (น้ำหนัก 20%)**: ตรวจสอบว่าค่ายเหมาะกับระดับชั้นของนักเรียนหรือไม่ และความต้องการเรื่องสถานที่ (Online/Onsite) ตรงกันไหม
3. **Swipe History Feedback Loop (น้ำหนัก 30%)**:
   - เมื่อนักเรียนปัดขวา (Right Swipe) ในค่ายที่มี Tag ไหนบ่อยๆ ระบบจะเพิ่มคะแนน "ความชอบ (Affinity)" ของ Tag นั้นๆ ให้นักเรียน
   - *ตัวอย่าง:* ปัดขวาค่าย "Science" 5 ครั้ง คะแนนความชอบค่าย Science จะสูงขึ้น ค่ายใหม่ๆ ที่มี Tag "Science" จะได้คะแนนในส่วนนี้ไปเต็มๆ
   - *คำนวณ:* `(คะแนนสะสม Tag ของค่ายนั้น จากประวัติการปัดขวา) * 30`

**การนำไปใช้งาน:** 
- ในหน้า `/app/explore` ระบบจะ Query ค่ายที่นักเรียน **ยังไม่เคยปัด (ไม่อยู่ใน SwipeHistory)** 
- นำมาคำนวณ Match Score ฝั่ง Client หรือ Edge Function
- เรียงลำดับค่ายจากคะแนนมากไปน้อย เพื่อแสดงให้นักเรียนเห็นค่ายที่ตรงใจที่สุดก่อน

## 4. Reusable Components Structure

โครงสร้าง Component หลักที่ใช้บ่อยในโปรเจกต์:

- `ui/` (ส่วน UI พื้นฐาน)
  - `Button`, `Input`, `Modal`, `Card`, `Badge`, `ProgressBar`, `Tabs`
- `swipe/` (เฉพาะหน้า Explore)
  - `SwipeCard` (การ์ดหลักที่สามารถ Drag ปัดซ้ายขวาได้ - อาจใช้ไลบรารีอย่าง `framer-motion`)
  - `SwipeButtons` (ปุ่ม X, หัวใจ หรือ Super Like สำหรับคนที่ไม่อยากปัด)
- `camps/` (เกี่ยวกับแคมป์)
  - `CampCard` (การ์ดแสดงรายละเอียดค่ายในหน้า Feed แบบนิ่งๆ)
  - `CampDetailModal` (คลิกเพื่อดูรายละเอียดเชิงลึกของค่าย)
- `portfolio/` (เกี่ยวกับการสะสมพอร์ต)
  - `QuestItem` (แต่ละแถวในหน้า Checklist เช่น "ส่งเกรดเฉลี่ย", "เข้าร่วมค่ายวิชาการ 1 ค่าย")
  - `LevelBadge` (โชว์เลเวลของนักเรียน)
- `layout/` (โครงสร้างหน้า)
  - `Navbar` (แถบด้านบน)
  - `Sidebar` (แถบด้านข้างสำหรับ Organizer)
  - `BottomNav` (แถบด้านล่างสำหรับ Student บนหน้าจอมือถือ)
- `auth/` (เกี่ยวกับผู้ใช้)
  - `ProtectedRoute` (กันไม่ให้คนไม่ได้ล็อกอินเข้า)
  - `RoleRoute` (แยกสิทธิ์ Student เข้าของ Organizer ไม่ได้)

## 5. File / Folder Structure

แผนผังไฟล์และโฟลเดอร์สำหรับ React + Vite + TypeScript:

```text
src/
├── assets/            # รูปภาพ, ไอคอน
├── components/        # Reusable React components (แบ่งหมวดหมู่ตามข้อ 4)
│   ├── ui/
│   ├── layout/
│   ├── swipe/
│   └── ...
├── config/            # ตั้งค่า Firebase (firebase.ts)
├── context/           # React Context (AuthContext, ThemeContext)
├── hooks/             # Custom Hooks (useAuth, useCamps, useSwipe, useMatching)
├── pages/             # หน้าต่างๆ ในแอป
│   ├── auth/          # Login.tsx, Signup.tsx, RoleSelect.tsx
│   ├── student/       # Explore.tsx, Feed.tsx, Checklist.tsx, Profile.tsx
│   ├── organizer/     # Dashboard.tsx, ManageCamps.tsx, CreateCamp.tsx, ManageAds.tsx
│   └── public/        # Landing.tsx
├── services/          # ไฟล์เรียก Firebase API (CampsService, UsersService)
├── store/             # Global state (ถ้าใช้ Zustand/Redux)
├── types/             # ไฟล์รวม TypeScript Interfaces (models.ts)
├── utils/             # Helper functions (matchingAlgo.ts, dateFormats.ts)
├── App.tsx            # จัดการ Routing หลัก
└── main.tsx           # Entry point
```
