// ─── Shared Types ────────────────────────────────────────────────────────────

export type Role = 'student' | 'organizer' | 'admin';
export type Tag = string;
export type SwipeAction = 'left' | 'right' | 'super_right';
export type CampStatus = 'draft' | 'published' | 'closed';

// ─── Ad Listing Types ─────────────────────────────────────────────────────────

export type AdStatus = 'pending' | 'approved' | 'active' | 'rejected' | 'expired';
export type AdPlacement =
  | 'feed_featured'   // การ์ดพิเศษใน Feed (ระหว่างการ์ดค่าย)
  | 'explore_banner'  // Banner ด้านบนหน้า Explore
  | 'sidebar_right'   // Sidebar ขวาในหน้า Feed (Desktop)
  | 'checklist_cta';  // CTA Card ในหน้า Checklist

export type AdPackage = {
  id: string;
  name: string;
  placement: AdPlacement;
  durationDays: number;
  price: number;         // THB
  impressionsEst: number; // ประมาณการ impressions ต่อวัน
  description: string;
};

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

// ─── Application ─────────────────────────────────────────────────────────────

export type ApplicationStatus = 'applied' | 'reviewed' | 'accepted' | 'rejected' | 'waitlisted';

export interface ApplicantInfo {
  fullName: string;
  nickname: string;
  phone: string;
  lineId: string;
  school: string;
  grade: number;
  parentName: string;
  parentPhone: string;
  foodAllergies?: string;
  shirtSize?: 'S' | 'M' | 'L' | 'XL' | '2XL';
  motivation?: string;
}

export type PaymentMethod = 'promptpay' | 'credit_card' | 'truemoney' | 'free';
export type PaymentStatus = 'paid' | 'pending' | 'free';

export interface PaymentDetails {
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  orderId: string;
  slipUrl?: string;
  paidAt?: Date;
  refNumber?: string;
}

export interface CampApplication {
  id: string;
  studentId: string;
  campId: string;
  campTitle: string;
  campCoverImageUrl: string;
  status: ApplicationStatus;
  appliedAt: Date;
  updatedAt: Date;
  note?: string;
  applicantInfo?: ApplicantInfo;
  payment?: PaymentDetails;
}

// ─── Match Result ────────────────────────────────────────────────────────────

export interface MatchResult {
  campId: string;
  camp: Camp;
  totalScore: number;
  breakdown: {
    tagScore: number;
    profileScore: number;
    affinityScore: number;
  };
}

// ─── Portfolio / Quest ───────────────────────────────────────────────────────

export type QuestCategory =
  | 'academic'
  | 'competition'
  | 'camp'
  | 'volunteer'
  | 'skill'
  | 'project'
  | 'leadership';

export interface QuestTemplate {
  id: string;
  title: string;
  description: string;
  category: QuestCategory;
  xpReward: number;
  requiredTags?: Tag[];
  requiredCount?: number;
  autoCheckable: boolean;
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

// ─── Ad Listing ──────────────────────────────────────────────────────────────

export interface AdListing {
  id: string;
  organizerId: string;
  organizerName: string;

  // Package info (snapshot at purchase time)
  packageId: string;
  packageName: string;
  placement: AdPlacement;

  // Creative content (กรอกโดย organizer)
  title: string;
  description: string;
  imageUrl: string;
  targetUrl: string;
  ctaText: string;         // Call-to-action button label

  // Schedule
  startDate: Date;
  endDate: Date;

  // Status workflow
  status: AdStatus;
  rejectionReason?: string;
  approvedAt?: Date;
  approvedBy?: string;     // admin UID

  // Financials
  totalCost: number;       // THB
  paid: boolean;
  paidAt?: Date;

  // Performance metrics (updated by system)
  metrics: {
    impressions: number;
    clicks: number;
    ctr: number;           // Click-through rate %
  };

  createdAt: Date;
  updatedAt: Date;
}

// ─── Ad Form (input before saving to Firestore) ───────────────────────────────

export interface AdListingForm {
  packageId: string;
  title: string;
  description: string;
  imageUrl: string;
  targetUrl: string;
  ctaText: string;
  startDate: string;   // ISO date string from <input type="date">
  endDate: string;
}

// ─── Ad Packages Config (can also live in Firestore) ─────────────────────────

export const AD_PACKAGES: AdPackage[] = [
  {
    id: 'pkg-feed-7',
    name: 'Feed Featured (7 วัน)',
    placement: 'feed_featured',
    durationDays: 7,
    price: 990,
    impressionsEst: 800,
    description: 'การ์ดโฆษณาแทรกในหน้า Feed ทุกๆ 5 การ์ด — เห็นได้ทุก session',
  },
  {
    id: 'pkg-feed-30',
    name: 'Feed Featured (30 วัน)',
    placement: 'feed_featured',
    durationDays: 30,
    price: 2990,
    impressionsEst: 800,
    description: 'Feed Featured แบบรายเดือน — ประหยัดกว่า 30%',
  },
  {
    id: 'pkg-explore-banner-7',
    name: 'Explore Banner (7 วัน)',
    placement: 'explore_banner',
    durationDays: 7,
    price: 1490,
    impressionsEst: 1200,
    description: 'Banner ด้านบนหน้า Explore/Swipe — ทุกคนที่มาหาค่ายเห็นแน่ๆ',
  },
  {
    id: 'pkg-checklist-cta',
    name: 'Checklist CTA (14 วัน)',
    placement: 'checklist_cta',
    durationDays: 14,
    price: 790,
    impressionsEst: 500,
    description: 'CTA Card ในหน้า Quest Checklist — ตรงถึงนักเรียนที่กำลังสะสมพอร์ต',
  },
];
