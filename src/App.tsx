import { useState, useMemo, useCallback } from 'react';
import {
  mockStudent,
  mockCamps,
  mockSwipeHistory,
  mockQuestTemplates,
} from './data/mockData';
import {
  buildAffinityMap,
  computeMatchScores,
  filterUnswipedCamps,
} from './utils/matchEngine';
import {
  initializeChecklist,
  evaluateAutoQuests,
  completeManualQuest,
  getChecklistSummary,
  getLevelProgress,
} from './utils/questEngine';
import type {
  SwipeRecord,
  MatchResult,
  PortfolioChecklist,
  QuestTemplate,
  Camp,
} from './types/models';
import './App.css';

// ─── Icon Components (inline SVG to avoid icon lib issues) ───────────────────

function HeartIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function XIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function StarIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

// ─── Category Labels ─────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  academic: { label: 'ผลการเรียน', emoji: '📚' },
  competition: { label: 'การแข่งขัน', emoji: '🏅' },
  camp: { label: 'ค่ายวิชาการ', emoji: '⛺' },
  volunteer: { label: 'จิตอาสา', emoji: '💚' },
  skill: { label: 'ทักษะ', emoji: '🔧' },
  project: { label: 'โปรเจกต์', emoji: '🚀' },
  leadership: { label: 'ภาวะผู้นำ', emoji: '👑' },
};

// ─── App ─────────────────────────────────────────────────────────────────────

