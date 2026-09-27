/**
 * ─── Portfolio Checklist Quest System ────────────────────────────────────────
 *
 * ระบบแปลงเกณฑ์รับสมัครมหาวิทยาลัย → Gamified Checklist ที่ auto-check ได้
 *
 * ─── Data Flow ──────────────────────────────────────────────────────────────
 *
 * [Admin ตั้งค่า QuestTemplate สำหรับแต่ละคณะ/มหาวิทยาลัย]
 *   → เก็บใน Firestore collection: questTemplates
 *
 * [Student เลือกเป้าหมาย (university + faculty)]
 *   → initializeChecklist(studentId, templates)
 *   → สร้าง PortfolioChecklist ใหม่ พร้อม QuestProgress ทุก quest
 *
 * [Student ปัดขวาค่ายใหม่ หรือ Organizer confirm ว่าเข้าร่วมค่ายแล้ว]
 *   → evaluateAutoQuests(checklist, studentSwipeHistory, campLookup)
 *   → ตรวจว่า quest ไหนที่ autoCheckable=true มี conditions ครบแล้วหรือยัง
 *   → ถ้าครบ → auto-check + ให้ XP
 *
 * [Manual quest]
 *   → Student upload proof → Admin/System review → completeQuest(checklist, questId)
 *
 * [ทุกครั้งที่ XP เปลี่ยน]
 *   → recalculateLevel(totalXP) → อัปเดต level + progress percentage
 */

import type {
  QuestTemplate,
  QuestProgress,
  PortfolioChecklist,
  LevelThreshold,
  SwipeRecord,
  Camp,
} from '../types/models';
import { LEVEL_THRESHOLDS } from '../types/models';

// ─── Level Calculation ───────────────────────────────────────────────────────

export function getLevelForXP(xp: number): LevelThreshold {
  return LEVEL_THRESHOLDS.find(l => xp >= l.minXP && xp <= l.maxXP) ?? LEVEL_THRESHOLDS[0];
}

export function getLevelProgress(xp: number): { level: LevelThreshold; progressPercent: number } {
  const level = getLevelForXP(xp);
  const range = level.maxXP === Infinity ? 1000 : level.maxXP - level.minXP + 1;
  const progressPercent = Math.min(((xp - level.minXP) / range) * 100, 100);
  return { level, progressPercent };
}

// ─── Initialize Checklist ────────────────────────────────────────────────────

/**
 * สร้าง Quest Templates ตามเป้าหมายคณะและมหาวิทยาลัยของนักเรียน
 */
