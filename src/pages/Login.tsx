import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { mockStudent } from '../data/mockData';
import { useAuth } from '../contexts/AuthContext';
import type { StudentProfile, OrganizerProfile } from '../types/models';
import { fetchStudentProfile } from '../services/studentService';

const AVAILABLE_INTERESTS = [
  { id: 'Technology', label: '💻 เทคโนโลยี & AI' },
  { id: 'Robotics', label: '🤖 หุ่นยนต์ & วิศวะ' },
  { id: 'Science', label: '🔬 วิทยาศาสตร์' },
  { id: 'Medicine', label: '🩺 การแพทย์ & สุขภาพ' },
  { id: 'Business', label: '💼 บริหาร & การเงิน' },
  { id: 'Design', label: '🎨 ศิลปะ & ออกแบบ' },
  { id: 'Math', label: '📐 คณิตศาสตร์' },
  { id: 'Leadership', label: '🤝 ภาวะผู้นำ & สังคม' },
];

export const FACULTY_PRESETS = [
  {
    label: '⚙️ วิศวะ จุฬาฯ',
    faculty: 'คณะวิศวกรรมศาสตร์',
    university: 'จุฬาลงกรณ์มหาวิทยาลัย',
    interests: ['Technology', 'Robotics', 'Science', 'Math'],
  },
  {
    label: '🩺 แพทย์ จุฬาฯ',
    faculty: 'คณะแพทยศาสตร์',
    university: 'จุฬาลงกรณ์มหาวิทยาลัย',
    interests: ['Medicine', 'Health', 'Biology', 'Science'],
  },
  {
    label: '💼 บริหาร มธ.',
    faculty: 'คณะพาณิชยศาสตร์และการบัญชี (BBA)',
    university: 'มหาวิทยาลัยธรรมศาสตร์',
    interests: ['Business', 'Leadership', 'Management', 'Competition'],
  },
  {
    label: '🎨 สถาปัตย์ ศิลปากร',
    faculty: 'คณะสถาปัตยกรรมศาสตร์',
    university: 'มหาวิทยาลัยศิลปากร',
    interests: ['Design', 'Art', 'Creative', 'Technology'],
  },
  {
    label: '🔬 วิทย์ มหิดล',
    faculty: 'คณะวิทยาศาสตร์',
    university: 'มหาวิทยาลัยมหิดล',
    interests: ['Science', 'Chemistry', 'Physics', 'Biology'],
  },
];

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'student' | 'organizer'>('student');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [grade, setGrade] = useState<number>(11); // 10 = ม.4, 11 = ม.5, 12 = ม.6
  const [school, setSchool] = useState('');
  const [targetUniversity, setTargetUniversity] = useState('จุฬาลงกรณ์มหาวิทยาลัย');
  const [targetFaculty, setTargetFaculty] = useState('คณะวิศวกรรมศาสตร์');
  const [organizationName, setOrganizationName] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['Technology', 'Science', 'Robotics']);

  const { setUserSession } = useAuth();
  const navigate = useNavigate();

  // Detect saved profile by email in localStorage
  const savedProfile = useMemo(() => {
    if (!email.trim()) return null;
    try {
      const saved = localStorage.getItem(`sp_user_profile_${email.toLowerCase().trim()}`);
      if (saved) return JSON.parse(saved) as StudentProfile;
    } catch {}
    return null;
  }, [email]);

  // Helper: auto-suggest interests when target faculty changes
  const handleFacultyChange = (val: string) => {
    setTargetFaculty(val);
    const lower = val.toLowerCase();
    if (lower.includes('แพทย์') || lower.includes('หมอ') || lower.includes('พยาบาล') || lower.includes('ทันตะ') || lower.includes('สาธารณสุข')) {
      setSelectedInterests(['Medicine', 'Science', 'Leadership']);
    } else if (lower.includes('วิศว') || lower.includes('คอม') || lower.includes('ไอที') || lower.includes('ai')) {
      setSelectedInterests(['Technology', 'Robotics', 'Science', 'Math']);
    } else if (lower.includes('บริหาร') || lower.includes('บัญชี') || lower.includes('เศรษฐ') || lower.includes('ธุรกิจ')) {
      setSelectedInterests(['Business', 'Leadership', 'Management', 'Competition']);
    } else if (lower.includes('ศิลป') || lower.includes('ออก') || lower.includes('สถาปัตย์') || lower.includes('นิเทศ')) {
      setSelectedInterests(['Design', 'Technology', 'Art', 'Creative']);
    }
  };

  const handleSelectPreset = (p: typeof FACULTY_PRESETS[0]) => {
    setTargetFaculty(p.faculty);
    setTargetUniversity(p.university);
    setSelectedInterests(p.interests);
  };

  // Submit handler (Login or Register)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setErrorMessage('กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน');
      return;
    }

    if (mode === 'register') {
      if (password.length < 6) {
        setErrorMessage('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
        return;
      }
      if (!displayName.trim()) {
        setErrorMessage(role === 'student' ? 'กรุณาระบุชื่อ-นามสกุล' : 'กรุณาระบุชื่อผู้ประสานงาน');
        return;
      }
      if (role === 'organizer' && !organizationName.trim()) {
        setErrorMessage('กรุณาระบุชื่อองค์กร/หน่วยงาน');
        return;
      }
    }

    setLoading(true);

    try {
      let uid: string = 'user_' + Date.now();
      let isLiveFirebase = false;

      // Try Firebase Auth with 1.5s timeout
      try {
        if (mode === 'register') {
          const cred = await Promise.race([
            createUserWithEmailAndPassword(auth, email.trim(), password),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Firebase timeout')), 1500))
          ]);
          uid = cred.user.uid;
          isLiveFirebase = true;
        } else {
          const cred = await Promise.race([
            signInWithEmailAndPassword(auth, email.trim(), password),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Firebase timeout')), 1500))
          ]);
          uid = cred.user.uid;
          isLiveFirebase = true;
        }
      } catch (authErr: any) {
        console.warn("Firebase Auth bypassed or not enabled in console, using smart local session:", authErr);
        if (authErr?.code === 'auth/wrong-password' || authErr?.code === 'auth/invalid-credential') {
          setErrorMessage('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
          setLoading(false);
          return;
        }
      }

      // Build User Profile with 100% adherence to user input & persistence
      if (role === 'student') {
        const localSavedKey = `sp_user_profile_${email.toLowerCase().trim()}`;
        const existingSaved = localStorage.getItem(localSavedKey);
        let existingProfile: StudentProfile | null = null;
        try {
          if (existingSaved) existingProfile = JSON.parse(existingSaved);
        } catch {}

        if (isLiveFirebase) {
          try {
            const fsProfile = await fetchStudentProfile(uid);
            if (fsProfile) existingProfile = fsProfile;
          } catch {}
        }

        const isRegistering = mode === 'register';

        const studentData: StudentProfile = {
          ...mockStudent,
          ...((!isRegistering && existingProfile) ? existingProfile : {}),
          id: uid,
          email: email.trim(),
          displayName: isRegistering
            ? (displayName.trim() || email.split('@')[0])
            : (existingProfile?.displayName || displayName.trim() || email.split('@')[0]),
          grade: isRegistering
            ? grade
            : (existingProfile?.grade || grade || 11),
          school: isRegistering
            ? (school.trim() || 'โรงเรียนเตรียมอุดมศึกษา')
            : (existingProfile?.school || school.trim() || 'โรงเรียนเตรียมอุดมศึกษา'),
          targetUniversity: isRegistering
            ? (targetUniversity.trim() || 'จุฬาลงกรณ์มหาวิทยาลัย')
            : (existingProfile?.targetUniversity || targetUniversity.trim() || 'จุฬาลงกรณ์มหาวิทยาลัย'),
          targetFaculty: isRegistering
            ? (targetFaculty.trim() || 'คณะวิศวกรรมศาสตร์')
            : (existingProfile?.targetFaculty || targetFaculty.trim() || 'คณะวิศวกรรมศาสตร์'),
          interests: isRegistering
            ? (selectedInterests.length > 0 ? selectedInterests : ['Technology', 'Science', 'Leadership'])
            : (existingProfile?.interests || (selectedInterests.length > 0 ? selectedInterests : ['Technology', 'Science', 'Leadership'])),
          createdAt: existingProfile?.createdAt ? new Date(existingProfile.createdAt) : new Date(),
          updatedAt: new Date(),
        };

        // Cache persistently by email and by uid
        localStorage.setItem(localSavedKey, JSON.stringify(studentData));
        localStorage.setItem(`sp_user_profile_${uid}`, JSON.stringify(studentData));

        if (isRegistering) {
          // Reset local swipe history and checklist so fresh session starts aligned with target
          localStorage.removeItem(`sp_local_swipes_${uid}`);
          localStorage.removeItem(`sp_local_checklist_${uid}`);
        }

        await setUserSession(
          { uid, email: email.trim(), isAnonymous: !isLiveFirebase },
          studentData
        );
        navigate('/');
      } else {
        const localOrgKey = `sp_org_profile_${email.toLowerCase().trim()}`;
        const existingOrgSaved = localStorage.getItem(localOrgKey);
        let existingOrg: OrganizerProfile | null = null;
        try {
          if (existingOrgSaved) existingOrg = JSON.parse(existingOrgSaved);
        } catch {}

        const organizerData: OrganizerProfile = {
          id: uid,
          email: email.trim(),
          role: 'organizer',
          organizationName: organizationName.trim() || existingOrg?.organizationName || 'Tech Organization Hub',
          contactEmail: email.trim(),
          description: existingOrg?.description || 'หน่วยงานผู้จัดกิจกรรมและค่ายการเรียนรู้สำหรับนักเรียน',
          verified: true,
          createdAt: existingOrg?.createdAt ? new Date(existingOrg.createdAt) : new Date(),
          updatedAt: new Date(),
        };

        localStorage.setItem(localOrgKey, JSON.stringify(organizerData));
        localStorage.setItem(`sp_org_profile_${uid}`, JSON.stringify(organizerData));

        await setUserSession(
          { uid, email: email.trim(), isAnonymous: !isLiveFirebase },
          organizerData
        );
        navigate('/organizer');
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo One-Click Login with customized targets
  const handleQuickDemo = async (demoType: 'engineer' | 'med' | 'biz' | 'organizer') => {
    setLoading(true);
    try {
      if (demoType === 'organizer') {
        const organizerData: OrganizerProfile = {
          id: 'demo_organizer_01',
          email: 'org@example.com',
          role: 'organizer',
          organizationName: 'Demo Organization Hub',
          contactEmail: 'org@example.com',
          description: 'หน่วยงานผู้จัดค่ายและกิจกรรมสำหรับนักเรียน',
          verified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await setUserSession({ uid: 'demo_organizer_01', email: 'org@demo.local', isAnonymous: true }, organizerData);
        navigate('/organizer');
      } else {
        let profileData: StudentProfile;
        if (demoType === 'med') {
          profileData = {
            ...mockStudent,
            id: 'demo_student_med',
            displayName: 'ภัทรวดี มุ่งมั่นแพทย์',
            email: 'med@student.local',
            school: 'โรงเรียนเตรียมอุดมศึกษา',
            targetUniversity: 'จุฬาลงกรณ์มหาวิทยาลัย',
            targetFaculty: 'คณะแพทยศาสตร์',
            interests: ['Medicine', 'Health', 'Biology', 'Science'],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        } else if (demoType === 'biz') {
          profileData = {
            ...mockStudent,
            id: 'demo_student_biz',
            displayName: 'กิตติคุณ นักบริหารรุ่นใหม่',
            email: 'biz@student.local',
            school: 'โรงเรียนสาธิต มศว ปทุมวัน',
            targetUniversity: 'มหาวิทยาลัยธรรมศาสตร์',
            targetFaculty: 'คณะพาณิชยศาสตร์และการบัญชี (BBA)',
            interests: ['Business', 'Leadership', 'Management', 'Competition'],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        } else {
          profileData = {
            ...mockStudent,
            id: 'demo_student_eng',
            displayName: 'ธนภัทร นักประดิษฐ์ AI',
            email: 'eng@student.local',
            school: 'โรงเรียนกำเนิดวิทย์ (KVIS)',
            targetUniversity: 'จุฬาลงกรณ์มหาวิทยาลัย',
            targetFaculty: 'คณะวิศวกรรมศาสตร์',
            interests: ['Technology', 'Robotics', 'Science', 'Math'],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }

        // Reset local caches for this specific demo student so tests start clean
        localStorage.removeItem(`sp_local_swipes_${profileData.id}`);
        localStorage.removeItem(`sp_local_checklist_${profileData.id}`);

        await setUserSession({ uid: profileData.id, email: profileData.email, isAnonymous: true }, profileData);
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6" style={{ background: 'var(--color-bg)' }}>
      <div 
        className="w-full max-w-md rounded-3xl p-6 sm:p-8 transition-all"
        style={{ 
          background: 'var(--color-surface)', 
          border: '1px solid var(--color-border)', 
          boxShadow: '0 20px 40px rgba(0,0,0,0.06)' 
        }}
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-3 group">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-purple-600 to-indigo-500 opacity-25 dark:opacity-40 blur-md group-hover:opacity-60 transition-opacity" />
            <div 
              className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-lg border border-purple-500/25 dark:border-purple-400/40 p-1 flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
              style={{ background: 'var(--color-surface)' }}
            >
              <img 
                src="/logo.png" 
                alt="Swift Port Logo" 
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            <span style={{ color: 'var(--color-text)' }}>Swift</span>{' '}
            <span className="text-purple-600 dark:text-purple-400">Port</span>
          </h1>
          <p className="text-xs text-center mt-1.5" style={{ color: 'var(--color-muted)' }}>
            แพลตฟอร์มแมตช์ค่ายและสร้างพอร์ตฟอลิโอ TCAS
          </p>
        </div>

        {/* Tab Switcher: Login / Register */}
        <div className="flex rounded-xl p-1 mb-5" style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'login' ? 'shadow-sm text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            style={mode === 'login' ? { background: 'var(--color-brand-600)' } : {}}
          >
            เข้าสู่ระบบ
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'register' ? 'shadow-sm text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            style={mode === 'register' ? { background: 'var(--color-brand-600)' } : {}}
          >
            สมัครสมาชิกใหม่
          </button>
        </div>

        {/* Role Selector */}
        <div className="mb-5">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-muted)' }}>
            เข้าใช้งานในฐานะ:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole('student')}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold transition-all ${role === 'student' ? 'border-purple-600 bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <span>👨‍🎓</span>
              <span>นักเรียน</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('organizer')}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold transition-all ${role === 'organizer' ? 'border-purple-600 bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <span>🏛️</span>
              <span>ผู้จัดค่าย</span>
            </button>
          </div>
        </div>

        {/* Error / Success Alerts */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl text-xs bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-3 rounded-xl text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                {role === 'student' ? 'ชื่อ - นามสกุล' : 'ชื่อผู้ติดต่อ/ประสานงาน'}
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={role === 'student' ? 'เช่น นายสมคิด เรียนดี' : 'เช่น วิภาภรณ์ ชัยพัฒนา'}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>
          )}

          {mode === 'register' && role === 'organizer' && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                ชื่อองค์กร / สถาบันผู้จัดค่าย
              </label>
              <input
                type="text"
                required
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="เช่น ค่ายเยาวชนวิศวกรรม Chula Tech"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>
          )}

          {mode === 'register' && role === 'student' && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                    โรงเรียน
                  </label>
                  <input
                    type="text"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    placeholder="เช่น เตรียมอุดมศึกษา, สวนกุหลาบ"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                    ระดับชั้น
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  >
                    <option value={10}>มัธยมศึกษาปีที่ 4 (ม.4)</option>
                    <option value={11}>มัธยมศึกษาปีที่ 5 (ม.5)</option>
                    <option value={12}>มัธยมศึกษาปีที่ 6 (ม.6)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                    มหาวิทยาลัยเป้าหมาย
                  </label>
                  <input
                    type="text"
                    value={targetUniversity}
                    onChange={(e) => setTargetUniversity(e.target.value)}
                    placeholder="เช่น จุฬาฯ, มธ."
                    className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                    คณะเป้าหมาย
                  </label>
                  <input
                    type="text"
                    value={targetFaculty}
                    onChange={(e) => handleFacultyChange(e.target.value)}
                    placeholder="เช่น วิศวกรรมศาสตร์, แพทยศาสตร์"
                    className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  หรือเลือกเป้าหมายยอดนิยม:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {FACULTY_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className="px-2 py-1 rounded-lg text-xs border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                  ความสนใจ / ด้านที่มุ่งเน้น (เลือกได้หลายข้อ)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_INTERESTS.map(item => {
                    const selected = selectedInterests.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedInterests(prev => 
                            selected ? prev.filter(x => x !== item.id) : [...prev, item.id]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          selected
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-400'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
              อีเมล
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@domain.com"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
            {savedProfile && (
              <p className="mt-1 text-xs text-purple-600 dark:text-purple-400 font-medium">
                ✨ บัญชีนี้มีข้อมูลเดิม: {savedProfile.displayName} ({savedProfile.school})
              </p>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                รหัสผ่าน
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => alert("ระบบรองรับการเข้าสู่ระบบแบบ Demo ทันที หรือสมัครสมาชิกใหม่ด้านบนได้เลยครับ")}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                >
                  ลืมรหัสผ่าน?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                ยืนยันรหัสผ่าน
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-95 active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md mt-2"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)' }}
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : mode === 'login' ? '🔐 เข้าสู่ระบบ' : '✨ สร้างบัญชีและเข้าสู่ระบบ'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
          </div>
          <span className="relative px-3 text-xs bg-[var(--color-surface)] text-slate-400">
            หรือทดลองใช้งานโปรไฟล์ด่วน
          </span>
        </div>

        {/* Quick Demo Section with 3 different faculties */}
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('engineer')}
              disabled={loading}
              className="p-2.5 rounded-xl text-[11px] font-semibold border flex flex-col items-center justify-center gap-1 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-95 disabled:opacity-50 cursor-pointer"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              <span className="text-base">🤖</span>
              <span>วิศวะ จุฬาฯ</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('med')}
              disabled={loading}
              className="p-2.5 rounded-xl text-[11px] font-semibold border flex flex-col items-center justify-center gap-1 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-95 disabled:opacity-50 cursor-pointer"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              <span className="text-base">🩺</span>
              <span>แพทย์ จุฬาฯ</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('biz')}
              disabled={loading}
              className="p-2.5 rounded-xl text-[11px] font-semibold border flex flex-col items-center justify-center gap-1 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-95 disabled:opacity-50 cursor-pointer"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              <span className="text-base">💼</span>
              <span>บริหาร มธ.</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleQuickDemo('organizer')}
            disabled={loading}
            className="w-full py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-95 disabled:opacity-50 cursor-pointer"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            <span>🏛️ Demo ผู้จัดค่าย (Organizer Hub)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
