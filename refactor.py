import re

with open('src/pages/StudentDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
imports = """import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  mockCamps,
  mockQuestTemplates,
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
  getLevelProgress,
} from '../utils/questEngine';
import type {
  SwipeRecord,
  MatchResult,
  PortfolioChecklist,
  QuestTemplate,
  Camp,
  StudentProfile,
} from '../types/models';
import { useAuth } from '../contexts/AuthContext';
import { fetchSwipeHistory, recordSwipe, fetchChecklist, saveChecklist } from '../services/studentService';
import { useNavigate } from 'react-router-dom';
import { auth } from '../config/firebase';
import '../App.css';"""

content = re.sub(r"import \{ useState, useMemo, useCallback \} from 'react';.*?import '\.\/App\.css';", imports, content, flags=re.DOTALL)

# 2. Update App component definition
app_comp = """export default function StudentDashboard() {
  const { profile } = useAuth();
  const studentProfile = profile as StudentProfile | null;
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'match' | 'quest'>('match');
  const [dark, setDark] = useState(false);
  
  const [history, setHistory] = useState<SwipeRecord[]>([]);
  const [checklist, setChecklist] = useState<PortfolioChecklist | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!studentProfile) return;
    const loadData = async () => {
      setLoadingData(true);
      try {
        const hist = await fetchSwipeHistory(studentProfile.id);
        setHistory(hist);
        
        let chk = await fetchChecklist(studentProfile.id);
        if (!chk) {
          chk = initializeChecklist(studentProfile.id, mockQuestTemplates, studentProfile.targetUniversity, studentProfile.targetFaculty);
          await saveChecklist(studentProfile.id, chk);
        }
        setChecklist(chk);
      } catch(e) {
        console.error(e);
      } finally {
        setLoadingData(false);
      }
    };
    loadData();
  }, [studentProfile]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const toggleDark = () => {
    setDark(d => {
      document.documentElement.classList.toggle('dark', !d);
      return !d;
    });
  };

  if (loadingData || !studentProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-brand-500)', borderTopColor: 'transparent' }} />
      </div>
    );
  }
"""
content = re.sub(r"function App\(\) \{.*?const toggleDark = \(\) => \{.*?\}\);.*?  \};", app_comp, content, flags=re.DOTALL)

# 3. Update <header> to include logout button
header_nav = """<button
              onClick={toggleDark}
              className="p-2 rounded-xl transition-colors"
              style={{ color: 'var(--color-muted)' }}
              aria-label={dark ? 'Light Mode' : 'Dark Mode'}
            >
              {dark ? '☀️' : '🌙'}
            </button>
            <button onClick={handleLogout} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-100 text-red-600 transition-colors hover:bg-red-200">
              Logout
            </button>"""
content = re.sub(r"<button\s+onClick=\{toggleDark\}.*?</button>", header_nav, content, flags=re.DOTALL)

# 4. Update Main Content usage
main_content = """<main className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === 'match' ? (
          <MatchDemo profile={studentProfile} history={history} setHistory={setHistory} />
        ) : (
          checklist && <QuestDemo profile={studentProfile} history={history} setHistory={setHistory} checklist={checklist} setChecklist={setChecklist} />
        )}
      </main>"""
content = re.sub(r"<main className=\"max-w-5xl mx-auto px-6 py-8\">.*?</main>", main_content, content, flags=re.DOTALL)

# 5. Replace export default App
content = re.sub(r"export default App;", "", content)

# 6. Update MatchDemo definition
match_demo = """function MatchDemo({ profile, history, setHistory }: { profile: StudentProfile, history: SwipeRecord[], setHistory: React.Dispatch<React.SetStateAction<SwipeRecord[]>> }) {
  const [swipeAnimation, setSwipeAnimation] = useState<{ id: string; dir: 'left' | 'right' } | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // สร้าง lookup map
  const campLookup = useMemo(() => new Map(mockCamps.map(c => [c.id, c])), []);

  // คำนวณ match scores
  const matchResults = useMemo(() => {
    const affinityMap = buildAffinityMap(history, campLookup);
    const unswiped = filterUnswipedCamps(mockCamps, history);
    return computeMatchScores(profile, unswiped, affinityMap);
  }, [history, campLookup, profile]);

  // Current card = top of ranked list
  const currentMatch = matchResults[0];

  const handleSwipe = useCallback(async (action: 'left' | 'right') => {
    if (!currentMatch) return;

    setSwipeAnimation({ id: currentMatch.campId, dir: action });

    setTimeout(async () => {
      const newRecord = {
        studentId: profile.id,
        campId: currentMatch.campId,
        action,
        timestamp: new Date(),
      };
      
      try {
        const docId = await recordSwipe(newRecord);
        setHistory(prev => [...prev, { ...newRecord, id: docId }]);
      } catch (err) {
        console.error("Failed to save swipe:", err);
      }
      
      setSwipeAnimation(null);

      if (action === 'right') {
        setNotification(`❤️ สนใจ "${currentMatch.camp.title}"!`);
      } else {
        setNotification(`✕ ข้ามค่าย "${currentMatch.camp.title}"`);
      }
      setTimeout(() => setNotification(null), 2500);
    }, 400);
  }, [currentMatch, profile.id, setHistory]);"""
content = re.sub(r"function MatchDemo\(\) \{.*?\}, \[currentMatch\]\);", match_demo, content, flags=re.DOTALL)

# 7. Update QuestDemo definition
quest_demo = """function QuestDemo({ profile, history, setHistory, checklist, setChecklist }: { 
  profile: StudentProfile, 
  history: SwipeRecord[], 
  setHistory: React.Dispatch<React.SetStateAction<SwipeRecord[]>>,
  checklist: PortfolioChecklist,
  setChecklist: React.Dispatch<React.SetStateAction<PortfolioChecklist | null>>
}) {
  const [levelUpAnim, setLevelUpAnim] = useState(false);
  const [completionToast, setCompletionToast] = useState<string | null>(null);

  const campLookup = useMemo(() => new Map(mockCamps.map(c => [c.id, c])), []);

  const summary = useMemo(() => getChecklistSummary(checklist, mockQuestTemplates), [checklist]);

  // Simulate สถานการณ์ "ปัดขวาค่ายใหม่" แล้วระบบ auto-check quest
  const simulateSwipe = useCallback(async (camp: Camp) => {
    const newRecord = {
      studentId: profile.id,
      campId: camp.id,
      action: 'right' as const,
      timestamp: new Date(),
    };
    
    try {
      const docId = await recordSwipe(newRecord);
      const newHistory = [...history, { ...newRecord, id: docId }];
      setHistory(newHistory);

      // Auto evaluate quests
      const result = evaluateAutoQuests(
        { ...checklist, quests: checklist.quests.map(q => ({ ...q })) },
        mockQuestTemplates,
        newHistory,
        campLookup,
      );

      setChecklist(result.updatedChecklist);
      await saveChecklist(profile.id, result.updatedChecklist);

      if (result.newlyCompleted.length > 0) {
        const names = result.newlyCompleted.map(c => `"${c.quest.title}" (+${c.xpEarned} XP)`).join(', ');
        setCompletionToast(`🎯 เควสต์สำเร็จ! ${names}`);
        setTimeout(() => setCompletionToast(null), 4000);
      }

      if (result.leveledUp) {
        setLevelUpAnim(true);
        setTimeout(() => setLevelUpAnim(false), 2000);
      }
    } catch(err) {
      console.error(err);
    }
  }, [history, checklist, campLookup, profile.id, setHistory, setChecklist]);

  // Manual complete
  const handleManualComplete = useCallback(async (template: QuestTemplate) => {
    const updated = completeManualQuest(
      { ...checklist, quests: checklist.quests.map(q => ({ ...q })) },
      template,
      'https://example.com/proof.pdf',
    );
    setChecklist(updated);
    await saveChecklist(profile.id, updated);
    setCompletionToast(`🎯 "${template.title}" สำเร็จ! (+${template.xpReward} XP)`);
    setTimeout(() => setCompletionToast(null), 3000);
  }, [checklist, profile.id, setChecklist]);"""

content = re.sub(r"function QuestDemo\(\) \{.*?\}, \[checklist\]\);", quest_demo, content, flags=re.DOTALL)

# 8. Replace mockStudent inside MatchDemo and QuestDemo JSX
content = re.sub(r"mockStudent", "profile", content)

with open('src/pages/StudentDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