export function getQuestTemplatesForStudent(
  universityTarget?: string,
  facultyTarget?: string,
): QuestTemplate[] {
  const fac = (facultyTarget || '').toLowerCase();
  
  const facultySpecificQuests: QuestTemplate[] = [];

  if (fac.includes('แพทย์') || fac.includes('หมอ') || fac.includes('พยาบาล') || fac.includes('ทันตะ') || fac.includes('สาธารณสุข')) {
    facultySpecificQuests.push(
      {
        id: 'quest-fac-01',
        title: 'สำรวจค่ายสายแพทย์ & สุขภาพ',
        description: 'ปัดขวา (สนใจ) ค่ายด้านการแพทย์ ชีววิทยา หรือวิทยาศาสตร์สุขภาพ 1 ค่าย',
        category: 'camp',
        xpReward: 80,
        requiredTags: ['Medicine', 'Health', 'Biology', 'Science'],
        requiredCount: 1,
        autoCheckable: true,
      },
      {
        id: 'quest-fac-02',
        title: 'กิจกรรมจิตอาสาโรงพยาบาล/ชุมชน',
        description: 'เข้าร่วมกิจกรรมบำเพ็ญประโยชน์ หรือค่ายอาสาสมัครด้านสาธารณสุข',
        category: 'volunteer',
        xpReward: 100,
        requiredTags: ['Social', 'Health', 'Leadership'],
        requiredCount: 1,
        autoCheckable: true,
      }
    );
  } else if (fac.includes('บริหาร') || fac.includes('บัญชี') || fac.includes('เศรษฐ') || fac.includes('การตลาด') || fac.includes('ธุรกิจ')) {
    facultySpecificQuests.push(
      {
        id: 'quest-fac-01',
        title: 'สำรวจค่ายแผนธุรกิจ & Startup',
        description: 'ปัดขวา (สนใจ) ค่ายด้านบริหารธุรกิจ นวัตกรรม หรือการเงิน 1 ค่าย',
        category: 'camp',
        xpReward: 80,
        requiredTags: ['Business', 'Management', 'Innovation'],
        requiredCount: 1,
        autoCheckable: true,
      },
      {
        id: 'quest-fac-02',
        title: 'แข่งขันแผนธุรกิจหรือเวทีผู้นำเยาวชน',
        description: 'เข้าร่วมการแข่งขัน Case Competition หรือค่ายพัฒนาภาวะผู้นำ',
        category: 'competition',
        xpReward: 120,
        requiredTags: ['Competition', 'Leadership'],
        requiredCount: 1,
        autoCheckable: true,
      }
    );
  } else if (fac.includes('ศิลป') || fac.includes('ออก') || fac.includes('สถาปัตย์') || fac.includes('นิเทศ')) {
    facultySpecificQuests.push(
      {
        id: 'quest-fac-01',
        title: 'สำรวจค่ายด้านการออกแบบ & ครีเอทีฟ',
        description: 'ปัดขวา (สนใจ) ค่ายศิลปะ ครีเอทีฟโค้ดดิ้ง หรือออกแบบ 1 ค่าย',
        category: 'camp',
        xpReward: 80,
        requiredTags: ['Design', 'Art', 'Creative'],
        requiredCount: 1,
        autoCheckable: true,
      },
      {
        id: 'quest-fac-02',
        title: 'สร้างสรรค์ผลงานชิ้นเอก (Masterpiece)',
        description: 'จัดทำผลงานศิลปะ การออกแบบ หรือสื่อสร้างสรรค์ลงในพอร์ต',
        category: 'project',
        xpReward: 100,
        requiredCount: 1,
        autoCheckable: false,
      }
    );
  } else {
    // Default: วิศวกรรม & เทคโนโลยี / STEM
    facultySpecificQuests.push(
      {
        id: 'quest-fac-01',
        title: 'สำรวจค่ายวิศวกรรม & เทคโนโลยี',
        description: 'ปัดขวา (สนใจ) ค่ายหุ่นยนต์ โค้ดดิ้ง หรือ STEM 1 ค่าย',
        category: 'camp',
        xpReward: 80,
        requiredTags: ['Technology', 'Robotics', 'Science'],
        requiredCount: 1,
        autoCheckable: true,
      },
      {
        id: 'quest-fac-02',
        title: 'เข้าร่วมการแข่งขันวิชาการหรือโอลิมปิก',
        description: 'เข้าร่วมแข่งขัน Hackathon, Science Fair หรือการแข่งขันทักษะวิชาการ',
        category: 'competition',
        xpReward: 120,
        requiredTags: ['Competition', 'Math', 'Academic'],
        requiredCount: 1,
        autoCheckable: true,
      }
    );
  }

  // Core General Quests for all students
  const coreQuests: QuestTemplate[] = [
    {
      id: 'quest-core-01',
      title: 'ก้าวแรกสู่อนาคต: สำรวจค่ายที่ใช่',
      description: 'ปัดขวา (สนใจ) ค่ายใดก็ได้เพื่อเริ่มเก็บสะสมกิจกรรมลงพอร์ต 1 ค่าย',
      category: 'camp',
      xpReward: 50,
      requiredCount: 1,
      autoCheckable: true,
    },
    {
      id: 'quest-core-02',
      title: 'สร้างฐานพอร์ตฟอลิโอ: เลือกค่าย 3 ค่าย',
      description: 'ปัดขวาค่ายที่สนใจรวม 3 ค่าย เพื่อเพิ่มโอกาสในการติดรอบ Portfolio',
      category: 'camp',
      xpReward: 70,
      requiredCount: 3,
      autoCheckable: true,
    },
    {
      id: 'quest-core-03',
      title: 'พัฒนาทักษะความเป็นผู้นำและการสื่อสาร',
      description: 'เข้าร่วมค่ายหรือเวิร์กช็อปที่มีเนื้อหาด้าน Leadership หรือการทำงานเป็นทีม',
      category: 'leadership',
      xpReward: 60,
      requiredTags: ['Leadership', 'Communication', 'Social'],
      requiredCount: 1,
      autoCheckable: true,
    },
    {
      id: 'quest-core-04',
      title: 'ตรวจเช็คเกณฑ์และเตรียมเอกสาร Portfolio',
      description: `ตรวจสอบเกณฑ์คุณสมบัติของ ${universityTarget || 'มหาวิทยาลัยเป้าหมาย'} และอัปโหลดดราฟต์พอร์ต`,
      category: 'project',
      xpReward: 100,
      requiredCount: 1,
      autoCheckable: false,
    },
    {
      id: 'quest-core-05',
      title: 'สะสมชั่วโมงกิจกรรมเพื่อสังคม (Social Impact)',
      description: 'ทำกิจกรรมจิตอาสาหรือเข้าร่วมกิจกรรมช่วยเหลือสังคมอย่างน้อย 1 กิจกรรม',
      category: 'volunteer',
      xpReward: 70,
      requiredTags: ['Social', 'Leadership'],
      requiredCount: 1,
      autoCheckable: true,
    },
  ];

  return [...facultySpecificQuests, ...coreQuests];
}

