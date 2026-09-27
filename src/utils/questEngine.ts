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
  Tag,
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
 * สร้าง Checklist ใหม่สำหรับนักเรียน จาก QuestTemplate
 * เรียกเมื่อนักเรียนเลือกเป้าหมาย university/faculty
 */
export function initializeChecklist(
  studentId: string,
  templates: QuestTemplate[],
  universityTarget?: string,
  facultyTarget?: string,
): PortfolioChecklist {
  const quests: QuestProgress[] = templates.map(template => ({
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
 *
 * Logic:
 * 1. ดู swipe history → หาค่ายที่ปัดขวา (สนใจ/เข้าร่วม)
 * 2. ดู tags ของค่ายเหล่านั้น
 * 3. เทียบกับ quest ที่ต้องการ requiredTags + requiredCount
 * 4. ถ้าครบ → mark completed, ให้ XP
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
  
  // tag → จำนวนค่ายที่ปัดขวาแล้วมี tag นี้
  const tagCounts = new Map<Tag, number>();
  // category → จำนวนค่ายที่ปัดขวา
  const swipedCampIds = new Set<string>();
  
  for (const swipe of rightSwipes) {
    const camp = campLookup.get(swipe.campId);
    if (!camp) continue;
    swipedCampIds.add(camp.id);
    
    for (const tag of camp.tags) {
      const key = tag.toLowerCase();
      tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1);
    }
  }

  // วนทุก quest ที่ยังไม่เสร็จ
  for (const questProgress of checklist.quests) {
    if (questProgress.completed) continue;

    const template = templates.find(t => t.id === questProgress.questId);
    if (!template || !template.autoCheckable) continue;

    // คำนวณ current count ตาม required tags
    let count = 0;

    if (template.requiredTags && template.requiredTags.length > 0) {
      // นับค่ายที่ปัดขวา ที่มี tag ตรงกับ requiredTags ครบทุกตัว
      for (const campId of swipedCampIds) {
        const camp = campLookup.get(campId);
        if (!camp) continue;
        
        const campTagsLower = new Set(camp.tags.map(t => t.toLowerCase()));
        const allTagsMatch = template.requiredTags.every(t => campTagsLower.has(t.toLowerCase()));
        
        if (allTagsMatch) count++;
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
