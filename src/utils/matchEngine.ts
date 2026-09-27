/**
 * ─── Persistent Match Engine ────────────────────────────────────────────────
 *
 * Weighted Scoring Algorithm (ไม่ใช้ ML):
 *
 * Total Match Score = Tag Score (50%) + Profile Score (20%) + Affinity Score (30%)
 *
 * 1. Tag Score (0-50 pts):
 *    Intersection ระหว่าง camp.tags กับ student.interests
 *    Formula: (matched_tags / total_camp_tags) × 50
 *
 * 2. Profile Score (0-20 pts):
 *    - Grade match: ถ้า student.grade อยู่ใน camp.targetGrades → +10
 *    - Location preference: ถ้าค่ายเป็น Online (ซึ่งทุกคนเข้าได้) → +5
 *    - Cost: ฟรี → +5, ไม่ฟรี → +2
 *
 * 3. Affinity Score (0-30 pts):
 *    วิเคราะห์ SwipeHistory: ค่ายไหนที่ปัดขวามีแท็กอะไรบ้าง
 *    สร้าง "affinity map" (tag → cumulative weight)
 *    แล้วเทียบกับ tags ของค่ายใหม่
 *    Formula: (sum of affinity weights for matching tags / max possible affinity) × 30
 *
 * ─── Data Flow ──────────────────────────────────────────────────────────────
 *
 * [Student Opens Explore Page]
 *   → fetchAvailableCamps() — camps ที่ยังไม่เคย swipe
 *   → buildAffinityMap(swipeHistory, allCamps) — สร้าง tag affinity จากประวัติ
 *   → computeMatchScores(student, camps, affinityMap) — คำนวณ % match ทุกค่าย
 *   → sort by score desc → แสดงผล
 *
 * [Student Swipes] → บันทึก SwipeHistory → re-rank ใหม่ทันทีในหน้า
 *
 * เหมาะกับ Client-side ในเวอร์ชันแรก (ข้อมูลน้อย):
 *   - ค่ายไม่เกินหลักร้อย → loop ได้สบาย
 *   - ถ้า scale → ย้ายไป Cloud Function หรือ Firestore Trigger
 */

import type {
  StudentProfile,
  Camp,
  SwipeRecord,
  MatchResult,
  Tag,
} from '../types/models';

// ─── Affinity Map ────────────────────────────────────────────────────────────
// tag → number (weight สะสมจากการปัดขวา)
export type AffinityMap = Map<Tag, number>;

/**
 * สร้าง Affinity Map จาก Swipe History ของนักเรียน
 *
 * วิธีคิด:
 * - ปัดขวา (right)        → +1 ต่อ tag ของค่ายนั้น
 * - ปัดขวาพิเศษ (super)   → +2 ต่อ tag
 * - ปัดซ้าย (left)        → -0.3 ต่อ tag (ลดน้ำหนักเล็กน้อย)
 *
 * ผลลัพธ์: Map ของ tag → คะแนน affinity สะสม
 */
export function buildAffinityMap(
  history: SwipeRecord[],
  campLookup: Map<string, Camp>
): AffinityMap {
  const affinity: AffinityMap = new Map();

  for (const record of history) {
    const camp = campLookup.get(record.campId);
    if (!camp) continue;

    const weight =
      record.action === 'super_right' ? 2 :
      record.action === 'right'       ? 1 :
      -0.3; // left

    for (const tag of camp.tags) {
      const current = affinity.get(tag) ?? 0;
      affinity.set(tag, Math.max(0, current + weight)); // ไม่ให้ติดลบ
    }
  }

  return affinity;
}

// ─── Tag Score (0-50) ────────────────────────────────────────────────────────

function computeTagScore(student: StudentProfile, camp: Camp): number {
  if (camp.tags.length === 0) return 25; // ไม่มี tag = ให้กลางๆ

  const studentTags = new Set(student.interests.map(t => t.toLowerCase()));
  const matched = camp.tags.filter(t => studentTags.has(t.toLowerCase()));

  return (matched.length / camp.tags.length) * 50;
}

// ─── Profile Score (0-20) ────────────────────────────────────────────────────