/**
 * สร้าง Checklist ใหม่สำหรับนักเรียน จาก QuestTemplate ที่สอดคล้องกับเป้าหมาย
 */
export function initializeChecklist(
  studentId: string,
  templates?: QuestTemplate[],
  universityTarget?: string,
  facultyTarget?: string,
): PortfolioChecklist {
  const activeTemplates = (templates && templates.length > 0)
    ? templates
    : getQuestTemplatesForStudent(universityTarget, facultyTarget);

  const quests: QuestProgress[] = activeTemplates.map(template => ({
    questId: template.id,
    currentCount: 0,
    completed: false,
    xpEarned: 0,
  }));

  return {
    id: studentId,
    studentId,
    universityTarget,
    facultyTarget,
    quests,
    totalXP: 0,
    level: 1,
    progressPercentage: 0,
    lastUpdated: new Date(),
  };
}

// ─── Auto-Check Evaluation ───────────────────────────────────────────────────

interface AutoCheckResult {
  updatedChecklist: PortfolioChecklist;
  newlyCompleted: Array<{
    quest: QuestTemplate;
    xpEarned: number;
  }>;
  leveledUp: boolean;
  previousLevel: number;
}

/**
 * ตรวจสอบและ auto-check quests ที่ทำครบตามเงื่อนไขแล้ว
 */
