// ─── Shared Types ────────────────────────────────────────────────────────────

export type Role = 'student' | 'organizer' | 'admin';
export type Tag = string;
export type SwipeAction = 'left' | 'right' | 'super_right';
export type CampStatus = 'draft' | 'published' | 'closed';

// ─── Users ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentProfile extends User {
  role: 'student';
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  school: string;
  grade: number;
  interests: Tag[];
  skills: string[];
  portfolioScore: number;
  level: number;
  targetUniversity?: string;
  targetFaculty?: string;
}

export interface OrganizerProfile extends User {
  role: 'organizer';
  organizationName: string;
  contactEmail: string;
  website?: string;
  logoUrl?: string;
  description: string;
  verified: boolean;
}

// ─── Camps ───────────────────────────────────────────────────────────────────

export interface Camp {
  id: string;
  organizerId: string;
  title: string;
  description: string;
  coverImageUrl: string;
  tags: Tag[];
  targetGrades: number[];
  startDate: Date;
  endDate: Date;
  location: string;
  isOnline: boolean;
  applicationDeadline: Date;
  status: CampStatus;
  capacity?: number;
  cost: number;
  createdAt: Date;
  metrics: {
    views: number;
    swipesRight: number;
    applications: number;
  };
}

// ─── Swipe ───────────────────────────────────────────────────────────────────

export interface SwipeRecord {
  id: string;
  studentId: string;
  campId: string;
  action: SwipeAction;
  timestamp: Date;
}

// ─── Match Result ────────────────────────────────────────────────────────────

export interface MatchResult {
  campId: string;
  camp: Camp;
  totalScore: number;       // 0-100
  breakdown: {
    tagScore: number;       // 0-50 pts
    profileScore: number;   // 0-20 pts
    affinityScore: number;  // 0-30 pts
  };
}

// ─── Portfolio / Quest ───────────────────────────────────────────────────────

export type QuestCategory =
  | 'academic'        // ผลการเรียน
  | 'competition'     // การแข่งขัน
  | 'camp'            // ค่ายวิชาการ
  | 'volunteer'       // จิตอาสา
  | 'skill'           // ทักษะ/ใบรับรอง
  | 'project'         // โปรเจกต์
  | 'leadership';     // ภาวะผู้นำ

export interface QuestTemplate {
  id: string;
  title: string;
  description: string;
  category: QuestCategory;
  xpReward: number;
  requiredTags?: Tag[];        // ถ้ามี = auto-check เมื่อเข้าค่ายที่ tags ตรง
  requiredCount?: number;      // จำนวนครั้ง (e.g. เข้าค่ายวิชาการ 3 ค่าย)
  autoCheckable: boolean;      // true = ระบบ check อัตโนมัติจาก swipe/camp data
  universityId?: string;
  facultyId?: string;
}

export interface QuestProgress {
  questId: string;
  currentCount: number;
  completed: boolean;
  completedAt?: Date;
  proofUrl?: string;
  xpEarned: number;
}

export interface PortfolioChecklist {
  id: string;
  studentId: string;
  universityTarget?: string;
  facultyTarget?: string;
  quests: QuestProgress[];
  totalXP: number;
  level: number;
  progressPercentage: number;
  lastUpdated: Date;
}

// ─── Level Config ────────────────────────────────────────────────────────────

export interface LevelThreshold {
  level: number;
  minXP: number;
  maxXP: number;
  label: string;
  emoji: string;
  color: string;
}

export const LEVEL_THRESHOLDS: LevelThreshold[] = [
  { level: 1, minXP: 0,    maxXP: 99,       label: 'Newcomer', emoji: '🌱', color: 'from-neutral-400 to-neutral-500' },
  { level: 2, minXP: 100,  maxXP: 249,      label: 'Explorer', emoji: '🔍', color: 'from-sky-400 to-sky-600' },
  { level: 3, minXP: 250,  maxXP: 499,      label: 'Achiever', emoji: '⚡', color: 'from-brand-400 to-brand-600' },
  { level: 4, minXP: 500,  maxXP: 999,      label: 'Star',     emoji: '⭐', color: 'from-energy-400 to-energy-600' },
  { level: 5, minXP: 1000, maxXP: Infinity,  label: 'Legend',   emoji: '🏆', color: 'from-energy-400 via-brand-500 to-sky-500' },
];