type ActiveTab = 'match' | 'quest';

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('match');
  const [dark, setDark] = useState(false);

  const toggleDark = () => {
    setDark(d => {
      document.documentElement.classList.toggle('dark', !d);
      return !d;
    });
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {/* ─── Header ────────────────────────────────── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 80%, transparent)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="gradient-brand w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold">
              SP
            </span>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.25rem', fontWeight: 700 }}>
              Student Portfolio
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Switcher */}
            <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', background: 'var(--color-elevated)' }}>
              {(['match', 'quest'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-4 py-2 text-sm font-semibold transition-all"
                  style={{
                    background: activeTab === tab ? 'var(--color-brand-600, #5B21B6)' : 'transparent',
                    color: activeTab === tab ? 'white' : 'var(--color-muted)',
                  }}
                >
                  {tab === 'match' ? '⚡ Match Engine' : '🎯 Quest System'}
                </button>
              ))}
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDark}
              className="p-2 rounded-xl transition-colors"
              style={{ color: 'var(--color-muted)' }}
              aria-label={dark ? 'Light Mode' : 'Dark Mode'}
            >
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ──────────────────────────── */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === 'match' ? <MatchDemo /> : <QuestDemo />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Match Engine Demo ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function MatchDemo() {
  const [history, setHistory] = useState<SwipeRecord[]>([...mockSwipeHistory]);
  const [swipeAnimation, setSwipeAnimation] = useState<{ id: string; dir: 'left' | 'right' } | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // สร้าง lookup map
  const campLookup = useMemo(() => new Map(mockCamps.map(c => [c.id, c])), []);

  // คำนวณ match scores
  const matchResults = useMemo(() => {
    const affinityMap = buildAffinityMap(history, campLookup);
    const unswiped = filterUnswipedCamps(mockCamps, history);
    return computeMatchScores(mockStudent, unswiped, affinityMap);
  }, [history, campLookup]);

  // Current card = top of ranked list
  const currentMatch = matchResults[0];

  const handleSwipe = useCallback((action: 'left' | 'right') => {
    if (!currentMatch) return;

    setSwipeAnimation({ id: currentMatch.campId, dir: action });

    setTimeout(() => {
      const newRecord: SwipeRecord = {
        id: `sw-${Date.now()}`,
        studentId: mockStudent.id,
        campId: currentMatch.campId,
        action,
        timestamp: new Date(),
      };
      setHistory(prev => [...prev, newRecord]);
      setSwipeAnimation(null);

      if (action === 'right') {
        setNotification(`❤️ สนใจ "${currentMatch.camp.title}"!`);
      } else {
        setNotification(`✕ ข้ามค่าย "${currentMatch.camp.title}"`);
      }
      setTimeout(() => setNotification(null), 2500);
    }, 400);
  }, [currentMatch]);

  // สรุปการ swipe
  const swipeStats = useMemo(() => {
    const rights = history.filter(h => h.action === 'right' || h.action === 'super_right').length;
    const lefts = history.filter(h => h.action === 'left').length;
    return { rights, lefts, total: history.length };
  }, [history]);

  // Affinity map สำหรับแสดงผล
  const affinityDisplay = useMemo(() => {
    const affinityMap = buildAffinityMap(history, campLookup);
    return Array.from(affinityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [history, campLookup]);

  return (
    <div className="space-y-8">
      {/* ─── Title & Description ─── */}
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
          ⚡ Persistent Match Engine
        </h2>
        <p style={{ color: 'var(--color-muted)', lineHeight: '1.75' }}>
          ระบบคำนวณ % match แบบ Weighted Scoring: <strong>Tag (50%)</strong> + <strong>Profile (20%)</strong> + <strong>Affinity (30%)</strong>
          <br />
          ลองปัดซ้าย/ขวาแล้วสังเกตว่าลำดับค่ายและคะแนนเปลี่ยนตามพฤติกรรม
        </p>
      </div>

      {/* ─── Student Profile Card ─── */}
      <div className="rounded-2xl p-5 flex gap-4 items-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="w-14 h-14 rounded-2xl gradient-brand flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
          {mockStudent.displayName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg">{mockStudent.displayName}</h3>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            {mockStudent.school} • ม.{mockStudent.grade - 7} • เป้าหมาย: {mockStudent.targetFaculty}, {mockStudent.targetUniversity}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {mockStudent.interests.map(tag => (
              <span key={tag} className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: 'var(--color-brand-100, #EDE9FE)', color: 'var(--color-brand-600, #5B21B6)' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Notification ─── */}
      {notification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl text-white font-semibold text-sm gradient-brand shadow-lg"
          style={{ animation: 'slideUp 0.3s ease-out' }}>
          {notification}
        </div>
      )}

      {/* ─── Swipe Area + Sidebar ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Swipe Card ─── */}
        <div className="lg:col-span-2">
          {currentMatch ? (
            <div className="flex flex-col items-center gap-6">
              {/* Card */}
              <div
                className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-lg cursor-grab select-none"
                style={{
                  aspectRatio: '9/14',
                  transition: swipeAnimation ? 'transform 0.4s ease-in, opacity 0.4s ease-in' : 'none',
                  transform: swipeAnimation
                    ? swipeAnimation.dir === 'right'
                      ? 'translateX(120%) rotate(20deg)'
                      : 'translateX(-120%) rotate(-20deg)'
                    : 'translateX(0) rotate(0)',
                  opacity: swipeAnimation ? 0 : 1,
                }}
              >
                <img
                  src={currentMatch.camp.coverImageUrl}
                  alt={currentMatch.camp.title}
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
                <div className="gradient-card-overlay absolute inset-0" />

                {/* Match Badge */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                  <span
                    className="text-white text-sm font-bold px-3 py-1.5 rounded-full backdrop-blur-sm"
                    style={{ background: 'rgba(91, 33, 182, 0.85)' }}
                  >
                    ⚡ {currentMatch.totalScore}% match
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm"
                    style={{
                      background: currentMatch.camp.isOnline ? 'rgba(14, 165, 233, 0.2)' : 'rgba(255,255,255,0.15)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}>
                    {currentMatch.camp.isOnline ? '🌐 Online' : '📍 Onsite'}
                  </span>
                </div>

                {/* Bottom Info */}
                <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {currentMatch.camp.tags.map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h3 className="text-xl font-bold leading-tight mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                    {currentMatch.camp.title}
                  </h3>
                  <p className="text-sm opacity-75 line-clamp-2 mb-3">
                    {currentMatch.camp.description}
                  </p>
                  <div className="flex gap-4 text-sm opacity-70">
                    <span>📅 หมดเขต {currentMatch.camp.applicationDeadline.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                    <span>👥 {currentMatch.camp.capacity ?? '∞'} ที่นั่ง</span>
                    <span className="font-semibold" style={{ color: '#FBBF24' }}>
                      {currentMatch.camp.cost === 0 ? '🎓 Free' : `฿${currentMatch.camp.cost.toLocaleString()}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Swipe Buttons */}
              <div className="flex items-center gap-6">
                <button
                  onClick={() => handleSwipe('left')}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white transition-all active:scale-95"
                  style={{ background: '#F97316', boxShadow: '0 4px 16px rgba(249,115,22,0.4)' }}
                  aria-label="ไม่สนใจค่ายนี้"
                >
                  <XIcon /> ไม่สนใจ
                </button>
                <button
                  onClick={() => handleSwipe('right')}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all active:scale-95"
                  style={{ background: '#FBBF24', color: '#0F172A', boxShadow: '0 4px 16px rgba(251,191,36,0.4)' }}
                  aria-label="สนใจค่ายนี้"
                >
                  <HeartIcon /> สนใจ!
                </button>
              </div>

              {/* Score Breakdown */}
              <div className="w-full max-w-sm rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-muted)' }}>SCORE BREAKDOWN</p>
                <div className="space-y-2">
                  {[
                    { label: 'Tag Match', value: currentMatch.breakdown.tagScore, max: 50, color: '#7C3AED' },
                    { label: 'Profile Fit', value: currentMatch.breakdown.profileScore, max: 20, color: '#0EA5E9' },
                    { label: 'Affinity', value: currentMatch.breakdown.affinityScore, max: 30, color: '#FBBF24' },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{item.label}</span>
                        <span style={{ color: 'var(--color-muted)' }}>{item.value}/{item.max}</span>
                      </div>
                      <div className="w-full h-2 rounded-full" style={{ background: 'var(--color-elevated)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(item.value / item.max) * 100}%`, background: item.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="text-6xl mb-4">🎉</span>
              <h3 className="text-xl font-bold mb-2">ดูค่ายทั้งหมดแล้ว!</h3>
              <p style={{ color: 'var(--color-muted)' }}>คุณปัดค่ายทั้งหมดครบแล้ว รอค่ายใหม่เข้ามานะ</p>
            </div>
          )}
        </div>

        {/* ─── Sidebar: Stats & Queue ─── */}
        <div className="space-y-4">
          {/* Swipe Stats */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-muted)' }}>📊 สถิติการปัด</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'สนใจ', value: swipeStats.rights, color: '#FBBF24', emoji: '❤️' },
                { label: 'ข้าม', value: swipeStats.lefts, color: '#F97316', emoji: '✕' },
                { label: 'ทั้งหมด', value: swipeStats.total, color: '#7C3AED', emoji: '📋' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3" style={{ background: 'var(--color-elevated)' }}>
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{s.emoji} {s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Affinity Map */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-muted)' }}>🧠 Tag Affinity (จากการปัด)</p>
            {affinityDisplay.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>ยังไม่มีข้อมูล — ลองปัดค่ายดู!</p>
            ) : (
              <div className="space-y-2">
                {affinityDisplay.map(([tag, weight]) => (
                  <div key={tag} className="flex items-center gap-2">
                    <span className="text-sm font-medium w-24 truncate">{tag}</span>
                    <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--color-elevated)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((weight / (affinityDisplay[0]?.[1] || 1)) * 100, 100)}%`,
                          background: '#7C3AED',
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono w-8 text-right" style={{ color: 'var(--color-muted)' }}>
                      {weight.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Up Next Queue */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-muted)' }}>📋 ลำดับถัดไป ({matchResults.length} ค่าย)</p>
            <div className="space-y-2">
              {matchResults.slice(0, 5).map((result, i) => (
                <div key={result.campId} className="flex items-center gap-3 rounded-xl p-2" style={{ background: i === 0 ? 'var(--color-brand-50, #F5F3FF)' : 'transparent' }}>
                  <span className="text-sm font-bold w-6" style={{ color: 'var(--color-muted)' }}>#{i + 1}</span>
                  <img src={result.camp.coverImageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{result.camp.title}</p>
                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{result.camp.tags.slice(0, 2).join(', ')}</p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: '#7C3AED' }}>{result.totalScore}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Quest System Demo ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function QuestDemo() {
  const [history, setHistory] = useState<SwipeRecord[]>([...mockSwipeHistory]);
  const [checklist, setChecklist] = useState<PortfolioChecklist>(() =>
    initializeChecklist(mockStudent.id, mockQuestTemplates, mockStudent.targetUniversity, mockStudent.targetFaculty)
  );
  const [levelUpAnim, setLevelUpAnim] = useState(false);
  const [completionToast, setCompletionToast] = useState<string | null>(null);

  const campLookup = useMemo(() => new Map(mockCamps.map(c => [c.id, c])), []);

  const summary = useMemo(() => getChecklistSummary(checklist, mockQuestTemplates), [checklist]);

  // Simulate สถานการณ์ "ปัดขวาค่ายใหม่" แล้วระบบ auto-check quest
  const simulateSwipe = useCallback((camp: Camp) => {
    const newRecord: SwipeRecord = {
      id: `sw-${Date.now()}`,
      studentId: mockStudent.id,
      campId: camp.id,
      action: 'right',
      timestamp: new Date(),
    };
    const newHistory = [...history, newRecord];
    setHistory(newHistory);

    // Auto evaluate quests
    const result = evaluateAutoQuests(
      { ...checklist, quests: checklist.quests.map(q => ({ ...q })) },
      mockQuestTemplates,
      newHistory,
      campLookup,
    );

    setChecklist(result.updatedChecklist);

    if (result.newlyCompleted.length > 0) {
      const names = result.newlyCompleted.map(c => `"${c.quest.title}" (+${c.xpEarned} XP)`).join(', ');
      setCompletionToast(`🎯 เควสต์สำเร็จ! ${names}`);
      setTimeout(() => setCompletionToast(null), 4000);
    }

    if (result.leveledUp) {
      setLevelUpAnim(true);
      setTimeout(() => setLevelUpAnim(false), 2000);
    }
  }, [history, checklist, campLookup]);

  // Manual complete
  const handleManualComplete = useCallback((template: QuestTemplate) => {
    const updated = completeManualQuest(
      { ...checklist, quests: checklist.quests.map(q => ({ ...q })) },
      template,
      'https://example.com/proof.pdf',
    );
    setChecklist(updated);
    setCompletionToast(`🎯 "${template.title}" สำเร็จ! (+${template.xpReward} XP)`);
    setTimeout(() => setCompletionToast(null), 3000);
  }, [checklist]);

  // Get swiped camp ids
  const swipedCampIds = new Set(history.map(h => h.campId));

  return (
    <div className="space-y-8">
      {/* ─── Title ─── */}
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
          🎯 Portfolio Checklist Quest
        </h2>
        <p style={{ color: 'var(--color-muted)', lineHeight: '1.75' }}>
          ระบบแปลงเกณฑ์รับสมัครมหาวิทยาลัย → Gamified Checklist พร้อม XP/Level
          <br />
          ลอง "สนใจ" ค่ายด้านล่าง แล้วดูเควสต์ auto-check เอง!
        </p>
      </div>

      {/* ─── Toast ─── */}
      {completionToast && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl text-white font-semibold text-sm shadow-lg"
          style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)', animation: 'slideUp 0.3s ease-out' }}
        >
          {completionToast}
        </div>
      )}

      {/* ─── Level Up Animation ─── */}
      {levelUpAnim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="text-center p-8 rounded-3xl" style={{ background: 'var(--color-surface)', animation: 'popIn 0.5s ease-out' }}>
            <p className="text-6xl mb-4">🎉</p>
            <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>Level Up!</h3>
            <p className="text-lg" style={{ color: 'var(--color-muted)' }}>
              {summary.level.emoji} คุณเลเวลอัปเป็น <strong>{summary.level.label}</strong>!
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Left: Level & Progress ─── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Level Card */}
          <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-muted)' }}>
                  {mockStudent.targetFaculty} — {mockStudent.targetUniversity}
                </p>
                <h3 className="text-lg font-bold mt-1">เลเวลปัจจุบัน</h3>
              </div>
              <div
                className="px-4 py-2 rounded-2xl text-white font-bold text-sm flex items-center gap-2"
                style={{
                  background: `linear-gradient(to right, var(--color-brand-400, #A78BFA), var(--color-brand-600, #5B21B6))`,
                }}
              >
                <span>{summary.level.emoji}</span>
                {summary.level.label}
                <span className="px-2 py-0.5 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  {summary.totalXP} XP
                </span>
              </div>
            </div>

            {/* XP Progress Bar */}
            <div>
              <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-elevated)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${summary.levelProgress}%`,
                    background: 'linear-gradient(to right, #A78BFA, #5B21B6)',
                  }}
                />
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'var(--color-muted)' }}>
                {Math.round(summary.levelProgress)}% ไปเลเวลต่อไป
              </p>
            </div>

            {/* Overall Completion */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-elevated)' }}>
                <p className="text-2xl font-bold" style={{ color: '#7C3AED' }}>{summary.completedQuests}</p>
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>เสร็จแล้ว</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-elevated)' }}>
                <p className="text-2xl font-bold" style={{ color: '#0EA5E9' }}>{summary.totalQuests}</p>
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>ทั้งหมด</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-elevated)' }}>
                <p className="text-2xl font-bold" style={{ color: '#FBBF24' }}>{summary.progressPercent}%</p>
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>ความคืบหน้า</p>
              </div>
            </div>
          </div>

          {/* Quest List */}
          <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h3 className="font-bold text-lg mb-4">🗺️ รายการเควสต์</h3>
            <div className="space-y-3">
              {mockQuestTemplates.map(template => {
                const progress = checklist.quests.find(q => q.questId === template.id);
                const cat = CATEGORY_LABELS[template.category] ?? { label: template.category, emoji: '📎' };
                const required = template.requiredCount ?? 1;

                return (
                  <div
                    key={template.id}
                    className="flex items-start gap-4 rounded-xl p-4 transition-all"
                    style={{
                      background: progress?.completed ? 'var(--color-brand-50, #F5F3FF)' : 'var(--color-elevated)',
                      border: progress?.completed ? '1px solid var(--color-brand-200, #DDD6FE)' : '1px solid transparent',
                      opacity: progress?.completed ? 0.75 : 1,
                    }}
                  >
                    {/* Check Circle */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: progress?.completed ? '#7C3AED' : 'var(--color-border)',
                        color: progress?.completed ? 'white' : 'var(--color-muted)',
                      }}
                    >
                      {progress?.completed ? <CheckIcon /> : <span className="text-xs font-bold">{progress?.currentCount ?? 0}</span>}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold">{template.title}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--color-sky-100, #E0F2FE)', color: 'var(--color-sky-600, #0284C7)' }}>
                          {cat.emoji} {cat.label}
                        </span>
                        {template.autoCheckable && (
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--color-energy-100, #FEF3C7)', color: 'var(--color-energy-500, #F59E0B)' }}>
                            ⚡ Auto
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{template.description}</p>

                      {/* Progress */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--color-border)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(((progress?.currentCount ?? 0) / required) * 100, 100)}%`,
                              background: progress?.completed ? '#7C3AED' : '#0EA5E9',
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono" style={{ color: 'var(--color-muted)' }}>
                          {progress?.currentCount ?? 0}/{required}
                        </span>
                      </div>
                    </div>

                    {/* XP Reward */}
                    <div className="text-right flex-shrink-0">
                      <span className="flex items-center gap-1 text-sm font-bold" style={{ color: '#FBBF24' }}>
                        <StarIcon className="w-4 h-4" /> {template.xpReward}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-muted)' }}>XP</span>
                      {!template.autoCheckable && !progress?.completed && (
                        <button
                          onClick={() => handleManualComplete(template)}
                          className="mt-2 text-xs px-3 py-1 rounded-lg text-white font-semibold transition-all active:scale-95"
                          style={{ background: '#7C3AED' }}
                        >
                          ส่งผลงาน
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── Right Sidebar: Simulate Swipes ─── */}
        <div className="space-y-4">
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-muted)' }}>
              🧪 จำลอง: ปัดขวาค่ายเพื่อทดสอบ Auto-Check
            </p>
            <div className="space-y-2">
              {mockCamps.map(camp => {
                const alreadySwiped = swipedCampIds.has(camp.id);
                return (
                  <div key={camp.id} className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: 'var(--color-elevated)' }}>
                    <img src={camp.coverImageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{camp.title}</p>
                      <div className="flex gap-1 mt-0.5">
                        {camp.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: 'var(--color-border)', color: 'var(--color-muted)' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => simulateSwipe(camp)}
                      disabled={alreadySwiped}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                      style={{
                        background: alreadySwiped ? 'var(--color-border)' : '#FBBF24',
                        color: alreadySwiped ? 'var(--color-muted)' : '#0F172A',
                      }}
                    >
                      {alreadySwiped ? (
                        <><CheckIcon className="w-3 h-3" /> แล้ว</>
                      ) : (
                        <><HeartIcon className="w-3 h-3" /> สนใจ</>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Summary */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-muted)' }}>📊 ความคืบหน้าตามหมวด</p>
            <div className="space-y-3">
              {Array.from(summary.byCategory.entries()).map(([cat, data]) => {
                const catInfo = CATEGORY_LABELS[cat] ?? { label: cat, emoji: '📎' };
                const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{catInfo.emoji} {catInfo.label}</span>
                      <span style={{ color: 'var(--color-muted)' }}>{data.completed}/{data.total}</span>
                    </div>
                    <div className="w-full h-2 rounded-full" style={{ background: 'var(--color-elevated)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: pct === 100 ? '#7C3AED' : '#0EA5E9' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