function computeProfileScore(student: StudentProfile, camp: Camp): number {
  let score = 0;

  // Grade match (+10)
  if (camp.targetGrades.length === 0 || camp.targetGrades.includes(student.grade)) {
    score += 10;
  }

  // Online bonus (+5) — ทุกคนเข้าได้
  if (camp.isOnline) {
    score += 5;
  }

  // Cost: ฟรี → +5, ไม่ฟรี → +2
  score += camp.cost === 0 ? 5 : 2;

  return score;
}

// ─── Affinity Score (0-30) ───────────────────────────────────────────────────

function computeAffinityScore(camp: Camp, affinityMap: AffinityMap): number {
  if (affinityMap.size === 0) return 15; // ไม่มีประวัติ = กลางๆ

  // หาค่า max affinity เพื่อ normalize
  let maxAffinity = 0;
  for (const value of affinityMap.values()) {
    maxAffinity = Math.max(maxAffinity, value);
  }
  if (maxAffinity === 0) return 15;

  // คำนวณ affinity score ของค่ายนี้
  let campAffinity = 0;
  for (const tag of camp.tags) {
    campAffinity += affinityMap.get(tag.toLowerCase()) ?? 0;
  }

  // Normalize: คะแนนรวมเทียบกับ (จำนวน tag ของค่าย × max affinity)
  const maxPossible = camp.tags.length * maxAffinity;
  if (maxPossible === 0) return 15;

  return Math.min(30, (campAffinity / maxPossible) * 30);
}

// ─── Main Match Function ─────────────────────────────────────────────────────

/**
 * คำนวณ Match Score สำหรับค่ายทั้งหมดที่ยังไม่เคย swipe
 *
 * @param student - โปรไฟล์นักเรียน
 * @param availableCamps - ค่ายที่ยังไม่เคย swipe
 * @param affinityMap - tag affinity จาก buildAffinityMap()
 * @returns MatchResult[] เรียงจากคะแนนมากไปน้อย
 */
export function computeMatchScores(
  student: StudentProfile,
  availableCamps: Camp[],
  affinityMap: AffinityMap
): MatchResult[] {
  const results: MatchResult[] = availableCamps.map(camp => {
    const tagScore = computeTagScore(student, camp);
    const profileScore = computeProfileScore(student, camp);
    const affinityScore = computeAffinityScore(camp, affinityMap);

    return {
      campId: camp.id,
      camp,
      totalScore: Math.round(tagScore + profileScore + affinityScore),
      breakdown: {
        tagScore: Math.round(tagScore * 10) / 10,
        profileScore: Math.round(profileScore * 10) / 10,
        affinityScore: Math.round(affinityScore * 10) / 10,
      },
    };
  });

  // เรียงจากมากไปน้อย
  results.sort((a, b) => b.totalScore - a.totalScore);

  return results;
}

// ─── Filter: ค่ายที่ยังไม่เคย swipe ─────────────────────────────────────────

export function filterUnswipedCamps(
  allCamps: Camp[],
  history: SwipeRecord[]
): Camp[] {
  const swipedIds = new Set(history.map(h => h.campId));
  return allCamps.filter(
    camp => !swipedIds.has(camp.id) && camp.status === 'published'
  );
}

// ─── Re-rank After New Swipe ─────────────────────────────────────────────────

/**
 * เรียกฟังก์ชันนี้ทุกครั้งที่นักเรียนปัดการ์ดใหม่
 * ระบบจะ:
 *  1. เพิ่ม record ใหม่เข้า SwipeHistory
 *  2. สร้าง AffinityMap ใหม่จากประวัติทั้งหมด
 *  3. กรองค่ายที่ยังไม่เคย swipe
 *  4. คำนวณ Match Score ใหม่ทั้งหมด
 *
 * → ได้ feed ที่อัปเดตตามพฤติกรรมล่าสุด
 */
export function rerankAfterSwipe(
  student: StudentProfile,
  allCamps: Camp[],
  updatedHistory: SwipeRecord[]
): MatchResult[] {
  // 1. สร้าง lookup map
  const campLookup = new Map(allCamps.map(c => [c.id, c]));

  // 2. สร้าง Affinity Map ใหม่
  const affinityMap = buildAffinityMap(updatedHistory, campLookup);

  // 3. กรองค่ายที่ยังไม่เคย swipe
  const unswiped = filterUnswipedCamps(allCamps, updatedHistory);

  // 4. คำนวณ match ใหม่
  return computeMatchScores(student, unswiped, affinityMap);
}
