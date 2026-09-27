import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  mockCamps,
  mockStudent,
} from '../data/mockData';
import {
  buildAffinityMap,
  computeMatchScores,
  filterUnswipedCamps,
} from '../utils/matchEngine';
import {
  initializeChecklist,
  evaluateAutoQuests,
  completeManualQuest,
  getChecklistSummary,
  getQuestTemplatesForStudent,
} from '../utils/questEngine';
import type {
  SwipeRecord,
  PortfolioChecklist,
  QuestTemplate,
  Camp,
  StudentProfile,
  CampApplication,
  AdListing,
} from '../types/models';
import { useAuth } from '../contexts/AuthContext';
import { fetchSwipeHistory, recordSwipe, fetchChecklist, saveChecklist, fetchApplications } from '../services/studentService';
import { useNavigate } from 'react-router-dom';
import DevTestBar from '../components/DevTestBar';
import CampDetailModal from '../components/CampDetailModal';
import SwiftPortLogo from '../components/SwiftPortLogo';
import { getSystemCamps, getActiveSponsoredAds } from '../services/campService';
import '../App.css';

// ─── Icon Components ─────────────────────────────────────────────────────────

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

// ─── Preset Target Faculties for Quick Switching ─────────────────────────────
const PRESET_GOALS = [
  {
    faculty: 'คณะวิศวกรรมศาสตร์',
    university: 'จุฬาลงกรณ์มหาวิทยาลัย',
    interests: ['Technology', 'Robotics', 'Science', 'Math', 'Innovation'],
    label: '⚙️ วิศวกรรม จุฬาฯ',
  },
  {
    faculty: 'คณะแพทยศาสตร์',
    university: 'จุฬาลงกรณ์มหาวิทยาลัย',
    interests: ['Medicine', 'Health', 'Biology', 'Science', 'Social'],
    label: '🩺 แพทยศาสตร์ จุฬาฯ',
  },
  {
    faculty: 'คณะพาณิชยศาสตร์และการบัญชี',
    university: 'มหาวิทยาลัยธรรมศาสตร์',
    interests: ['Business', 'Management', 'Leadership', 'Innovation', 'Competition'],
    label: '💼 บริหารธุรกิจ มธ.',
  },
  {
    faculty: 'คณะมัณฑนศิลป์ / สถาปัตย์',
    university: 'มหาวิทยาลัยศิลปากร',
    interests: ['Design', 'Creative', 'Technology', 'Art'],
    label: '🎨 สถาปัตย์/ออกแบบ ศิลปากร',
  },
];

type ActiveTab = 'match' | 'quest' | 'profile';

interface DetailState {
  camp: Camp;
  matchScore?: number;
  matchBreakdown?: { tagScore: number; profileScore: number; affinityScore: number };
}

