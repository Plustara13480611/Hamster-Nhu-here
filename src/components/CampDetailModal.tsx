import { useState, useEffect, useCallback } from 'react';
import type { Camp, StudentProfile, CampApplication, ApplicationStatus, ApplicantInfo, PaymentDetails, PaymentMethod } from '../types/models';
import { submitApplication, checkApplicationSync } from '../services/studentService';

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; bg: string; emoji: string }> = {
  applied:    { label: 'สมัครแล้ว — รอผล',      color: '#0284C7', bg: '#E0F2FE', emoji: '📬' },
  reviewed:   { label: 'อยู่ระหว่างพิจารณา',   color: '#D97706', bg: '#FEF3C7', emoji: '🔍' },
  accepted:   { label: 'ได้รับการตอบรับ ✓',     color: '#059669', bg: '#D1FAE5', emoji: '🎉' },
  waitlisted: { label: 'อยู่ใน Waitlist',        color: '#7C3AED', bg: '#F5F3FF', emoji: '⏳' },
  rejected:   { label: 'ไม่ผ่านการคัดเลือก',   color: '#DC2626', bg: '#FEE2E2', emoji: '❌' },
};

// ─── Score Reason Map ────────────────────────────────────────────────────────

function getMatchReasons(camp: Camp, profile: StudentProfile, matchScore?: number): string[] {
  const reasons: string[] = [];
  const interests = (profile.interests || []).map(i => i.toLowerCase());
  const campTags = camp.tags.map(t => t.toLowerCase());

  const tagMatches = campTags.filter(t => interests.includes(t));
  if (tagMatches.length > 0) {
    reasons.push(`ความสนใจตรงกัน: ${tagMatches.map(t => `#${t}`).join(', ')}`);
  }

  if (profile.targetUniversity) {
    const cleanUni = profile.targetUniversity.replace(/มหาวิทยาลัย|ม\./g, '').trim().toLowerCase();
    const loc = (camp.location + ' ' + camp.title).toLowerCase();
    if (cleanUni && loc.includes(cleanUni)) {
      reasons.push(`จัดที่ ${profile.targetUniversity} ตรงกับมหาวิทยาลัยเป้าหมายของคุณ`);
    }
  }

  if (profile.targetFaculty) {
    const facLower = profile.targetFaculty.toLowerCase();
    const isMed = /แพทย์|หมอ|พยาบาล|ทันตะ|เภสัช|สาธารณสุข|biology|health|medicine/i.test(facLower);
    const isEng = /วิศว|คอม|หุ่นยนต์|ai|robot|tech|engineer/i.test(facLower);
    const isBiz = /บริหาร|บัญชี|เศรษฐ|การตลาด|bba|business/i.test(facLower);
    const isArt = /ศิลป|ออก|สถาปัตย์|นิเทศ|ดีไซน์|design|creative/i.test(facLower);
    const isSci = /วิทยาศาสตร์|science|ฟิสิกส์|เคมี/i.test(facLower);

    const matchesFac =
      (isMed && campTags.some(t => ['medicine', 'health', 'biology', 'science'].includes(t))) ||
      (isEng && campTags.some(t => ['technology', 'robotics', 'science', 'math'].includes(t))) ||
      (isBiz && campTags.some(t => ['business', 'management', 'leadership', 'competition'].includes(t))) ||
      (isArt && campTags.some(t => ['design', 'art', 'creative', 'technology'].includes(t))) ||
      (isSci && campTags.some(t => ['science', 'chemistry', 'physics', 'math'].includes(t))) ||
      campTags.some(t => facLower.includes(t));

    if (matchesFac) {
      reasons.push(`เนื้อหาเชื่อมโยงกับ ${profile.targetFaculty} ตรงสายที่ต้องการสะสมผลงาน`);
    }
  }

  if (camp.targetGrades.includes(profile.grade)) {
    reasons.push(`เปิดรับนักเรียนชั้น ม.${profile.grade - 6} ตรงกับระดับชั้นของคุณ`);
  }
  if (camp.cost === 0) {
    reasons.push('ไม่มีค่าใช้จ่าย — เหมาะสำหรับเก็บพอร์ตฟอลิโอ TCAS');
  }
  if (matchScore !== undefined && matchScore >= 70) {
    reasons.push(`คะแนน Match สูง (${matchScore}%) — ระบบแนะนำเป็นพิเศษตามโปรไฟล์ที่คุณตั้งไว้`);
  }

  return reasons.length > 0 ? reasons : ['ค่ายนี้ตรงกับโปรไฟล์ของคุณ'];
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CampDetailModalProps {
  camp: Camp;
  profile: StudentProfile;
  matchScore?: number;
  matchBreakdown?: { tagScore: number; profileScore: number; affinityScore: number };
  onClose: () => void;
  onApplied?: (application: CampApplication) => void;
}

type ModalStep = 'detail' | 'form' | 'payment' | 'receipt';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CampDetailModal({
  camp,
  profile,
  matchScore,
  matchBreakdown,
  onClose,
  onApplied,
}: CampDetailModalProps) {
  const [step, setStep] = useState<ModalStep>('detail');
  const [applying, setApplying] = useState(false);
  const [application, setApplication] = useState<CampApplication | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Registration Form State
  const [fullName, setFullName] = useState(profile.displayName || '');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('081-234-5678');
  const [lineId, setLineId] = useState('');
  const [school, setSchool] = useState(profile.school || '');
  const [grade, setGrade] = useState<number>(profile.grade || 11);
  const [parentName, setParentName] = useState('ผู้ปกครอง ' + (profile.displayName.split(' ')[0] || ''));
  const [parentPhone, setParentPhone] = useState('089-876-5432');
  const [foodAllergies, setFoodAllergies] = useState('ไม่มี (ทานได้ทุกประเภท)');
  const [shirtSize, setShirtSize] = useState<'S' | 'M' | 'L' | 'XL' | '2XL'>('L');
  const [motivation, setMotivation] = useState(`ต้องการเรียนรู้ทักษะด้าน ${camp.tags[0] || 'วิชาการ'} และสะสมผลงานยื่น TCAS ${profile.targetFaculty}`);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(camp.cost === 0 ? 'free' : 'promptpay');
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [slipVerified, setSlipVerified] = useState(false);
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');
  const [cardHolder, setCardHolder] = useState(profile.displayName || 'STUDENT NAME');
  const [trueMoneyPhone, setTrueMoneyPhone] = useState('081-234-5678');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(899); // 14:59 for QR payment

  const orderRefNumber = `SP-${Date.now().toString().slice(-6)}`;

  // Check if already applied
  useEffect(() => {
    const existing = checkApplicationSync(profile.id, camp.id);
    if (existing) {
      setApplication(existing);
      if (existing.applicantInfo) {
        setFullName(existing.applicantInfo.fullName || profile.displayName);
        setNickname(existing.applicantInfo.nickname || '');
        setPhone(existing.applicantInfo.phone || '081-234-5678');
        setSchool(existing.applicantInfo.school || profile.school);
      }
    }
  }, [profile.id, camp.id, profile.displayName, profile.school]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Timer countdown for PromptPay
  useEffect(() => {
    if (step === 'payment' && paymentMethod === 'promptpay' && countdown > 0) {
      const timer = setInterval(() => setCountdown(c => c - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [step, paymentMethod, countdown]);

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'กรุณาระบุชื่อ-นามสกุล';
    if (!nickname.trim()) errs.nickname = 'กรุณาระบุชื่อเล่น';
    if (!phone.trim()) errs.phone = 'กรุณาระบุเบอร์โทรศัพท์';
    if (!lineId.trim()) errs.lineId = 'กรุณาระบุ Line ID เพื่อเข้ากลุ่มกิจกรรม';
    if (!school.trim()) errs.school = 'กรุณาระบุชื่อโรงเรียน';
    if (!parentName.trim()) errs.parentName = 'กรุณาระบุชื่อผู้ปกครอง';
    if (!parentPhone.trim()) errs.parentPhone = 'กรุณาระบุเบอร์โทรติดต่อฉุกเฉิน';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleProceedToPayment = () => {
    if (validateForm()) {
      setStep('payment');
    }
  };

  // Upload or simulate payment slip
  const handleSlipUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSlipPreview(event.target?.result as string);
        setSlipVerified(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSimulateSlip = () => {
    // Generate simulated digital bank slip
    setSlipPreview('simulated-slip');
    setSlipVerified(true);
  };

  // Complete checkout & apply
  const handleFinalSubmit = useCallback(async () => {
    if (applying) return;
    setApplying(true);

    try {
      const now = new Date();
      const applicantData: ApplicantInfo = {
        fullName: fullName.trim(),
        nickname: nickname.trim(),
        phone: phone.trim(),
        lineId: lineId.trim(),
        school: school.trim(),
        grade,
        parentName: parentName.trim(),
        parentPhone: parentPhone.trim(),
        foodAllergies: foodAllergies.trim(),
        shirtSize,
        motivation: motivation.trim(),
      };

      const paymentData: PaymentDetails = {
        method: camp.cost === 0 ? 'free' : paymentMethod,
        amount: camp.cost,
        status: camp.cost === 0 ? 'free' : 'paid',
        orderId: `SP-ORD-${Date.now().toString().slice(-6)}`,
        refNumber: orderRefNumber,
        paidAt: now,
        slipUrl: slipPreview || undefined,
      };

      const result = await submitApplication({
        studentId: profile.id,
        campId: camp.id,
        campTitle: camp.title,
        campCoverImageUrl: camp.coverImageUrl,
        status: 'applied',
        appliedAt: now,
        updatedAt: now,
        applicantInfo: applicantData,
        payment: paymentData,
      });

      setApplication(result);
      setShowSuccess(true);
      setStep('receipt');
      onApplied?.(result);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err) {
      console.error('Failed to submit application:', err);
    } finally {
      setApplying(false);
    }
  }, [applying, camp, profile.id, fullName, nickname, phone, lineId, school, grade, parentName, parentPhone, foodAllergies, shirtSize, motivation, paymentMethod, orderRefNumber, slipPreview, onApplied]);

  const toDate = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
    if (typeof val.toDate === 'function') return val.toDate();
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const fmt = (d: any, opts?: Intl.DateTimeFormatOptions) => {
    try {
      return toDate(d).toLocaleDateString('th-TH', opts ?? { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return String(d || '');
    }
  };

  const matchReasons = getMatchReasons(camp, profile, matchScore);
  const deadlineDate = toDate(camp.applicationDeadline);
  const deadlinePassed = deadlineDate.getTime() < Date.now();
  const daysLeft = Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000));
  const statusConfig = application ? STATUS_CONFIG[application.status] : null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`รายละเอียด ${camp.title}`}
    >
      {/* Success Toast */}
      {showSuccess && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 px-6 py-3.5 rounded-2xl text-white font-extrabold text-sm shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #059669, #047857)', animation: 'slideUp 0.3s ease-out' }}
        >
          <CheckCircleIcon />
          <span>🎉 ชำระเงิน & สมัครเข้าร่วม &ldquo;{camp.title}&rdquo; สำเร็จเรียบร้อย!</span>
        </div>
      )}

      {/* Modal Container */}
      <div
        className="relative w-full sm:max-w-2xl max-h-[96vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl transition-all"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {/* Step Indicator Header (If in checkout flow) */}
        {step !== 'detail' && (
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)', background: 'var(--color-elevated)' }}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (step === 'payment') setStep('form');
                  else if (step === 'form') setStep('detail');
                  else setStep('detail');
                }}
                className="text-xs font-bold px-2 py-1 rounded-lg border border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-950/50 transition-all cursor-pointer"
              >
                ← ย้อนกลับ
              </button>
              <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>
                {step === 'form' && 'ขั้นตอนที่ 1: กรอกข้อมูลผู้สมัคร'}
                {step === 'payment' && 'ขั้นตอนที่ 2: สรุปยอดและชำระเงิน'}
                {step === 'receipt' && 'ขั้นตอนที่ 3: ยืนยันการสมัคร & E-Ticket'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 'form' ? 'bg-purple-600 text-white' : 'bg-purple-200 dark:bg-purple-900 text-purple-700 dark:text-purple-300'}`}>1</span>
              <span style={{ color: 'var(--color-border)' }}>—</span>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 'payment' ? 'bg-purple-600 text-white' : 'bg-purple-200 dark:bg-purple-900 text-purple-700 dark:text-purple-300'}`}>2</span>
              <span style={{ color: 'var(--color-border)' }}>—</span>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 'receipt' ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>3</span>
            </div>
          </div>
        )}

        {/* ─── VIEW 1: CAMP DETAILS ─── */}
        {step === 'detail' && (
          <>
            {/* Hero Image */}
            <div className="relative w-full flex-shrink-0" style={{ aspectRatio: '16/7' }}>
              <img
                src={camp.coverImageUrl}
                alt={camp.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="gradient-card-overlay absolute inset-0" />

              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-white cursor-pointer transition-all hover:scale-110"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
                aria-label="ปิด"
              >
                <CloseIcon />
              </button>

              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {camp.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                      style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.25)' }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {matchScore !== undefined && (
                  <span
                    className="text-sm font-black px-3 py-1.5 rounded-full text-white flex-shrink-0"
                    style={{ background: 'rgba(91,33,182,0.9)', backdropFilter: 'blur(4px)' }}
                  >
                    ⚡ {matchScore}% match
                  </span>
                )}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5" style={{ scrollbarWidth: 'thin' }}>
              <div>
                <h2 className="text-2xl font-black leading-tight mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {camp.title}
                </h2>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="font-semibold" style={{ color: camp.isOnline ? 'var(--color-sky-600)' : 'var(--color-muted)' }}>
                    {camp.isOnline ? '🌐 Online' : '📍 Onsite'}
                  </span>
                  <span style={{ color: 'var(--color-border)' }}>•</span>
                  <span className="font-bold text-base" style={{ color: camp.cost === 0 ? '#059669' : '#7C3AED' }}>
                    {camp.cost === 0 ? '🎓 ฟรีไม่มีค่าใช้จ่าย' : `฿${camp.cost.toLocaleString()}`}
                  </span>
                  {camp.cost > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                      ⚡ สิทธิ์ส่วนลด TCAS Port
                    </span>
                  )}
                </div>
              </div>

              {/* Key Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: <CalendarIcon />, label: 'วันที่จัด', value: `${fmt(camp.startDate, { day: 'numeric', month: 'short' })} – ${fmt(camp.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}` },
                  { icon: <MapPinIcon />, label: 'สถานที่', value: camp.location },
                  { icon: <UsersIcon />, label: 'รับสมัคร', value: camp.capacity ? `${camp.capacity} คน` : 'ไม่จำกัด' },
                  {
                    icon: <AlertTriangleIcon />,
                    label: 'ปิดรับสมัคร',
                    value: deadlinePassed ? 'หมดเขตแล้ว' : `${fmt(camp.applicationDeadline)} (${daysLeft > 0 ? `เหลือ ${daysLeft} วัน` : 'วันนี้!'})`,
                    accent: deadlinePassed ? '#DC2626' : daysLeft <= 7 ? '#D97706' : undefined,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start gap-2.5 p-3 rounded-2xl"
                    style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
                  >
                    <span className="mt-0.5 flex-shrink-0" style={{ color: item.accent ?? 'var(--color-muted)' }}>{item.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--color-muted)' }}>{item.label}</p>
                      <p className="text-sm font-bold leading-tight" style={{ color: item.accent ?? 'var(--color-text)' }}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div className="rounded-2xl p-4" style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--color-muted)' }}>📋 เกี่ยวกับค่ายนี้</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
                  {camp.description}
                </p>
              </div>

              {/* AI Match Analysis */}
              {matchScore !== undefined && (
                <div
                  className="rounded-2xl p-4 border"
                  style={{ background: 'var(--color-brand-50,#F5F3FF)', borderColor: 'var(--color-brand-200,#DDD6FE)' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-purple-700 dark:text-purple-300">⚡ AI Match Analysis</h3>
                    <span className="text-lg font-black text-purple-700 dark:text-purple-300">{matchScore}%</span>
                  </div>

                  {matchBreakdown && (
                    <div className="space-y-2 mb-3">
                      {[
                        { label: 'ความสนใจตรงกัน (Tag)', value: matchBreakdown.tagScore, max: 50, color: '#7C3AED' },
                        { label: 'ตรงเป้าหมายคณะ/ม.', value: matchBreakdown.profileScore, max: 20, color: '#0EA5E9' },
                        { label: 'พฤติกรรมการปัด', value: matchBreakdown.affinityScore, max: 30, color: '#FBBF24' },
                      ].map(b => (
                        <div key={b.label}>
                          <div className="flex justify-between text-[11px] mb-0.5">
                            <span className="font-semibold text-purple-800 dark:text-purple-200">{b.label}</span>
                            <span className="font-bold text-purple-700 dark:text-purple-300">{b.value}/{b.max}</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-purple-200 dark:bg-purple-900">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${(b.value / b.max) * 100}%`, background: b.color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-purple-700 dark:text-purple-300 mb-1">เหตุผลที่ระบบแนะนำ:</p>
                    {matchReasons.map((reason, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-purple-800 dark:text-purple-200">
                        <span className="text-purple-500 mt-0.5 flex-shrink-0">✓</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grades Accepted */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold" style={{ color: 'var(--color-muted)' }}>รับนักเรียนชั้น:</span>
                {camp.targetGrades.map(g => (
                  <span
                    key={g}
                    className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                    style={{
                      background: camp.targetGrades.includes(profile.grade) ? '#D1FAE5' : 'var(--color-elevated)',
                      color: camp.targetGrades.includes(profile.grade) ? '#059669' : 'var(--color-muted)',
                      border: `1px solid ${camp.targetGrades.includes(profile.grade) ? '#6EE7B7' : 'var(--color-border)'}`,
                    }}
                  >
                    ม.{g - 6}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div
              className="flex-shrink-0 px-5 py-4 border-t flex items-center gap-3"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              {application ? (
                <div className="flex-1 flex items-center justify-between gap-3">
                  <div
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl flex-1"
                    style={{ background: statusConfig?.bg, border: `1px solid ${statusConfig?.color}30` }}
                  >
                    <span className="text-xl">{statusConfig?.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate" style={{ color: statusConfig?.color }}>{statusConfig?.label}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                        {application.payment?.status === 'paid' ? `ชำระแล้ว ฿${application.payment.amount.toLocaleString()}` : 'ลงทะเบียนเรียบร้อย'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setStep('receipt')}
                    className="px-4 py-3 rounded-2xl text-xs font-extrabold text-white gradient-brand shadow-md hover:brightness-105 cursor-pointer whitespace-nowrap"
                  >
                    📄 ดูใบเสร็จ & E-Ticket
                  </button>
                </div>
              ) : deadlinePassed ? (
                <div
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-sm font-bold"
                  style={{ background: 'var(--color-elevated)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
                >
                  <AlertTriangleIcon />
                  หมดเขตรับสมัครแล้ว
                </div>
              ) : (
                <button
                  id={`apply-btn-${camp.id}`}
                  onClick={() => setStep('form')}
                  className="flex-1 py-3.5 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer shadow-lg hover:brightness-110"
                  style={{
                    background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 50%, #4C1D95 100%)',
                  }}
                >
                  <span>📝 กรอกใบสมัคร & {camp.cost === 0 ? 'ยืนยันฟรี' : `ชำระเงิน (฿${camp.cost.toLocaleString()})`}</span>
                  <span>→</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="px-4 py-3.5 rounded-2xl text-sm font-bold cursor-pointer transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
              >
                ปิด
              </button>
            </div>
          </>
        )}

        {/* ─── VIEW 2: REGISTRATION FORM ─── */}
        {step === 'form' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ scrollbarWidth: 'thin' }}>
              <div className="border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="text-xl font-black" style={{ fontFamily: 'Syne, sans-serif' }}>
                  📋 ข้อมูลการสมัครเข้าร่วมกิจกรรม
                </h3>
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  กรุณาตรวจสอบและกรอกข้อมูลให้ถูกต้อง เพื่อใช้สำหรับออกใบประกาศนียบัตรและประสานงานกิจกรรม
                </p>
              </div>

              {/* Personal Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  1. ข้อมูลผู้สมัคร
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                      ชื่อ - นามสกุล (สำหรับใบประกาศนียบัตร) *
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="เช่น นายกิตติศักดิ์ พัฒนาการ"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500"
                      style={{ background: 'var(--color-elevated)', borderColor: formErrors.fullName ? '#EF4444' : 'var(--color-border)' }}
                    />
                    {formErrors.fullName && <p className="text-[11px] text-red-500 mt-0.5">{formErrors.fullName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                      ชื่อเล่น *
                    </label>
                    <input
                      type="text"
                      value={nickname}
                      onChange={e => setNickname(e.target.value)}
                      placeholder="เช่น กอล์ฟ"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500"
                      style={{ background: 'var(--color-elevated)', borderColor: formErrors.nickname ? '#EF4444' : 'var(--color-border)' }}
                    />
                    {formErrors.nickname && <p className="text-[11px] text-red-500 mt-0.5">{formErrors.nickname}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                      เบอร์โทรศัพท์มือถือ *
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="08X-XXX-XXXX"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500"
                      style={{ background: 'var(--color-elevated)', borderColor: formErrors.phone ? '#EF4444' : 'var(--color-border)' }}
                    />
                    {formErrors.phone && <p className="text-[11px] text-red-500 mt-0.5">{formErrors.phone}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                      Line ID (สำหรับเข้ากลุ่มกิจกรรม) *
                    </label>
                    <input
                      type="text"
                      value={lineId}
                      onChange={e => setLineId(e.target.value)}
                      placeholder="เช่น golf_student"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500"
                      style={{ background: 'var(--color-elevated)', borderColor: formErrors.lineId ? '#EF4444' : 'var(--color-border)' }}
                    />
                    {formErrors.lineId && <p className="text-[11px] text-red-500 mt-0.5">{formErrors.lineId}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                      โรงเรียน *
                    </label>
                    <input
                      type="text"
                      value={school}
                      onChange={e => setSchool(e.target.value)}
                      placeholder="เช่น โรงเรียนเตรียมอุดมศึกษา"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500"
                      style={{ background: 'var(--color-elevated)', borderColor: formErrors.school ? '#EF4444' : 'var(--color-border)' }}
                    />
                    {formErrors.school && <p className="text-[11px] text-red-500 mt-0.5">{formErrors.school}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                      ระดับชั้น
                    </label>
                    <select
                      value={grade}
                      onChange={e => setGrade(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500"
                      style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                    >
                      <option value={10}>มัธยมศึกษาปีที่ 4</option>
                      <option value={11}>มัธยมศึกษาปีที่ 5</option>
                      <option value={12}>มัธยมศึกษาปีที่ 6</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  2. ข้อมูลผู้ปกครอง / ติดต่อฉุกเฉิน
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                      ชื่อผู้ปกครอง *
                    </label>
                    <input
                      type="text"
                      value={parentName}
                      onChange={e => setParentName(e.target.value)}
                      placeholder="เช่น นางสมศรี พัฒนาการ"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500"
                      style={{ background: 'var(--color-elevated)', borderColor: formErrors.parentName ? '#EF4444' : 'var(--color-border)' }}
                    />
                    {formErrors.parentName && <p className="text-[11px] text-red-500 mt-0.5">{formErrors.parentName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                      เบอร์โทรผู้ปกครอง *
                    </label>
                    <input
                      type="tel"
                      value={parentPhone}
                      onChange={e => setParentPhone(e.target.value)}
                      placeholder="08X-XXX-XXXX"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500"
                      style={{ background: 'var(--color-elevated)', borderColor: formErrors.parentPhone ? '#EF4444' : 'var(--color-border)' }}
                    />
                    {formErrors.parentPhone && <p className="text-[11px] text-red-500 mt-0.5">{formErrors.parentPhone}</p>}
                  </div>
                </div>
              </div>

              {/* Additional Camp Customization */}
              <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  3. ความต้องการเพิ่มเติมสำหรับค่าย
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                      อาหารที่แพ้ / ข้อจำกัดด้านสุขภาพ
                    </label>
                    <input
                      type="text"
                      value={foodAllergies}
                      onChange={e => setFoodAllergies(e.target.value)}
                      placeholder="เช่น แพ้อาหารทะเล, อิสลาม (ฮาลาล), หรือไม่มี"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500"
                      style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                      ขนาดเสื้อค่าย
                    </label>
                    <select
                      value={shirtSize}
                      onChange={e => setShirtSize(e.target.value as any)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500"
                      style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                    >
                      <option value="S">S (รอบอก 36")</option>
                      <option value="M">M (รอบอก 38")</option>
                      <option value="L">L (รอบอก 40")</option>
                      <option value="XL">XL (รอบอก 42")</option>
                      <option value="2XL">2XL (รอบอก 44")</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                    เป้าหมายที่อยากได้รับจากค่ายนี้ (สั้นๆ)
                  </label>
                  <textarea
                    rows={2}
                    value={motivation}
                    onChange={e => setMotivation(e.target.value)}
                    placeholder="เล่าถึงเป้าหมายหรือความคาดหวัง..."
                    className="w-full px-3.5 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div
              className="flex-shrink-0 px-5 py-4 border-t flex items-center justify-between gap-3"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <button
                type="button"
                onClick={() => setStep('detail')}
                className="px-4 py-3 rounded-2xl text-xs font-bold border transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
              >
                ← รายละเอียด
              </button>

              <button
                type="button"
                onClick={handleProceedToPayment}
                className="flex-1 py-3.5 rounded-2xl text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg gradient-brand hover:brightness-110 cursor-pointer"
              >
                <span>ดำเนินการต่อไปยังหน้าชำระเงิน</span>
                <span>(฿{camp.cost.toLocaleString()})</span>
                <span>→</span>
              </button>
            </div>
          </>
        )}

        {/* ─── VIEW 3: PAYMENT & CLOSING THE SALE (จบการขาย) ─── */}
        {step === 'payment' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5" style={{ scrollbarWidth: 'thin' }}>
              {/* Order Summary Box */}
              <div
                className="rounded-2xl p-4 border"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-purple-600 dark:text-purple-400">
                      สรุปคำสั่งซื้อกิจกรรม (Order Checkout)
                    </span>
                    <h4 className="text-base font-black truncate leading-tight mt-0.5">{camp.title}</h4>
                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>ผู้สมัคร: {fullName} • ม.{grade - 6}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>เลขอ้างอิง Ref</p>
                    <p className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">{orderRefNumber}</p>
                  </div>
                </div>

                <div className="pt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-muted)' }}>ค่าลงทะเบียนกิจกรรม:</span>
                    <span>฿{camp.cost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>ส่วนลด TCAS Early-Bird:</span>
                    <span>- ฿0 (รวมสิทธิพิเศษแล้ว)</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t font-black text-sm" style={{ borderColor: 'var(--color-border)' }}>
                    <span>ยอดชำระสุทธิ (Net Total):</span>
                    <span className="text-lg text-purple-600 dark:text-purple-400 font-mono">
                      {camp.cost === 0 ? 'ฟรี 0 บาท' : `฿${camp.cost.toLocaleString()}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Free Camp Mode */}
              {camp.cost === 0 ? (
                <div
                  className="rounded-2xl p-5 border text-center space-y-3"
                  style={{ background: '#ECFDF5', borderColor: '#A7F3D0' }}
                >
                  <span className="text-4xl block">🎓</span>
                  <h4 className="text-lg font-black text-emerald-800">กิจกรรมนี้เข้าร่วมฟรี 100%!</h4>
                  <p className="text-xs text-emerald-700 max-w-md mx-auto">
                    กิจกรรมนี้ได้รับการสนับสนุนทุนการศึกษาจากผู้จัด คุณสามารถกดยืนยันเพื่อรับ E-Ticket และสิทธิ์เข้าร่วมได้ทันที
                  </p>
                </div>
              ) : (
                /* Paid Camp Mode — Selection of Payment Gateways */
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    เลือกวิธีชำระเงิน
                  </h4>

                  {/* Payment Method Tabs */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('promptpay')}
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                        paymentMethod === 'promptpay'
                          ? 'border-purple-600 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-extrabold shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <span className="text-xl block mb-1">📱</span>
                      <span className="text-xs">PromptPay QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('credit_card')}
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                        paymentMethod === 'credit_card'
                          ? 'border-purple-600 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-extrabold shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <span className="text-xl block mb-1">💳</span>
                      <span className="text-xs">บัตรเครดิต/เดบิต</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('truemoney')}
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                        paymentMethod === 'truemoney'
                          ? 'border-purple-600 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-extrabold shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <span className="text-xl block mb-1">👛</span>
                      <span className="text-xs">TrueMoney</span>
                    </button>
                  </div>

                  {/* ── Option 1: PromptPay QR ── */}
                  {paymentMethod === 'promptpay' && (
                    <div
                      className="rounded-3xl p-5 border flex flex-col items-center shadow-sm"
                      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                    >
                      {/* PromptPay Official Header Banner */}
                      <div className="w-full max-w-xs bg-[#1A365D] text-white py-2 px-4 rounded-t-2xl flex items-center justify-between text-xs font-bold shadow-md">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🇹🇭</span>
                          <span>PromptPay • พร้อมเพย์</span>
                        </div>
                        <span className="text-[10px] bg-sky-500/30 text-sky-200 px-2 py-0.5 rounded-full font-mono">
                          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                        </span>
                      </div>

                      {/* QR Display Card */}
                      <div className="w-full max-w-xs bg-white p-5 rounded-b-2xl border-x border-b border-slate-200 shadow-md flex flex-col items-center text-slate-800">
                        {/* High-Resolution SVG Simulated QR */}
                        <div className="w-48 h-48 bg-white p-2 rounded-xl border border-slate-200 flex flex-col items-center justify-center relative">
                          <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
                            {/* Finder pattern top-left */}
                            <rect x="5" y="5" width="26" height="26" rx="4" fill="#0F172A" />
                            <rect x="9" y="9" width="18" height="18" rx="2" fill="white" />
                            <rect x="13" y="13" width="10" height="10" rx="1" fill="#0F172A" />
                            {/* Finder pattern top-right */}
                            <rect x="69" y="5" width="26" height="26" rx="4" fill="#0F172A" />
                            <rect x="73" y="9" width="18" height="18" rx="2" fill="white" />
                            <rect x="77" y="13" width="10" height="10" rx="1" fill="#0F172A" />
                            {/* Finder pattern bottom-left */}
                            <rect x="5" y="69" width="26" height="26" rx="4" fill="#0F172A" />
                            <rect x="9" y="73" width="18" height="18" rx="2" fill="white" />
                            <rect x="13" y="77" width="10" height="10" rx="1" fill="#0F172A" />
                            {/* Matrix dots */}
                            <rect x="36" y="8" width="8" height="8" fill="#0F172A" />
                            <rect x="48" y="12" width="6" height="6" fill="#0F172A" />
                            <rect x="58" y="8" width="6" height="6" fill="#0F172A" />
                            <rect x="36" y="24" width="6" height="6" fill="#0F172A" />
                            <rect x="46" y="24" width="10" height="6" fill="#0F172A" />
                            <rect x="10" y="38" width="6" height="6" fill="#0F172A" />
                            <rect x="22" y="42" width="6" height="6" fill="#0F172A" />
                            <rect x="34" y="36" width="14" height="14" fill="#1A365D" rx="2" />
                            {/* Center Logo Icon */}
                            <circle cx="50" cy="50" r="9" fill="#7C3AED" />
                            <path d="M47 50L53 50M50 47L50 53" stroke="white" strokeWidth="2" strokeLinecap="round" />
                            <rect x="64" y="38" width="8" height="6" fill="#0F172A" />
                            <rect x="78" y="42" width="12" height="6" fill="#0F172A" />
                            <rect x="36" y="56" width="6" height="8" fill="#0F172A" />
                            <rect x="48" y="64" width="8" height="6" fill="#0F172A" />
                            <rect x="60" y="56" width="6" height="8" fill="#0F172A" />
                            <rect x="36" y="74" width="10" height="6" fill="#0F172A" />
                            <rect x="52" y="74" width="6" height="10" fill="#0F172A" />
                            <rect x="64" y="70" width="8" height="8" fill="#0F172A" />
                            <rect x="78" y="76" width="12" height="6" fill="#0F172A" />
                          </svg>
                        </div>

                        <div className="text-center mt-3">
                          <p className="text-xs text-slate-500">บัญชีรับชำระ: สวิฟต์พอร์ต ฮับ กิจกรรม</p>
                          <p className="text-xl font-black text-slate-900 font-mono mt-0.5">
                            ฿{camp.cost.toLocaleString()}.00
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">สแกนได้ด้วย Mobile Banking ทุกธนาคาร</p>
                        </div>
                      </div>

                      {/* Slip Verification Box */}
                      <div className="w-full mt-4 p-4 rounded-2xl border" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>
                            📎 แนบหลักฐานการโอนเงิน (สลิป):
                          </label>
                          <button
                            type="button"
                            onClick={handleSimulateSlip}
                            className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline cursor-pointer"
                          >
                            ⚡ ทดสอบจำลองสลิป
                          </button>
                        </div>

                        {slipVerified ? (
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span>✅</span>
                              <div>
                                <p className="font-bold">ตรวจสอบสลิปการโอนสำเร็จ</p>
                                <p className="text-[10px] opacity-80">ยอดเงินตรงตามยอดชำระ ฿{camp.cost.toLocaleString()}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setSlipPreview(null); setSlipVerified(false); }}
                              className="text-[10px] text-red-500 underline cursor-pointer"
                            >
                              เปลี่ยนสลิป
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center p-4 border border-dashed rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            style={{ borderColor: 'var(--color-border)' }}>
                            <span className="text-2xl mb-1">📸</span>
                            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">คลิกเพื่ออัปโหลดรูปภาพสลิป</span>
                            <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>รองรับ JPG, PNG หรือภาพหน้าจอ</span>
                            <input type="file" accept="image/*" onChange={handleSlipUpload} className="hidden" />
                          </label>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Option 2: Credit / Debit Card ── */}
                  {paymentMethod === 'credit_card' && (
                    <div
                      className="rounded-3xl p-5 border space-y-3"
                      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                    >
                      <div className="p-4 rounded-2xl text-white shadow-lg relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)' }}>
                        <div className="flex justify-between items-center mb-6">
                          <span className="text-xs font-mono font-bold tracking-widest text-indigo-200">SWIFT PORT SECURE</span>
                          <span className="text-lg">💳 VISA</span>
                        </div>
                        <p className="text-lg font-mono font-bold tracking-wider mb-3">{cardNumber}</p>
                        <div className="flex justify-between text-xs font-mono text-indigo-200">
                          <div>
                            <p className="text-[9px] uppercase opacity-75">Card Holder</p>
                            <p className="font-bold text-white uppercase">{cardHolder}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase opacity-75">Expires</p>
                            <p className="font-bold text-white">{cardExpiry}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2.5 pt-2">
                        <div>
                          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>หมายเลขบัตร 16 หลัก</label>
                          <input
                            type="text"
                            value={cardNumber}
                            onChange={e => setCardNumber(e.target.value)}
                            placeholder="4242 4242 4242 4242"
                            className="w-full px-3.5 py-2 rounded-xl text-sm border font-mono"
                            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>วันหมดอายุ (MM/YY)</label>
                            <input
                              type="text"
                              value={cardExpiry}
                              onChange={e => setCardExpiry(e.target.value)}
                              placeholder="MM/YY"
                              className="w-full px-3.5 py-2 rounded-xl text-sm border font-mono"
                              style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>รหัส CVV (3 ตัวหลังบัตร)</label>
                            <input
                              type="password"
                              maxLength={4}
                              value={cardCvv}
                              onChange={e => setCardCvv(e.target.value)}
                              placeholder="•••"
                              className="w-full px-3.5 py-2 rounded-xl text-sm border font-mono"
                              style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>ชื่อบนบัตร</label>
                          <input
                            type="text"
                            value={cardHolder}
                            onChange={e => setCardHolder(e.target.value)}
                            placeholder="NAME SURNAME"
                            className="w-full px-3.5 py-2 rounded-xl text-sm border uppercase"
                            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Option 3: TrueMoney Wallet ── */}
                  {paymentMethod === 'truemoney' && (
                    <div
                      className="rounded-3xl p-5 border space-y-3.5"
                      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                        <span className="text-3xl">👛</span>
                        <div>
                          <p className="text-sm font-bold text-orange-600 dark:text-orange-400">ชำระผ่าน TrueMoney Wallet</p>
                          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>หักเงินจากยอดคงเหลือในวอลเล็ททันที</p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                          เบอร์โทรศัพท์ที่ผูกกับ TrueMoney
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="tel"
                            value={trueMoneyPhone}
                            onChange={e => setTrueMoneyPhone(e.target.value)}
                            placeholder="08X-XXX-XXXX"
                            className="flex-1 px-3.5 py-2.5 rounded-xl text-sm border"
                            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                          />
                          <button
                            type="button"
                            onClick={() => { setOtpSent(true); setOtpCode('892415'); }}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            {otpSent ? 'ส่ง OTP อีกครั้ง' : 'ขอรหัส OTP'}
                          </button>
                        </div>
                      </div>

                      {otpSent && (
                        <div>
                          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                            รหัส OTP ยืนยันชำระเงิน (รหัสจำลอง: 892415)
                          </label>
                          <input
                            type="text"
                            maxLength={6}
                            value={otpCode}
                            onChange={e => setOtpCode(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl text-sm border font-mono tracking-widest text-center font-bold"
                            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Security Badge */}
                  <div className="flex items-center justify-center gap-2 text-xs py-1 text-slate-500">
                    <span>🔒</span>
                    <span>ระบบชำระเงินปลอดภัยด้วย 256-bit SSL Encryption พร้อมรับประกันสิทธิ์ที่นั่ง</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div
              className="flex-shrink-0 px-5 py-4 border-t flex items-center justify-between gap-3"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <button
                type="button"
                onClick={() => setStep('form')}
                className="px-4 py-3 rounded-2xl text-xs font-bold border transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
              >
                ← แก้ไขข้อมูล
              </button>

              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={applying || (paymentMethod === 'promptpay' && camp.cost > 0 && !slipVerified)}
                className="flex-1 py-3.5 rounded-2xl text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl gradient-brand hover:brightness-110 active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {applying ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    <span>กำลังบันทึกและจบการสมัคร...</span>
                  </>
                ) : (
                  <>
                    <span>🔒 {camp.cost === 0 ? 'ยืนยันการสมัครฟรีทันที' : `ยืนยันชำระเงิน ฿${camp.cost.toLocaleString()} & จบการขาย`}</span>
                    <span>✓</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* ─── VIEW 4: DIGITAL RECEIPT & E-TICKET (ใบเสร็จ & บัตรเข้าร่วม) ─── */}
        {step === 'receipt' && (
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5" style={{ scrollbarWidth: 'thin' }}>
            <div className="text-center space-y-1">
              <span className="text-4xl block animate-bounce">🎉</span>
              <h3 className="text-2xl font-black" style={{ fontFamily: 'Syne, sans-serif' }}>
                การสมัครและการชำระเงินเสร็จสมบูรณ์!
              </h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                ✓ บันทึกข้อมูลและออกบัตร E-Ticket ให้เรียบร้อยแล้ว
              </p>
            </div>

            {/* E-Ticket Card */}
            <div
              className="rounded-3xl border overflow-hidden shadow-xl"
              style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
            >
              {/* Ticket Header */}
              <div
                className="p-5 text-white flex justify-between items-start"
                style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)' }}
              >
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                    SWIFT PORT E-TICKET
                  </span>
                  <h4 className="text-lg font-black mt-1 leading-snug">{camp.title}</h4>
                  <p className="text-xs text-purple-200 mt-0.5">📍 {camp.location}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-400 text-slate-900">
                    {camp.cost === 0 ? 'FREE CONFIRMED' : 'PAID ✓'}
                  </span>
                  <p className="text-[10px] text-purple-200 mt-1 font-mono">{orderRefNumber}</p>
                </div>
              </div>

              {/* Ticket Details Body */}
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block">ชื่อผู้สมัคร</span>
                    <strong className="text-sm font-bold">{fullName} (น้อง{nickname || 'นักเรียน'})</strong>
                    <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{school} • ม.{grade - 6}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block">วันที่จัดกิจกรรม</span>
                    <strong className="text-sm font-bold">{fmt(camp.startDate, { day: 'numeric', month: 'short' })} – {fmt(camp.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                    <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>เวลา 09:00 – 16:30 น.</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t text-xs" style={{ borderColor: 'var(--color-border)' }}>
                  <div>
                    <span className="text-[10px] text-slate-400 block">เบอร์ติดต่อ</span>
                    <strong className="font-mono">{phone}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">ไซส์เสื้อค่าย</span>
                    <strong>ไซส์ {shirtSize}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">ยอดชำระ</span>
                    <strong className="text-purple-600 dark:text-purple-400 font-mono">
                      {camp.cost === 0 ? 'ฟรี' : `฿${camp.cost.toLocaleString()}`}
                    </strong>
                  </div>
                </div>

                {/* QR Code for Check-in */}
                <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                  <div>
                    <p className="text-xs font-bold">QR Code สำหรับเช็คอินหน้างาน</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>แสดง QR นี้แก่เจ้าหน้าที่เมื่อมาถึงสถานที่จัดค่าย</p>
                  </div>
                  <div className="w-16 h-16 bg-white p-1 rounded-xl border flex items-center justify-center flex-shrink-0">
                    <svg className="w-full h-full" viewBox="0 0 40 40" fill="#0F172A">
                      <rect x="2" y="2" width="12" height="12" rx="2" />
                      <rect x="4" y="4" width="8" height="8" fill="white" />
                      <rect x="6" y="6" width="4" height="4" fill="#0F172A" />
                      <rect x="26" y="2" width="12" height="12" rx="2" />
                      <rect x="28" y="4" width="8" height="8" fill="white" />
                      <rect x="30" y="6" width="4" height="4" fill="#0F172A" />
                      <rect x="2" y="26" width="12" height="12" rx="2" />
                      <rect x="4" y="28" width="8" height="8" fill="white" />
                      <rect x="6" y="30" width="4" height="4" fill="#0F172A" />
                      <rect x="18" y="18" width="8" height="8" fill="#7C3AED" rx="2" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => alert(`บันทึกใบเสร็จและบัตร E-Ticket [${orderRefNumber}] สำเร็จ! สามารถนำมาแสดงหน้างานได้เลยครับ`)}
                  className="py-3 px-3 rounded-2xl text-xs font-extrabold border border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>📥 ดาวน์โหลด E-Ticket</span>
                </button>

                <button
                  type="button"
                  onClick={() => alert("ระบบกำลังนำคุณเข้าสู่กลุ่ม Line OpenChat ของค่ายนี้เพื่อเตรียมตัวร่วมกิจกรรม!")}
                  className="py-3 px-3 rounded-2xl text-xs font-extrabold bg-[#06C755] text-white hover:brightness-105 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>💬 เข้ากลุ่ม Line OpenChat</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl text-white font-extrabold text-sm gradient-brand shadow-lg hover:brightness-110 cursor-pointer"
              >
                เสร็จสิ้น / กลับสู่หน้าหลัก
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