export function evaluateAutoQuests(
  checklist: PortfolioChecklist,
  templates: QuestTemplate[],
  swipeHistory: SwipeRecord[],
  campLookup: Map<string, Camp>,
): AutoCheckResult {
  const previousLevel = checklist.level;
  const newlyCompleted: AutoCheckResult['newlyCompleted'] = [];

  // นับค่ายที่ปัดขวา จัดกลุ่มตาม tag
  const rightSwipes = swipeHistory.filter(s => s.action === 'right' || s.action === 'super_right');
  
  const swipedCampIds = new Set<string>();
  for (const swipe of rightSwipes) {
    if (campLookup.has(swipe.campId)) {
      swipedCampIds.add(swipe.campId);
    }
  }

  // วนทุก quest
  for (const questProgress of checklist.quests) {
    const template = templates.find(t => t.id === questProgress.questId);
    if (!template || !template.autoCheckable) continue;

    // คำนวณ current count ตาม required tags
    let count = 0;

    if (template.requiredTags && template.requiredTags.length > 0) {
      for (const campId of swipedCampIds) {
        const camp = campLookup.get(campId);
        if (!camp) continue;
        
        const campTagsLower = new Set(camp.tags.map(t => t.toLowerCase()));
        const reqLower = template.requiredTags.map(t => t.toLowerCase());
        const hasMatch = reqLower.some(rt => campTagsLower.has(rt));
        if (hasMatch) count++;
      }
    } else {
      // ไม่ระบุ tag → นับจำนวนค่ายที่ปัดขวาทั้งหมด
      count = swipedCampIds.size;
    }

    questProgress.currentCount = count;

    // เช็คว่าครบ requiredCount หรือยัง
    const required = template.requiredCount ?? 1;
    if (count >= required && !questProgress.completed) {
      questProgress.completed = true;
      questProgress.completedAt = new Date();
      questProgress.xpEarned = template.xpReward;

      newlyCompleted.push({
        quest: template,
        xpEarned: template.xpReward,
      });
    }
  }

  // คำนวณ XP รวมใหม่
  checklist.totalXP = checklist.quests.reduce((sum, q) => sum + q.xpEarned, 0);

  // คำนวณ Level ใหม่
  const { level, progressPercent } = getLevelProgress(checklist.totalXP);
  checklist.level = level.level;
  checklist.progressPercentage = Math.round(progressPercent);
  checklist.lastUpdated = new Date();

  return {
    updatedChecklist: checklist,
    newlyCompleted,
    leveledUp: checklist.level > previousLevel,
    previousLevel,
  };
}

// ─── Manual Quest Completion ─────────────────────────────────────────────────

/**
 * Complete a quest manually (เช่น upload ผลงาน, ส่งหลักฐาน)
 */
export function completeManualQuest(
  checklist: PortfolioChecklist,
  template: QuestTemplate,
  proofUrl?: string,
): PortfolioChecklist {
  const questProgress = checklist.quests.find(q => q.questId === template.id);
  if (!questProgress || questProgress.completed) return checklist;

  questProgress.completed = true;
  questProgress.completedAt = new Date();
  questProgress.xpEarned = template.xpReward;
  questProgress.proofUrl = proofUrl;
  questProgress.currentCount = template.requiredCount ?? 1;

  // Recalculate totals
  checklist.totalXP = checklist.quests.reduce((sum, q) => sum + q.xpEarned, 0);
  const { level, progressPercent } = getLevelProgress(checklist.totalXP);
  checklist.level = level.level;
  checklist.progressPercentage = Math.round(progressPercent);
  checklist.lastUpdated = new Date();

  return checklist;
}

// ─── Progress Summary ────────────────────────────────────────────────────────

export interface ChecklistSummary {
  totalQuests: number;
  completedQuests: number;
  progressPercent: number;
  totalXP: number;
  level: LevelThreshold;
  levelProgress: number;
  byCategory: Map<string, { total: number; completed: number }>;
}

export function getChecklistSummary(
  checklist: PortfolioChecklist,
  templates: QuestTemplate[],
): ChecklistSummary {
  const byCategory = new Map<string, { total: number; completed: number }>();

  for (const template of templates) {
    const cat = template.category;
    if (!byCategory.has(cat)) {
      byCategory.set(cat, { total: 0, completed: 0 });
    }
    const entry = byCategory.get(cat)!;
    entry.total++;

    const progress = checklist.quests.find(q => q.questId === template.id);
    if (progress?.completed) {
      entry.completed++;
    }
  }

  const completedQuests = checklist.quests.filter(q => q.completed).length;
  const { level, progressPercent } = getLevelProgress(checklist.totalXP);

  return {
    totalQuests: templates.length,
    completedQuests,
    progressPercent: templates.length > 0 ? Math.round((completedQuests / templates.length) * 100) : 0,
    totalXP: checklist.totalXP,
    level,
    levelProgress: progressPercent,
    byCategory,
  };
}