export default function StudentDashboard() {
  const { profile, logout, updateProfile } = useAuth();
  const studentProfile: StudentProfile = (profile as StudentProfile) || mockStudent;
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<ActiveTab>('match');
  const [dark, setDark] = useState(false);
  const [completionToast, setCompletionToast] = useState<string | null>(null);
  const [levelUpAnim, setLevelUpAnim] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [detailCamp, setDetailCamp] = useState<DetailState | null>(null);
  const [applications, setApplications] = useState<CampApplication[]>([]);

  const [history, setHistory] = useState<SwipeRecord[]>([]);
  const [allCamps] = useState<Camp[]>(() => getSystemCamps());
  const [sponsoredAds] = useState(() => getActiveSponsoredAds());

  // Camp lookup cache
  const campLookup = useMemo(() => new Map(allCamps.map(c => [c.id, c])), [allCamps]);

  // Dynamic quest templates strictly tailored to student's registered target university and faculty!
  const questTemplates = useMemo(() => {
    return getQuestTemplatesForStudent(studentProfile.targetUniversity, studentProfile.targetFaculty);
  }, [studentProfile.targetUniversity, studentProfile.targetFaculty]);

  // Initial checklist loaded from localStorage or fresh template
  const [checklist, setChecklist] = useState<PortfolioChecklist>(() => {
    try {
      const saved = localStorage.getItem(`sp_local_checklist_${studentProfile.id}`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return initializeChecklist(studentProfile.id, undefined, studentProfile.targetUniversity, studentProfile.targetFaculty);
  });

  // Checklist summary
  const summary = useMemo(() => {
    return getChecklistSummary(checklist, questTemplates);
  }, [checklist, questTemplates]);

  // Unified Quest Evaluation Function
  const runEvaluateQuests = useCallback((currentHistory: SwipeRecord[]) => {
    setChecklist(prevChecklist => {
      const base = prevChecklist || initializeChecklist(studentProfile.id, undefined, studentProfile.targetUniversity, studentProfile.targetFaculty);
      
      // Merge current templates to guarantee faculty-specific quests are present
      const questsMerged = questTemplates.map(tmpl => {
        const found = base.quests.find(q => q.questId === tmpl.id);
        return found ? { ...found } : { questId: tmpl.id, currentCount: 0, completed: false, xpEarned: 0 };
      });

      const result = evaluateAutoQuests(
        { ...base, quests: questsMerged },
        questTemplates,
        currentHistory,
        campLookup,
      );

      // Save to localStorage & Firestore
      saveChecklist(studentProfile.id, result.updatedChecklist);
      try {
        localStorage.setItem(`sp_local_checklist_${studentProfile.id}`, JSON.stringify(result.updatedChecklist));
      } catch {}

      if (result.newlyCompleted.length > 0) {
        const names = result.newlyCompleted.map(c => `"${c.quest.title}" (+${c.xpEarned} XP)`).join(', ');
        setCompletionToast(`🎯 เควสต์สำเร็จ! ${names}`);
        setTimeout(() => setCompletionToast(null), 4000);
      }
      if (result.leveledUp) {
        setLevelUpAnim(true);
        setTimeout(() => setLevelUpAnim(false), 2500);
      }
      return result.updatedChecklist;
    });
  }, [studentProfile.id, studentProfile.targetUniversity, studentProfile.targetFaculty, questTemplates, campLookup]);

  // Load swipe history, checklist, and applications on mount
  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const hist = await fetchSwipeHistory(studentProfile.id);
        if (mounted && hist.length > 0) {
          setHistory(hist);
          runEvaluateQuests(hist);
        }
        
        const chk = await fetchChecklist(studentProfile.id);
        if (mounted && chk) {
          setChecklist(chk);
        }

        const apps = await fetchApplications(studentProfile.id);
        if (mounted) setApplications(apps);
      } catch(e) {
        console.warn("Background loadData caught:", e);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, [studentProfile.id, runEvaluateQuests]);

  // When target faculty/university changes, re-evaluate checklist with new templates
  useEffect(() => {
    runEvaluateQuests(history);
  }, [questTemplates, history, runEvaluateQuests]);

  // Swipe Action handler
  const handleSwipeAction = useCallback(async (camp: Camp, action: 'left' | 'right' | 'super_right') => {
    const tempId = `sw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newRecord: SwipeRecord = {
      id: tempId,
      studentId: studentProfile.id,
      campId: camp.id,
      action,
      timestamp: new Date(),
    };
    
    try {
      const docId = await recordSwipe({
        studentId: studentProfile.id,
        campId: camp.id,
        action,
        timestamp: newRecord.timestamp,
      });
      const finalRecord = { ...newRecord, id: docId || tempId };
      const updatedHistory = [...history, finalRecord];
      setHistory(updatedHistory);
      localStorage.setItem(`sp_local_swipes_${studentProfile.id}`, JSON.stringify(updatedHistory));

      // Trigger Quest Auto-evaluation immediately!
      runEvaluateQuests(updatedHistory);
    } catch (err) {
      console.error("Failed to record swipe:", err);
    }
  }, [studentProfile.id, history, runEvaluateQuests]);

  // Confirm activity participation (Mark as Attended)
  const handleConfirmAttendance = useCallback(async (campId: string) => {
    const existing = history.find(h => h.campId === campId);
    let updatedHistory: SwipeRecord[];
    const tempId = `sw_att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    if (existing) {
      updatedHistory = history.map(h => h.campId === campId ? { ...h, action: 'super_right' as const, timestamp: new Date() } : h);
    } else {
      updatedHistory = [...history, {
        id: tempId,
        studentId: studentProfile.id,
        campId,
        action: 'super_right',
        timestamp: new Date(),
      }];
    }

    setHistory(updatedHistory);
    localStorage.setItem(`sp_local_swipes_${studentProfile.id}`, JSON.stringify(updatedHistory));
    
    const camp = campLookup.get(campId);
    setCompletionToast(`🏅 ยืนยันเข้าร่วม "${camp?.title || 'กิจกรรม'}" สำเร็จ! ได้รับ +50 Bonus XP`);
    setTimeout(() => setCompletionToast(null), 4000);

    runEvaluateQuests(updatedHistory);
  }, [history, studentProfile.id, campLookup, runEvaluateQuests]);

  // Undo last swipe
  const handleUndoSwipe = useCallback(() => {
    if (history.length === 0) return;
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    localStorage.setItem(`sp_local_swipes_${studentProfile.id}`, JSON.stringify(newHistory));
    runEvaluateQuests(newHistory);
    setCompletionToast('↩️ ย้อนกลับการ์ดล่าสุดแล้ว');
    setTimeout(() => setCompletionToast(null), 2000);
  }, [history, studentProfile.id, runEvaluateQuests]);

  // Reset swipes
  const handleResetSwipes = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(`sp_local_swipes_${studentProfile.id}`);
    runEvaluateQuests([]);
    setCompletionToast('🔄 รีเซ็ตประวัติการปัดค่ายทั้งหมดแล้ว');
    setTimeout(() => setCompletionToast(null), 2000);
  }, [studentProfile.id, runEvaluateQuests]);

  // Reset quests
  const handleResetQuests = useCallback(() => {
    const freshChecklist = initializeChecklist(studentProfile.id, undefined, studentProfile.targetUniversity, studentProfile.targetFaculty);
    setChecklist(freshChecklist);
    saveChecklist(studentProfile.id, freshChecklist);
    localStorage.removeItem(`sp_local_checklist_${studentProfile.id}`);
    setCompletionToast('📋 รีเซ็ตเควสต์กลับเป็นเริ่มต้นแล้ว');
    setTimeout(() => setCompletionToast(null), 2000);
  }, [studentProfile]);

  // Switch Goal Preset
  const handleSelectGoalPreset = async (preset: typeof PRESET_GOALS[0]) => {
    const updated: StudentProfile = {
      ...studentProfile,
      targetFaculty: preset.faculty,
      targetUniversity: preset.university,
      interests: preset.interests,
      updatedAt: new Date(),
    };
    await updateProfile(updated);
    setShowGoalModal(false);
    setCompletionToast(`🎯 เปลี่ยนเป้าหมายเป็น: ${preset.faculty} (${preset.university})`);
    setTimeout(() => setCompletionToast(null), 3000);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleDark = () => {
    setDark(d => {
      document.documentElement.classList.toggle('dark', !d);
      return !d;
    });
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {/* ─── Level Up Modal Animation ────────────────── */}
      {levelUpAnim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
          <div className="text-center p-8 rounded-3xl max-w-sm w-full border shadow-2xl" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
            <p className="text-6xl mb-3 animate-bounce">🎉</p>
            <h3 className="text-3xl font-extrabold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>LEVEL UP!</h3>
            <div className="inline-block px-4 py-1.5 rounded-full text-sm font-bold text-white my-3 gradient-brand">
              {summary.level.emoji} เลเวล {summary.level.level}: {summary.level.label}
            </div>
            <p className="text-sm opacity-80 mb-5">
              คุณทำเควสต์สำเร็จและสะสม XP ครบตามเกณฑ์! พอร์ตของคุณแข็งแกร่งขึ้นเรื่อยๆ
            </p>
            <button
              onClick={() => setLevelUpAnim(false)}
              className="w-full py-2.5 rounded-xl font-bold text-white gradient-brand shadow-lg cursor-pointer transition-all active:scale-95"
            >
              ลุยต่อเลย! 🚀
            </button>
          </div>
        </div>
      )}

      {/* ─── Global Toast Notification ────────────────── */}
      {completionToast && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl text-white font-semibold text-sm shadow-xl flex items-center gap-2 max-w-md text-center"
          style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)', animation: 'slideUp 0.3s ease-out' }}
        >
          {completionToast}
        </div>
      )}

      {/* ─── Header ────────────────────────────────── */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 85%, transparent)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SwiftPortLogo
              size="sm"
              subtitle={`${studentProfile.displayName} (${studentProfile.school})`}
            />
          </div>

          {/* Target Goal Badge & Level indicator */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGoalModal(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer hover:border-purple-400 transition-all"
              style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
              title="คลิกเพื่อสลับ/เปลี่ยนเป้าหมายคณะและมหาวิทยาลัย"
            >
              <span>🎯</span>
              <span className="font-bold text-purple-600 dark:text-purple-400">{studentProfile.targetFaculty}</span>
              <span className="opacity-60">• {studentProfile.targetUniversity}</span>
              <span className="text-[10px] text-purple-500 underline ml-1">เปลี่ยน</span>
            </button>

            {/* Level / XP Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
              <span className="text-amber-500 font-extrabold">{summary.level.emoji} Lv.{summary.level.level}</span>
              <span className="text-purple-600 dark:text-purple-400 font-mono">{summary.totalXP} XP</span>
            </div>

            {/* Tab Switcher */}
            <div className="flex rounded-xl overflow-hidden p-0.5" style={{ border: '1px solid var(--color-border)', background: 'var(--color-elevated)' }}>
              {([
                { id: 'match', label: '⚡ Match' },
                { id: 'quest', label: '🎯 เควสต์' },
                { id: 'profile', label: `👤 โปรไฟล์${applications.length > 0 ? ` (${applications.length})` : ''}` },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  className="px-3 py-1.5 text-xs font-bold transition-all rounded-lg cursor-pointer whitespace-nowrap"
                  style={{
                    background: activeTab === tab.id ? 'var(--color-brand-600, #5B21B6)' : 'transparent',
                    color: activeTab === tab.id ? 'white' : 'var(--color-muted)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDark}
              className="p-2 rounded-xl transition-colors cursor-pointer text-sm"
              style={{ color: 'var(--color-muted)' }}
              aria-label={dark ? 'Light Mode' : 'Dark Mode'}
            >
              {dark ? '☀️' : '🌙'}
            </button>

            <button onClick={handleLogout} className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors hover:bg-red-200 cursor-pointer">
              ออก
            </button>
          </div>
        </div>
      </header>

      {/* ─── Goal Switcher Modal ───────────────────── */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="rounded-3xl p-6 max-w-md w-full border shadow-2xl space-y-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>🎯 ปรับเป้าหมายการสมัคร (คณะ & มหาวิทยาลัย)</h3>
              <button onClick={() => setShowGoalModal(false)} className="w-8 h-8 rounded-full border flex items-center justify-center text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
            </div>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              เมื่อเปลี่ยนเป้าหมาย ระบบจะคำนวณคะแนนค่ายใหม่ทันที และสร้าง <strong>เควสต์เฉพาะคณะ</strong> ที่ตรงกับเกณฑ์การรับสมัครรอบ Portfolio
            </p>

            <div className="space-y-2">
              {PRESET_GOALS.map(preset => {
                const isSelected = studentProfile.targetFaculty === preset.faculty;
                return (
                  <button
                    key={preset.label}
                    onClick={() => handleSelectGoalPreset(preset)}
                    className="w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer hover:scale-[1.01]"
                    style={{
                      background: isSelected ? 'var(--color-brand-50, #F5F3FF)' : 'var(--color-elevated)',
                      borderColor: isSelected ? '#7C3AED' : 'var(--color-border)',
                    }}
                  >
                    <div>
                      <p className="font-bold text-sm">{preset.label}</p>
                      <p className="text-xs opacity-75">{preset.faculty} • {preset.university}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {preset.interests.map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700">{t}</span>
                        ))}
                      </div>
                    </div>
                    {isSelected && <span className="text-purple-600 font-bold text-lg">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Camp Detail Modal ───────────────────────── */}
      {detailCamp && (
        <CampDetailModal
          camp={detailCamp.camp}
          profile={studentProfile}
          matchScore={detailCamp.matchScore}
          matchBreakdown={detailCamp.matchBreakdown}
          onClose={() => setDetailCamp(null)}
          onApplied={(app) => {
            setApplications(prev => {
              const exists = prev.find(a => a.campId === app.campId);
              if (exists) return prev;
              return [...prev, app];
            });
            setCompletionToast(`🎉 สมัครเข้าร่วม "${app.campTitle}" สำเร็จ! ดูสถานะได้ที่แท็บ 👤 โปรไฟล์`);
            setTimeout(() => setCompletionToast(null), 5000);
          }}
        />
      )}

      {/* ─── Main Content ──────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'match' ? (
          <MatchDemo 
            profile={studentProfile} 
            history={history} 
            onSwipe={handleSwipeAction}
            onUndoSwipe={handleUndoSwipe}
            onResetSwipes={handleResetSwipes}
            onChangeGoal={() => setShowGoalModal(true)}
            questSummary={summary}
            onOpenDetail={(camp, matchScore, matchBreakdown) => setDetailCamp({ camp, matchScore, matchBreakdown })}
            applications={applications}
            allCamps={allCamps}
            sponsoredAds={sponsoredAds}
          />
        ) : activeTab === 'quest' ? (
          <QuestDemo 
            profile={studentProfile} 
            history={history} 
            checklist={checklist}
            questTemplates={questTemplates}
            summary={summary}
            onConfirmAttendance={handleConfirmAttendance}
            onManualComplete={async (template) => {
              const updated = completeManualQuest(
                { ...checklist, quests: checklist.quests.map(q => ({ ...q })) },
                template,
                'https://drive.google.com/sample-portfolio-proof.pdf'
              );
              setChecklist(updated);
              saveChecklist(studentProfile.id, updated);
              setCompletionToast(`🎯 "${template.title}" สำเร็จ! (+${template.xpReward} XP)`);
              setTimeout(() => setCompletionToast(null), 3000);
            }}
            onSwitchToMatch={() => setActiveTab('match')}
            onChangeGoal={() => setShowGoalModal(true)}
            onOpenDetail={(camp: Camp) => setDetailCamp({ camp })}
          />
        ) : (
          <ProfileDemo
            profile={studentProfile}
            applications={applications}
            checklist={checklist}
            summary={summary}
            history={history}
            onOpenDetail={(camp: Camp) => {
              const campData = allCamps.find(c => c.id === camp.id) || camp;
              setDetailCamp({ camp: campData });
            }}
            onChangeGoal={() => setShowGoalModal(true)}
            onSwitchToMatch={() => setActiveTab('match')}
          />
        )}
      </main>

      {/* Dev Test Bar (Remove when project is finished) */}
      <DevTestBar 
        onUndoSwipe={handleUndoSwipe} 
        onResetSwipes={handleResetSwipes} 
        onResetQuests={handleResetQuests} 
        canUndo={history.length > 0} 
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Match Engine Demo ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function MatchDemo({ 
  profile, 
  history, 
  onSwipe,
  onUndoSwipe,
  onResetSwipes,
  onChangeGoal,
  questSummary,
  onOpenDetail,
  applications,
  allCamps,
  sponsoredAds,
}: { 
  profile: StudentProfile; 
  history: SwipeRecord[]; 
  onSwipe: (camp: Camp, action: 'left' | 'right') => Promise<void>;
  onUndoSwipe?: () => void;
  onResetSwipes?: () => void;
  onChangeGoal: () => void;
  questSummary: ReturnType<typeof getChecklistSummary>;
  onOpenDetail: (camp: Camp, matchScore?: number, matchBreakdown?: { tagScore: number; profileScore: number; affinityScore: number }) => void;
  applications: CampApplication[];
  allCamps: Camp[];
  sponsoredAds: AdListing[];
}) {
  const [swipeAnimation, setSwipeAnimation] = useState<{ id: string; dir: 'left' | 'right' } | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Camp lookup
  const campLookup = useMemo(() => new Map(allCamps.map(c => [c.id, c])), [allCamps]);

  // Applied applications map
  const appliedMap = useMemo(() => {
    const map = new Map<string, CampApplication>();
    for (const a of applications) {
      map.set(a.campId, a);
    }
    return map;
  }, [applications]);

  // Compute Match Scores with Weighted Engine
  const matchResults = useMemo(() => {
    const affinityMap = buildAffinityMap(history, campLookup);
    const unswiped = filterUnswipedCamps(allCamps, history);
    return computeMatchScores(profile, unswiped, affinityMap);
  }, [history, campLookup, profile, allCamps]);

  // Current top ranked card
  const currentMatch = matchResults[0];
  const currentApp = currentMatch ? appliedMap.get(currentMatch.camp.id) : undefined;

  const handleSwipe = useCallback(async (action: 'left' | 'right') => {
    if (!currentMatch) return;

    setSwipeAnimation({ id: currentMatch.campId, dir: action });

    setTimeout(async () => {
      await onSwipe(currentMatch.camp, action);
      setSwipeAnimation(null);

      if (action === 'right') {
        setNotification(`❤️ สนใจ "${currentMatch.camp.title}"! ระบบตรวจสอบเควสต์ให้แล้ว`);
      } else {
        setNotification(`✕ ข้ามค่าย "${currentMatch.camp.title}"`);
      }
      setTimeout(() => setNotification(null), 2500);
    }, 350);
  }, [currentMatch, onSwipe]);

  // Swipe Stats
  const swipeStats = useMemo(() => {
    const rights = history.filter(h => h.action === 'right' || h.action === 'super_right').length;
    const lefts = history.filter(h => h.action === 'left').length;
    return { rights, lefts, total: history.length };
  }, [history]);

  // Affinity map
  const affinityDisplay = useMemo(() => {
    const affinityMap = buildAffinityMap(history, campLookup);
    return Array.from(affinityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [history, campLookup]);

  return (
    <div className="space-y-6">
      {/* ─── Notification banner ─── */}
      {notification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl text-white font-semibold text-xs gradient-brand shadow-lg"
          style={{ animation: 'slideUp 0.3s ease-out' }}>
          {notification}
        </div>
      )}

      {/* ─── Profile Alignment Card ─── */}
      <div className="rounded-2xl p-5 border flex flex-col md:flex-row gap-4 items-start md:items-center justify-between" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex gap-4 items-center">
          <div className="w-13 h-13 rounded-2xl gradient-brand flex items-center justify-center text-white text-xl font-black shadow-md flex-shrink-0">
            {profile.displayName[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base">{profile.displayName}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                ม.{profile.grade - 7}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              เป้าหมายหลัก: <strong className="text-purple-600 dark:text-purple-400">{profile.targetFaculty}</strong> ({profile.targetUniversity})
            </p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {profile.interests.map(tag => (
                <span key={tag} className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                  style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Level & Goal CTA */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0" style={{ borderColor: 'var(--color-border)' }}>
          <div className="text-left md:text-right">
            <p className="text-[11px] font-semibold" style={{ color: 'var(--color-muted)' }}>สถานะเควสต์สะสม</p>
            <p className="text-sm font-bold text-purple-600 dark:text-purple-400">
              {questSummary.level.emoji} Lv.{questSummary.level.level} ({questSummary.completedQuests}/{questSummary.totalQuests} สำเร็จ)
            </p>
          </div>
          <button
            onClick={onChangeGoal}
            className="px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            style={{ borderColor: 'var(--color-border)' }}
          >
            ✏️ ปรับเป้าหมาย
          </button>
        </div>
      </div>

      {/* ─── Sponsored / Purchased Ad Space Banner ─── */}
      {sponsoredAds && sponsoredAds.length > 0 && (
        <div className="space-y-3">
          {sponsoredAds.slice(0, 1).map(ad => (
            <div
              key={ad.id}
              onClick={() => {
                const foundCamp = allCamps.find(c => c.title === ad.title || c.description === ad.description) || allCamps[0];
                if (foundCamp) onOpenDetail(foundCamp);
              }}
              className="rounded-3xl p-4 sm:p-5 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer shadow-lg hover:shadow-xl transition-all group"
              style={{
                background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
                borderColor: 'rgba(124, 58, 237, 0.35)',
              }}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 shadow-md">
                  <img
                    src={ad.imageUrl || 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800'}
                    alt={ad.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <span className="absolute top-1 left-1 text-[8px] font-black px-1.5 py-0.5 rounded bg-purple-600 text-white shadow-sm">
                    SPONSORED
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 shadow-sm">
                      🌟 ค่ายแนะนำพิเศษ (Featured)
                    </span>
                    <span className="text-xs text-purple-600 dark:text-purple-400 font-bold truncate">
                      โดย {ad.organizerName}
                    </span>
                  </div>
                  <h4 className="text-base font-black truncate mt-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {ad.title}
                  </h4>
                  <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>
                    {ad.description}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="px-4 py-2 rounded-xl text-xs font-extrabold text-white gradient-brand shadow-md whitespace-nowrap flex items-center gap-1 group-hover:scale-105 transition-transform"
              >
                <span>{ad.ctaText || 'ดูรายละเอียดค่าย'}</span>
                <span>→</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ─── Swipe Area + Sidebar ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Swipe Card ─── */}
        <div className="lg:col-span-2">
          {currentMatch ? (
            <div className="flex flex-col items-center gap-5">
              {/* Card Container */}
              <div
                className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-xl select-none"
                style={{
                  aspectRatio: '9/13',
                  transition: swipeAnimation ? 'transform 0.35s ease-in, opacity 0.35s ease-in' : 'none',
                  transform: swipeAnimation
                    ? swipeAnimation.dir === 'right'
                      ? 'translateX(120%) rotate(18deg)'
                      : 'translateX(-120%) rotate(-18deg)'
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

                {/* Match Badge & Category */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="text-white text-xs font-black px-3 py-1.5 rounded-full backdrop-blur-md shadow-md flex items-center gap-1"
                        style={{ background: 'rgba(91, 33, 182, 0.9)' }}
                      >
                        ⚡ {currentMatch.totalScore}% ตรงเป้าหมาย
                      </span>
                      {currentApp && (
                        <span
                          className="text-white text-xs font-black px-3 py-1.5 rounded-full backdrop-blur-md shadow-md flex items-center gap-1"
                          style={{ background: '#0284C7' }}
                        >
                          📬 สมัครแล้ว — รอผล
                        </span>
                      )}
                    </div>
                    {currentMatch.breakdown.profileScore >= 15 && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-amber-200 backdrop-blur-md"
                        style={{ background: 'rgba(245, 158, 11, 0.85)' }}>
                        🎯 ตรงคณะ & มหาวิทยาลัยเป้าหมาย!
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-md text-white"
                    style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)' }}>
                    {currentMatch.camp.isOnline ? '🌐 Online' : '📍 Onsite'}
                  </span>
                </div>

                {/* Bottom Info */}
                <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {currentMatch.camp.tags.map(tag => (
                      <span key={tag} className="text-[11px] font-medium px-2 py-0.5 rounded-full backdrop-blur-md"
                        style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.25)' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h3
                    onClick={() => onOpenDetail(currentMatch.camp, currentMatch.totalScore, currentMatch.breakdown)}
                    className="text-xl font-bold leading-tight mb-1.5 cursor-pointer hover:underline"
                    style={{ fontFamily: 'Syne, sans-serif' }}
                  >
                    {currentMatch.camp.title}
                  </h3>
                  <p className="text-xs opacity-85 line-clamp-2 mb-3 leading-relaxed">
                    {currentMatch.camp.description}
                  </p>
                  <div className="flex items-center justify-between text-xs opacity-90 border-t pt-2.5 border-white/20">
                    <span>📍 {currentMatch.camp.location}</span>
                    <span className="font-bold text-amber-300">
                      {currentMatch.camp.cost === 0 ? '🎓 ฟรีไม่มีค่าใช้จ่าย' : `฿${currentMatch.camp.cost.toLocaleString()}`}
                    </span>
                  </div>
                  {/* Tap to see detail hint */}
                  <button
                    onClick={() => onOpenDetail(currentMatch.camp, currentMatch.totalScore, currentMatch.breakdown)}
                    className="mt-2.5 w-full text-center text-xs font-bold text-white transition-all cursor-pointer py-1.5 rounded-xl flex items-center justify-center gap-1.5 hover:bg-white/30"
                    style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.3)' }}
                  >
                    🔍 ดูรายละเอียดเต็ม & {currentApp ? 'สถานะการสมัคร' : 'สมัครที่นี่'} →
                  </button>
                </div>
              </div>

              {/* Swipe Action Buttons */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleSwipe('left')}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-white transition-all active:scale-95 shadow-md cursor-pointer hover:bg-orange-600"
                  style={{ background: '#EA580C' }}
                  aria-label="ไม่สนใจค่ายนี้"
                >
                  <XIcon /> ข้าม
                </button>

                {onUndoSwipe && (
                  <button
                    onClick={onUndoSwipe}
                    disabled={history.length === 0}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg border transition-all active:scale-90 disabled:opacity-30 disabled:pointer-events-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    title="ย้อนกลับการ์ดล่าสุด (Undo)"
                  >
                    ↩️
                  </button>
                )}

                <button
                  onClick={() => handleSwipe('right')}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-md cursor-pointer hover:brightness-105"
                  style={{ background: '#FBBF24', color: '#0F172A' }}
                  aria-label="สนใจค่ายนี้ (ปัดขวา)"
                >
                  <HeartIcon /> สนใจค่ายนี้! (เก็บเควสต์)
                </button>
              </div>

              {/* Score Breakdown */}
              <div className="w-full max-w-sm rounded-2xl p-4 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <p className="text-[11px] font-bold tracking-wider mb-2.5" style={{ color: 'var(--color-muted)' }}>การคำนวณคะแนน MATCH ENGINE</p>
                <div className="space-y-2">
                  {[
                    { label: 'Tag Match (ความสนใจ)', value: currentMatch.breakdown.tagScore, max: 50, color: '#7C3AED' },
                    { label: 'Profile Fit (เป้าหมายคณะ & มหาวิทยาลัย)', value: currentMatch.breakdown.profileScore, max: 20, color: '#0EA5E9' },
                    { label: 'Affinity (พฤติกรรมการปัด)', value: currentMatch.breakdown.affinityScore, max: 30, color: '#FBBF24' },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-[11px]">{item.label}</span>
                        <span className="font-bold text-[11px]">{item.value}/{item.max}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--color-elevated)' }}>
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
            <div className="flex flex-col items-center justify-center py-16 text-center border rounded-3xl p-8" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <span className="text-6xl mb-4">🏆</span>
              <h3 className="text-xl font-bold mb-2">สำรวจค่ายทั้งหมดครบแล้ว!</h3>
              <p className="mb-6 text-xs max-w-md" style={{ color: 'var(--color-muted)' }}>
                คุณได้พิจารณาค่ายทั้งหมดในระบบเรียบร้อย สามารถไปที่แท็บ <strong>"🎯 เควสต์เก็บเวล"</strong> เพื่อดูเควสต์ที่สำเร็จ และกดยืนยันการเข้าร่วมกิจกรรมเพื่อรับโบนัส XP
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                {onUndoSwipe && (
                  <button
                    onClick={onUndoSwipe}
                    disabled={history.length === 0}
                    className="px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    ↩️ ย้อนกลับการ์ดล่าสุด
                  </button>
                )}
                {onResetSwipes && (
                  <button
                    onClick={onResetSwipes}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer gradient-brand"
                  >
                    🔄 รีเซ็ตค่ายเพื่อทดสอบปัดใหม่
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── Sidebar: Stats & Queue ─── */}
        <div className="space-y-4">
          {/* Swipe Stats */}
          <div className="rounded-2xl p-4 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <p className="text-xs font-bold mb-3" style={{ color: 'var(--color-muted)' }}>📊 สถิติการปัดค่าย</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'สนใจ', value: swipeStats.rights, color: '#FBBF24', emoji: '❤️' },
                { label: 'ข้าม', value: swipeStats.lefts, color: '#F97316', emoji: '✕' },
                { label: 'ทั้งหมด', value: swipeStats.total, color: '#7C3AED', emoji: '📋' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-2.5" style={{ background: 'var(--color-elevated)' }}>
                  <p className="text-xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{s.emoji} {s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Affinity Map */}
          <div className="rounded-2xl p-4 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-muted)' }}>🧠 Tag Affinity (วิเคราะห์ความสนใจจริง)</p>
            {affinityDisplay.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>ยังไม่มีข้อมูล — ปัดขวาค่ายที่สนใจเพื่อสะสมคะแนน!</p>
            ) : (
              <div className="space-y-2">
                {affinityDisplay.map(([tag, weight]) => (
                  <div key={tag} className="flex items-center gap-2 text-xs">
                    <span className="font-semibold w-24 truncate">{tag}</span>
                    <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--color-elevated)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((weight / (affinityDisplay[0]?.[1] || 1)) * 100, 100)}%`,
                          background: '#7C3AED',
                        }}
                      />
                    </div>
                    <span className="font-mono w-7 text-right text-[10px]" style={{ color: 'var(--color-muted)' }}>
                      {weight.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Up Next Queue */}
          <div className="rounded-2xl p-4 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <p className="text-xs font-bold mb-3" style={{ color: 'var(--color-muted)' }}>📋 ลำดับค่ายถัดไป ({matchResults.length} ค่าย)</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {matchResults.slice(0, 4).map((result, i) => {
                const isApplied = appliedMap.has(result.campId);
                return (
                  <div
                    key={result.campId}
                    onClick={() => onOpenDetail(result.camp, result.totalScore, result.breakdown)}
                    className="flex items-center gap-2.5 rounded-xl p-2 cursor-pointer transition-all hover:scale-[1.01] hover:bg-purple-50 dark:hover:bg-purple-950/30"
                    style={{ background: i === 0 ? 'var(--color-brand-50, #F5F3FF)' : 'transparent' }}
                    title="คลิกเพื่อดูรายละเอียดเต็ม"
                  >
                    <span className="text-xs font-bold w-4 text-center" style={{ color: 'var(--color-muted)' }}>#{i + 1}</span>
                    <img src={result.camp.coverImageUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{result.camp.title}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>{result.camp.tags.slice(0, 2).join(', ')}</p>
                        {isApplied && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                            ✓ สมัครแล้ว
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{result.totalScore}%</span>
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

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Quest System Demo ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function QuestDemo({ 
  profile, 
  history, 
  checklist, 
  questTemplates,
  summary,
  onConfirmAttendance,
  onManualComplete,
  onSwitchToMatch,
  onChangeGoal,
  onOpenDetail,
}: { 
  profile: StudentProfile; 
  history: SwipeRecord[]; 
  checklist: PortfolioChecklist;
  questTemplates: QuestTemplate[];
  summary: ReturnType<typeof getChecklistSummary>;
  onConfirmAttendance: (campId: string) => Promise<void>;
  onManualComplete: (template: QuestTemplate) => Promise<void>;
  onSwitchToMatch: () => void;
  onChangeGoal: () => void;
  onOpenDetail?: (camp: Camp) => void;
}) {
  const campLookup = useMemo(() => new Map(mockCamps.map(c => [c.id, c])), []);

  // Filter camps swiped right
  const enrolledCamps = useMemo(() => {
    const map = new Map<string, SwipeRecord>();
    for (const h of history) {
      if (h.action === 'right' || h.action === 'super_right') {
        map.set(h.campId, h);
      }
    }
    return Array.from(map.entries()).map(([campId, record]) => {
      const camp = campLookup.get(campId);
      return { camp, record };
    }).filter((item): item is { camp: Camp; record: SwipeRecord } => item.camp !== undefined);
  }, [history, campLookup]);

  return (
    <div className="space-y-6">
      {/* ─── Level Card & Summary ─── */}
      <div className="rounded-3xl p-6 border shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                🎯 แผนการสะสมพอร์ต TCAS
              </span>
              <button onClick={onChangeGoal} className="text-xs underline text-purple-600 dark:text-purple-400 cursor-pointer">
                เปลี่ยนเป้าหมาย
              </button>
            </div>
            <h2 className="text-2xl font-black mt-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              {profile.targetFaculty} • {profile.targetUniversity}
            </h2>
          </div>

          {/* Level Pill */}
          <div
            className="px-5 py-2.5 rounded-2xl text-white font-extrabold text-sm flex items-center gap-2.5 shadow-md"
            style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)' }}
          >
            <span className="text-xl">{summary.level.emoji}</span>
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-80">ระดับพอร์ตฟอลิโอ</p>
              <p className="text-sm font-black">เลเวล {summary.level.level}: {summary.level.label}</p>
            </div>
            <span className="ml-1 px-2.5 py-1 rounded-xl text-xs bg-white/20 font-mono">
              {summary.totalXP} XP
            </span>
          </div>
        </div>

        {/* Level XP Bar */}
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1.5">
            <span style={{ color: 'var(--color-muted)' }}>ความคืบหน้าสู่เลเวลถัดไป</span>
            <span className="text-purple-600 dark:text-purple-400 font-bold">{Math.round(summary.levelProgress)}%</span>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-elevated)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${summary.levelProgress}%`,
                background: 'linear-gradient(to right, #A78BFA, #6D28D9)',
              }}
            />
          </div>
        </div>

        {/* 3 Stats Boxes */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl p-3 text-center border" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
            <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{summary.completedQuests}</p>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>เควสต์สำเร็จ</p>
          </div>
          <div className="rounded-2xl p-3 text-center border" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
            <p className="text-2xl font-black text-sky-500">{summary.totalQuests}</p>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>เควสต์ทั้งหมด</p>
          </div>
          <div className="rounded-2xl p-3 text-center border" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
            <p className="text-2xl font-black text-amber-500">{summary.progressPercent}%</p>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>ความพร้อม TCAS</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Left 2 Cols: Quest List ─── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-3xl p-6 border shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
                  🗺️ เควสต์ที่ตรงกับเป้าหมาย ({profile.targetFaculty})
                </h3>
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  ปัดเลือกค่ายหรือเข้าร่วมกิจกรรมเพื่อ auto-check เควสต์และรับ XP
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {questTemplates.map(template => {
                const progress = checklist.quests.find(q => q.questId === template.id);
                const isCompleted = progress?.completed ?? false;
                const cat = CATEGORY_LABELS[template.category] ?? { label: template.category, emoji: '📎' };
                const required = template.requiredCount ?? 1;
                const currentCount = progress?.currentCount ?? 0;
                const isFacultySpecific = template.id.startsWith('quest-fac');

                return (
                  <div
                    key={template.id}
                    className="flex items-start gap-3.5 rounded-2xl p-4 transition-all border"
                    style={{
                      background: isCompleted ? 'var(--color-brand-50, #F5F3FF)' : 'var(--color-elevated)',
                      borderColor: isCompleted ? '#DDD6FE' : 'var(--color-border)',
                      opacity: isCompleted ? 0.85 : 1,
                    }}
                  >
                    {/* Circle Check */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm"
                      style={{
                        background: isCompleted ? '#7C3AED' : 'var(--color-border)',
                        color: isCompleted ? 'white' : 'var(--color-muted)',
                      }}
                    >
                      {isCompleted ? <CheckIcon /> : <span className="text-xs font-bold">{currentCount}</span>}
                    </div>

                    {/* Quest Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="text-sm font-bold">{template.title}</span>
                        {isFacultySpecific && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            🎯 ตรงคณะ
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                          {cat.emoji} {cat.label}
                        </span>
                        {template.autoCheckable ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            ⚡ Auto-Check
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                            📁 ส่งหลักฐาน
                          </span>
                        )}
                      </div>

                      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                        {template.description}
                      </p>

                      {/* Progress Bar */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--color-border)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min((currentCount / required) * 100, 100)}%`,
                              background: isCompleted ? '#7C3AED' : '#0EA5E9',
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-mono font-bold" style={{ color: 'var(--color-muted)' }}>
                          {currentCount}/{required}
                        </span>
                      </div>
                    </div>

                    {/* XP & Manual Button */}
                    <div className="text-right flex-shrink-0">
                      <span className="flex items-center justify-end gap-1 text-sm font-extrabold text-amber-500">
                        <StarIcon className="w-4 h-4" /> +{template.xpReward}
                      </span>
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--color-muted)' }}>XP</span>
                      
                      {!template.autoCheckable && !isCompleted && (
                        <button
                          onClick={() => onManualComplete(template)}
                          className="mt-2 block w-full text-xs px-2.5 py-1 rounded-lg text-white font-bold gradient-brand shadow-sm transition-all active:scale-95 cursor-pointer"
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

        {/* ─── Right 1 Col: Enrolled Camps & Activity Attendance ─── */}
        <div className="space-y-4">
          <div className="rounded-3xl p-5 border shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>
                  ⛺ ค่ายที่สนใจ & กิจกรรมที่เข้าร่วม
                </h4>
                <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                  ยืนยันการเข้าร่วมเพื่อรับโบนัส +50 XP
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                {enrolledCamps.length} กิจกรรม
              </span>
            </div>

            {enrolledCamps.length === 0 ? (
              <div className="text-center py-6 px-4 rounded-2xl border border-dashed" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-2xl mb-1">🔍</p>
                <p className="text-xs font-bold mb-1">ยังไม่มีค่ายที่สนใจ</p>
                <p className="text-[11px] mb-3 opacity-70">
                  ไปที่หน้า Match Engine เพื่อปัดเลือกค่ายที่ชอบ แล้วระบบจะ auto-check เควสต์ให้
                </p>
                <button
                  onClick={onSwitchToMatch}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white gradient-brand shadow-sm cursor-pointer"
                >
                  ⚡ ไปหน้า Match Engine
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {enrolledCamps.map(({ camp, record }) => {
                  const isAttended = record.action === 'super_right';
                  return (
                    <div key={camp.id} className="p-3 rounded-2xl border" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
                      <div
                        className="flex gap-2.5 items-start cursor-pointer hover:opacity-90"
                        onClick={() => onOpenDetail?.(camp)}
                        title="คลิกเพื่อดูรายละเอียดค่าย"
                      >
                        <img src={camp.coverImageUrl} alt="" className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate hover:underline">{camp.title}</p>
                          <p className="text-[10px] truncate" style={{ color: 'var(--color-muted)' }}>{camp.location}</p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {isAttended ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center gap-1">
                                <CheckIcon className="w-2.5 h-2.5" /> เข้าร่วมกิจกรรมแล้ว (+50 XP)
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                ❤️ สนใจแล้ว
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Attend Confirmation Button */}
                      {!isAttended && (
                        <button
                          onClick={() => onConfirmAttendance(camp.id)}
                          className="mt-2.5 w-full py-1.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
                          style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                        >
                          <CheckIcon className="w-3.5 h-3.5" /> ยืนยันเข้าร่วมกิจกรรมแล้ว (+50 XP)
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Category Progress breakdown */}
          <div className="rounded-3xl p-5 border shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h4 className="text-xs font-bold mb-3" style={{ color: 'var(--color-muted)' }}>📊 ความคืบหน้าตามหมวด TCAS</h4>
            <div className="space-y-2.5">
              {Array.from(summary.byCategory.entries()).map(([cat, data]) => {
                const catInfo = CATEGORY_LABELS[cat] ?? { label: cat, emoji: '📎' };
                const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-[11px]">{catInfo.emoji} {catInfo.label}</span>
                      <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>{data.completed}/{data.total}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--color-elevated)' }}>
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

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Profile & Applications Demo ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const APP_STATUS_BADGE: Record<string, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  applied:    { label: 'สมัครแล้ว — รอผล',    color: '#0284C7', bg: '#E0F2FE', border: '#BAE6FD', emoji: '📬' },
  reviewed:   { label: 'อยู่ระหว่างพิจารณา', color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', emoji: '🔍' },
  accepted:   { label: 'ได้รับการตอบรับ ✓',   color: '#059669', bg: '#D1FAE5', border: '#A7F3D0', emoji: '🎉' },
  waitlisted: { label: 'อยู่ใน Waitlist',      color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', emoji: '⏳' },
  rejected:   { label: 'ไม่ผ่านการคัดเลือก', color: '#DC2626', bg: '#FEE2E2', border: '#FECACA', emoji: '❌' },
};

function ProfileDemo({
  profile,
  applications,
  checklist: _checklist,
  summary,
  history,
  onOpenDetail,
  onChangeGoal,
  onSwitchToMatch,
}: {
  profile: StudentProfile;
  applications: CampApplication[];
  checklist: PortfolioChecklist;
  summary: ReturnType<typeof getChecklistSummary>;
  history: SwipeRecord[];
  onOpenDetail: (camp: Camp) => void;
  onChangeGoal: () => void;
  onSwitchToMatch: () => void;
}) {
  const campLookup = useMemo(() => new Map(mockCamps.map(c => [c.id, c])), []);

  // Filter camps swiped right
  const enrolledCamps = useMemo(() => {
    const map = new Map<string, SwipeRecord>();
    for (const h of history) {
      if (h.action === 'right' || h.action === 'super_right') {
        map.set(h.campId, h);
      }
    }
    return Array.from(map.entries())
      .map(([campId, record]) => ({
        camp: campLookup.get(campId),
        record,
      }))
      .filter((item): item is { camp: Camp; record: SwipeRecord } => item.camp !== undefined);
  }, [history, campLookup]);

  const fmtDate = (d: any) => {
    try {
      const date = d instanceof Date ? d : new Date(d);
      return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return String(d || '');
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Profile Header ─── */}
      <div
        className="rounded-3xl p-6 border shadow-sm"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* User Info */}
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black shadow-md flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)', color: '#fff' }}
            >
              {profile.displayName?.charAt(0) || '👤'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {profile.displayName}
                </h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  ม.{profile.grade - 6}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                {profile.school} • {profile.email}
              </p>
            </div>
          </div>

          {/* Level Pill */}
          <div
            className="px-5 py-3 rounded-2xl text-white font-extrabold text-sm flex items-center gap-3 shadow-md"
            style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)' }}
          >
            <span className="text-2xl">{summary.level.emoji}</span>
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-80">ระดับพอร์ตฟอลิโอ</p>
              <p className="text-sm font-black">เลเวล {summary.level.level}: {summary.level.label}</p>
            </div>
            <span className="ml-2 px-2.5 py-1 rounded-xl text-xs bg-white/20 font-mono">
              {summary.totalXP} XP
            </span>
          </div>
        </div>

        {/* Goal Card */}
        <div
          className="mt-5 p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
        >
          <div>
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
              🎯 คณะ & มหาวิทยาลัยเป้าหมาย
            </span>
            <p className="text-base font-black mt-0.5">
              {profile.targetFaculty} • {profile.targetUniversity}
            </p>
          </div>
          <button
            onClick={onChangeGoal}
            className="px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-300"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            ✏️ เปลี่ยนเป้าหมาย
          </button>
        </div>

        {/* Interests & Skills */}
        <div className="mt-4 flex flex-wrap gap-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <p className="text-[11px] font-bold mb-1.5" style={{ color: 'var(--color-muted)' }}>💡 ความสนใจ:</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.interests?.map(i => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-semibold">
                  #{i}
                </span>
              ))}
            </div>
          </div>
          {profile.skills && profile.skills.length > 0 && (
            <div>
              <p className="text-[11px] font-bold mb-1.5" style={{ color: 'var(--color-muted)' }}>🛠️ ทักษะที่มี:</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map(s => (
                  <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 font-semibold">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── SECTION 1: Applied Camps (REQUIREMENT #3) ─── */}
      <div
        className="rounded-3xl p-6 border shadow-sm"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black" style={{ fontFamily: 'Syne, sans-serif' }}>
                📬 รายการกิจกรรม/ค่ายที่สมัครแล้วทั้งหมด
              </h3>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                {applications.length} รายการ
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              ติดตามสถานะการพิจารณาใบสมัครของแต่ละกิจกรรมได้ที่นี่
            </p>
          </div>

          <button
            onClick={onSwitchToMatch}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white gradient-brand shadow-sm cursor-pointer"
          >
            ⚡ สำรวจค่ายเพิ่ม
          </button>
        </div>

        {applications.length === 0 ? (
          <div
            className="text-center py-10 px-4 rounded-2xl border border-dashed"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-elevated)' }}
          >
            <span className="text-4xl mb-2 block">📭</span>
            <p className="text-sm font-bold mb-1">ยังไม่มีรายการสมัครกิจกรรม</p>
            <p className="text-xs mb-4 max-w-sm mx-auto" style={{ color: 'var(--color-muted)' }}>
              ไปที่หน้า <strong>⚡ Match</strong> แตะดูรายละเอียดค่ายที่ชอบ แล้วกดปุ่ม <strong>&ldquo;สมัครเข้าร่วมกิจกรรมนี้&rdquo;</strong> เพื่อเริ่มต้นสะสมผลงาน
            </p>
            <button
              onClick={onSwitchToMatch}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white gradient-brand shadow-md transition-all active:scale-95 cursor-pointer"
            >
              🚀 ไปสำรวจค่ายและสมัคร
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {applications.map(app => {
              const camp = campLookup.get(app.campId);
              const badge = APP_STATUS_BADGE[app.status] || APP_STATUS_BADGE.applied;
              return (
                <div
                  key={app.id || app.campId}
                  className="rounded-2xl p-4 border transition-all hover:shadow-md flex flex-col justify-between"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex gap-3 items-start">
                    <img
                      src={app.campCoverImageUrl || camp?.coverImageUrl || 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800'}
                      alt={app.campTitle}
                      className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1"
                          style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
                        >
                          {badge.emoji} {badge.label}
                        </span>
                        {app.payment && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                              app.payment.status === 'paid' 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                            }`}
                          >
                            💳 {app.payment.status === 'paid' ? `ชำระแล้ว ฿${app.payment.amount.toLocaleString()}` : 'ฟรี (ยืนยันแล้ว)'}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold truncate leading-tight">
                        {app.campTitle}
                      </h4>
                      {camp && (
                        <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--color-muted)' }}>
                          📍 {camp.location}
                        </p>
                      )}
                      <p className="text-[10px] mt-1" style={{ color: 'var(--color-muted)' }}>
                        สมัครเมื่อ: {fmtDate(app.appliedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--color-muted)' }}>
                      ID: #{app.campId}
                    </span>
                    <button
                      onClick={() => {
                        const targetCamp = camp || {
                          id: app.campId,
                          organizerId: 'org-001',
                          title: app.campTitle,
                          description: 'รายละเอียดกิจกรรม',
                          coverImageUrl: app.campCoverImageUrl,
                          tags: ['Activity'],
                          targetGrades: [10, 11, 12],
                          startDate: new Date(),
                          endDate: new Date(),
                          location: 'จุฬาลงกรณ์มหาวิทยาลัย',
                          isOnline: false,
                          applicationDeadline: new Date('2026-12-31'),
                          status: 'published',
                          cost: 0,
                          createdAt: new Date(),
                          metrics: { views: 100, swipesRight: 50, applications: 10 },
                        } as Camp;
                        onOpenDetail(targetCamp);
                      }}
                      className="px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                    >
                      ดูข้อมูล & E-Ticket 📄
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── SECTION 2: Interested Camps (Swiped Right) ─── */}
      <div
        className="rounded-3xl p-6 border shadow-sm"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black" style={{ fontFamily: 'Syne, sans-serif' }}>
              ⛺ ค่ายที่สนใจ (ปัดขวาไว้)
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              {enrolledCamps.length} กิจกรรม
            </span>
          </div>
        </div>

        {enrolledCamps.length === 0 ? (
          <p className="text-xs py-4 text-center" style={{ color: 'var(--color-muted)' }}>
            ยังไม่มีค่ายที่ปัดขวาไว้ ไปที่แท็บ ⚡ Match เพื่อเลือกค่ายที่สนใจ
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {enrolledCamps.map(({ camp }) => (
              <div
                key={camp.id}
                onClick={() => onOpenDetail(camp)}
                className="p-3 rounded-2xl border transition-all hover:scale-[1.01] cursor-pointer"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
              >
                <img src={camp.coverImageUrl} alt="" className="w-full h-24 rounded-xl object-cover mb-2" />
                <p className="text-xs font-bold truncate">{camp.title}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--color-muted)' }}>📍 {camp.location}</p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="text-[10px] font-bold text-amber-500">
                    {camp.cost === 0 ? 'ฟรี' : `฿${camp.cost.toLocaleString()}`}
                  </span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                    ดูรายละเอียด →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
