/**
 * Organizer Dashboard — Complete page
 *
 * Sections:
 *   1. Sidebar navigation (desktop) / top tab bar (mobile)
 *   2. Overview tab    — Summary cards + My Camps feed + System Camps
 *   3. Create Camp tab — 4-Step wizard: Details -> Promo Package -> Payment (PromptPay/Card) -> Official Receipt & Instant Live!
 *   4. My Ads tab      — AdListing table with status badges and metrics
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  Camp,
  OrganizerProfile,
  AdListing,
} from '../types/models';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

import SwiftPortLogo from '../components/SwiftPortLogo';
import { getSystemCamps, saveOrganizerCamp, saveActiveSponsoredAd, getActiveSponsoredAds } from '../services/campService';

// ─── Helpers & Types ─────────────────────────────────────────────────────────

type Tab = 'overview' | 'create-camp' | 'my-ads';

interface PromoPackage {
  id: string;
  name: string;
  badge: string;
  price: number;
  durationDays: number;
  impressionsEst: number;
  placement: 'standard' | 'feed_featured' | 'explore_banner' | 'vip_sponsor';
  description: string;
  features: string[];
}

const PROMO_PACKAGES: PromoPackage[] = [
  {
    id: 'pkg-standard',
    name: 'Standard Listing (ลงประกาศมาตรฐาน)',
    badge: 'ฟรี',
    price: 0,
    durationDays: 30,
    impressionsEst: 500,
    placement: 'standard',
    description: 'ลงประกาศค่ายในระบบปกติ นักเรียนสามารถค้นหาและปัดการ์ด Match ได้',
    features: ['แสดงในระบบค้นหาค่าย', 'ปัดการ์ด Match ได้', 'รับใบสมัครออนไลน์ฟรี'],
  },
  {
    id: 'pkg-feed-boost',
    name: 'Feed Boosted Match (ปักหมุดค่ายแนะนำ)',
    badge: '⚡ ยอดนิยม',
    price: 1200,
    durationDays: 7,
    impressionsEst: 3500,
    placement: 'feed_featured',
    description: 'เพิ่มคะแนนความเข้ากันได้ +15% และปักหมุดค่ายแนะนำในหน้า Match สำหรับนักเรียน',
    features: ['ปักหมุดค่ายแนะนำในการ์ดปัด', 'เพิ่มการมองเห็น 3 เท่า', 'แท็กค่าย Verified พิเศษ'],
  },
  {
    id: 'pkg-top-banner',
    name: 'Top Banner Featured (แบนเนอร์ใหญ่หน้าแรก)',
    badge: '🌟 เด่นที่สุด',
    price: 2500,
    durationDays: 14,
    impressionsEst: 8000,
    placement: 'explore_banner',
    description: 'แบนเนอร์พรีเมียมขนาดใหญ่ที่ด้านบนสุดของหน้าค้นหาค่ายของนักเรียนทุกคน',
    features: ['แบนเนอร์บนสุดของหน้าค้นหา', 'คลิกเปิดดูรายละเอียดทันที', 'เข้าถึงนักเรียนกว่า 8,000 ครั้ง'],
  },
  {
    id: 'pkg-vip-ultimate',
    name: 'VIP Ultimate Sponsor (แบนเนอร์ + ขึ้นอันดับ 1)',
    badge: '🚀 ครบวงจร',
    price: 4500,
    durationDays: 30,
    impressionsEst: 20000,
    placement: 'vip_sponsor',
    description: 'การันตียอดสมัครเต็มเร็วที่สุด ติดทั้ง Top Banner และปักหมุดอันดับ 1 ในการแมตช์',
    features: ['ได้ทั้ง Top Banner + Feed Boost', 'ปักหมุดอันดับ 1 ในการแมตช์', 'รายงานสถิติแบบ Real-time ละเอียด'],
  },
];

const PRESET_COVERS = [
  { label: '💻 วิศวะ & AI', url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800' },
  { label: '🩺 การแพทย์ & ชีวะ', url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800' },
  { label: '💼 บริหาร & ธุรกิจ', url: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800' },
  { label: '🎨 ศิลปะ & ออกแบบ', url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800' },
];

function formatDate(d: Date) {
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }).format(d);
}

function formatTHB(n: number) {
  return `฿${n.toLocaleString('th-TH')}`;
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }: {
  icon: string; label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-2"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-2xl font-black" style={{ color: accent ?? 'var(--color-text)' }}>{value}</p>
        <p className="text-sm font-bold">{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Camp Feed Card ──────────────────────────────────────────────────────────

function CampFeedCard({ camp }: { camp: Camp }) {
  const daysLeft = Math.max(0, Math.ceil((new Date(camp.applicationDeadline).getTime() - Date.now()) / 86400000));
  return (
    <article className="flex gap-4 rounded-2xl p-4 transition-all hover:shadow-md"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <img src={camp.coverImageUrl} alt="" className="w-24 h-24 rounded-xl object-cover flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-sm leading-snug">{camp.title}</h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{
              background: camp.status === 'published' ? '#DCFCE7' : '#F3F4F6',
              color: camp.status === 'published' ? '#16A34A' : '#6B7280',
            }}>
            {camp.status === 'published' ? '🟢 เผยแพร่แล้ว' : '📝 Draft'}
          </span>
        </div>
        <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--color-muted)' }}>
          📍 {camp.location} • ค่าสมัคร: {camp.cost === 0 ? 'ฟรี' : `฿${camp.cost.toLocaleString()}`}
        </p>
        <div className="flex flex-wrap gap-1.5 my-1.5">
          {camp.tags.slice(0, 3).map(t => (
            <span key={t} className="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: '#EDE9FE', color: '#5B21B6' }}>#{t}</span>
          ))}
        </div>
        <div className="flex gap-4 text-xs pt-1 border-t" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
          <span>👀 {camp.metrics?.views?.toLocaleString() || 120} views</span>
          <span>❤️ {camp.metrics?.swipesRight?.toLocaleString() || 45} สนใจ</span>
          <span>📝 {camp.metrics?.applications || 8} สมัคร</span>
          <span className={daysLeft <= 7 ? 'font-semibold text-orange-500' : ''}>
            ⏰ {daysLeft > 0 ? `เหลือ ${daysLeft} วัน` : 'หมดเขต'}
          </span>
        </div>
      </div>
    </article>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  camps,
  ads,
  profile,
  onGoCreate,
}: {
  camps: Camp[];
  ads: AdListing[];
  profile: OrganizerProfile;
  onGoCreate: () => void;
}) {
  const myCamps = camps.filter(c => c.organizerId === profile.id || c.organizerId === 'demo_organizer_01');
  const activeAds = ads.filter(a => a.status === 'active').length;
  const totalViews = myCamps.reduce((s, c) => s + (c.metrics?.views || 100), 0);
  const totalApps = myCamps.reduce((s, c) => s + (c.metrics?.applications || 5), 0);

  return (
    <div className="space-y-6">
      {/* Action Banner */}
      <div className="rounded-3xl p-6 text-white gradient-brand shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-extrabold tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
            ORGANIZER HUB • {profile.organizationName}
          </span>
          <h2 className="text-2xl font-black mt-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            สร้างค่ายและโปรโมตถึงนักเรียน TCAS ทั่วประเทศ
          </h2>
          <p className="text-xs text-purple-200 mt-1 max-w-xl">
            ลงประกาศค่ายวิชาการ เวิร์กช็อป หรือการแข่งขัน พร้อมเลือกซื้อพื้นที่โปรโมตติดอันดับ 1 เพิ่มยอดสมัครเต็มทันใจ
          </p>
        </div>
        <button
          onClick={onGoCreate}
          className="px-6 py-3.5 rounded-2xl bg-white text-purple-900 font-extrabold text-sm shadow-lg hover:scale-105 transition-transform active:scale-95 cursor-pointer whitespace-nowrap"
        >
          ➕ ลงข้อมูลค่าย & ซื้อพื้นที่ →
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="⛺" label="ค่ายของฉัน" value={myCamps.length} sub="ที่เผยแพร่แล้ว" />
        <StatCard icon="📊" label="Total Views" value={totalViews.toLocaleString()} sub="การเข้าชมทุกค่าย" accent="#7C3AED" />
        <StatCard icon="📝" label="ยอดส่งใบสมัคร" value={totalApps.toLocaleString()} sub="นักเรียนลงทะเบียน" accent="#16A34A" />
        <StatCard icon="📢" label="โฆษณาที่โปรโมต" value={activeAds || ads.length} sub="กำลังแสดงผลบนเว็บ" accent="#0EA5E9" />
      </div>

      {/* My Camps Feed */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">📋 ค่ายของฉัน ({myCamps.length})</h2>
          <button
            onClick={onGoCreate}
            className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
          >
            + สร้างค่ายใหม่
          </button>
        </div>

        {myCamps.length === 0 ? (
          <div className="text-center py-12 rounded-3xl" style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)' }}>
            <p className="text-4xl mb-2">🏕️</p>
            <p className="font-bold">ยังไม่มีค่ายที่สร้าง</p>
            <p className="text-xs mt-1 mb-4" style={{ color: 'var(--color-muted)' }}>เริ่มต้นลงข้อมูลค่ายแรกของคุณเพื่อให้เข้าถึงนักเรียน</p>
            <button
              onClick={onGoCreate}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white gradient-brand shadow-md"
            >
              ➕ สร้างค่ายแรกเลย
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {myCamps.map(c => <CampFeedCard key={c.id} camp={c} />)}
          </div>
        )}
      </section>

      {/* All Camps Feed (read-only reference) */}
      <section>
        <h2 className="text-base font-bold mb-3">🌐 ค่ายทั้งหมดในระบบ Swift Port</h2>
        <div className="space-y-3">
          {camps.filter(c => c.organizerId !== profile.id && c.organizerId !== 'demo_organizer_01').map(c => (
            <CampFeedCard key={c.id} camp={c} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── CREATE CAMP & BUY AD SPACE (4-STEP WIZARD) ───────────────────────────────

function CreateCampWizard({
  profile,
  onComplete,
}: {
  profile: OrganizerProfile;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Camp Details Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState(PRESET_COVERS[0].url);
  const [tags, setTags] = useState<string[]>(['Technology', 'Robotics', 'Science']);
  const [targetUniversity, setTargetUniversity] = useState('จุฬาลงกรณ์มหาวิทยาลัย');
  const [targetFaculty, setTargetFaculty] = useState('คณะวิศวกรรมศาสตร์');
  const [targetGrades, setTargetGrades] = useState<number[]>([10, 11, 12]);
  const [startDate, setStartDate] = useState('2026-11-20');
  const [endDate, setEndDate] = useState('2026-11-23');
  const [applicationDeadline, setApplicationDeadline] = useState('2026-11-15');
  const [location, setLocation] = useState('จุฬาลงกรณ์มหาวิทยาลัย อาคารวิศวฯ 100 ปี');
  const [isOnline, setIsOnline] = useState(false);
  const [capacity, setCapacity] = useState(50);
  const [cost, setCost] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 2: Promo Package Selection
  const [selectedPkg, setSelectedPkg] = useState<PromoPackage>(PROMO_PACKAGES[1]); // default feed boost

  // Step 3: Payment
  const [paymentMethod, setPaymentMethod] = useState<'promptpay' | 'credit_card'>('promptpay');
  const [companyTaxId, setCompanyTaxId] = useState('0105558912345');
  const [companyName, setCompanyName] = useState(profile.organizationName);
  const [slipVerified, setSlipVerified] = useState(false);
  const [countdown, setCountdown] = useState(899);

  const orderRefNumber = `ORG-ORD-${Date.now().toString().slice(-6)}`;

  // Timer countdown
  useEffect(() => {
    if (step === 3 && selectedPkg.price > 0 && countdown > 0) {
      const t = setInterval(() => setCountdown(c => c - 1), 1000);
      return () => clearInterval(t);
    }
  }, [step, selectedPkg.price, countdown]);

  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'กรุณาระบุชื่อค่าย/กิจกรรม';
    if (!description.trim() || description.length < 15) errs.description = 'กรุณาระบุคำอธิบายอย่างน้อย 15 ตัวอักษร';
    if (!coverImageUrl.trim()) errs.coverImageUrl = 'กรุณาใส่ลิงก์รูปภาพปก';
    if (!location.trim()) errs.location = 'กรุณาระบุสถานที่จัดกิจกรรม';
    if (!startDate) errs.startDate = 'กรุณาใส่วันเริ่มกิจกรรม';
    if (!endDate) errs.endDate = 'กรุณาใส่วันสิ้นสุดกิจกรรม';
    if (!applicationDeadline) errs.applicationDeadline = 'กรุณาใส่วันปิดรับสมัคร';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNextToPackage = () => {
    if (validateStep1()) setStep(2);
  };

  const handleNextToPayment = () => {
    setStep(3);
  };

  // Closing the Sale: Submit Camp + Publish Ad on Website
  const handleFinalCheckout = async () => {
    setSubmitting(true);
    try {
      const now = new Date();
      const newCampId = `camp-org-${Date.now().toString().slice(-6)}`;
      
      const newCamp: Camp = {
        id: newCampId,
        organizerId: profile.id,
        title: title.trim(),
        description: description.trim(),
        coverImageUrl: coverImageUrl.trim(),
        tags: tags.length > 0 ? tags : ['Activity'],
        targetGrades,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location: isOnline ? 'Online (Zoom / Meet)' : location.trim(),
        isOnline,
        applicationDeadline: new Date(applicationDeadline),
        status: 'published',
        capacity,
        cost,
        createdAt: now,
        metrics: { views: 1, swipesRight: 0, applications: 0 },
      };

      // 1. Save new camp to system
      saveOrganizerCamp(newCamp);

      // 2. If purchased promo space, save active sponsored ad
      if (selectedPkg.price > 0 || selectedPkg.placement !== 'standard') {
        const newAd: AdListing = {
          id: `ad-${Date.now().toString().slice(-6)}`,
          organizerId: profile.id,
          organizerName: profile.organizationName,
          packageId: selectedPkg.id,
          packageName: selectedPkg.name,
          placement: selectedPkg.placement === 'vip_sponsor' ? 'explore_banner' : (selectedPkg.placement as any),
          title: title.trim(),
          description: description.trim(),
          imageUrl: coverImageUrl.trim(),
          targetUrl: `#/camp/${newCampId}`,
          ctaText: 'ดูค่าย & สมัครเลย',
          startDate: now,
          endDate: new Date(now.getTime() + selectedPkg.durationDays * 86400000),
          status: 'active', // Immediately active because paid!
          totalCost: selectedPkg.price,
          paid: true,
          paidAt: now,
          metrics: { impressions: 1, clicks: 0, ctr: 0 },
          createdAt: now,
          updatedAt: now,
        };

        saveActiveSponsoredAd(newAd);
      }

      setStep(4);
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Wizard Progress Bar */}
      <div className="rounded-2xl p-4 border flex items-center justify-between"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        {[
          { n: 1, label: '1. ข้อมูลค่าย' },
          { n: 2, label: '2. เลือกพื้นที่โปรโมต' },
          { n: 3, label: '3. ชำระเงิน/จบการขาย' },
          { n: 4, label: '4. เผยแพร่ & ใบเสร็จ' },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= n ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {step > n ? '✓' : n}
            </span>
            <span className={`text-xs font-bold hidden sm:inline ${step >= n ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ─── STEP 1: CAMP DETAILS ─── */}
      {step === 1 && (
        <div className="rounded-3xl p-6 border space-y-5"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="text-xl font-black" style={{ fontFamily: 'Syne, sans-serif' }}>
              📝 กรอกรายละเอียดค่ายใหม่
            </h3>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              ข้อมูลนี้จะแสดงผลบนหน้าต่างการค้นหาค่ายและหน้าจับคู่ (Match) ของนักเรียน
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">ชื่อค่าย / กิจกรรม *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="เช่น Chula AI & Engineering Camp 2026"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500"
                style={{ background: 'var(--color-elevated)', borderColor: errors.title ? '#EF4444' : 'var(--color-border)' }}
              />
              {errors.title && <p className="text-[11px] text-red-500 mt-0.5">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">คำอธิบายรายละเอียดค่าย *</label>
              <textarea
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="อธิบายกิจกรรม สิ่งที่น้องๆ จะได้รับ โครงการ และผลงานสำหรับใส่ Portfolio..."
                className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                style={{ background: 'var(--color-elevated)', borderColor: errors.description ? '#EF4444' : 'var(--color-border)' }}
              />
              {errors.description && <p className="text-[11px] text-red-500 mt-0.5">{errors.description}</p>}
            </div>

            {/* Cover Image & Presets */}
            <div>
              <label className="block text-xs font-semibold mb-1">รูปภาพปกค่าย (Cover Image URL) *</label>
              <input
                type="url"
                value={coverImageUrl}
                onChange={e => setCoverImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
              />
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-[11px] text-slate-400">หรือเลือกรูปแนะนำ:</span>
                {PRESET_COVERS.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setCoverImageUrl(p.url)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags Selector */}
            <div>
              <label className="block text-xs font-semibold mb-1.5">หมวดหมู่ / Tags (เลือกได้หลายข้อ)</label>
              <div className="flex flex-wrap gap-1.5">
                {['Technology', 'Robotics', 'Science', 'Medicine', 'Business', 'Design', 'Math', 'Leadership'].map(tag => {
                  const active = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTags(prev => active ? prev.filter(t => t !== tag) : [...prev, tag])}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        active ? 'bg-purple-600 text-white border-purple-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target University & Faculty */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">มหาวิทยาลัยเป้าหมาย</label>
                <input
                  type="text"
                  value={targetUniversity}
                  onChange={e => setTargetUniversity(e.target.value)}
                  placeholder="เช่น จุฬาลงกรณ์มหาวิทยาลัย"
                  className="w-full px-3.5 py-2 rounded-xl text-sm border"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">คณะเป้าหมาย</label>
                <input
                  type="text"
                  value={targetFaculty}
                  onChange={e => setTargetFaculty(e.target.value)}
                  placeholder="เช่น คณะวิศวกรรมศาสตร์"
                  className="w-full px-3.5 py-2 rounded-xl text-sm border"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                />
              </div>
            </div>

            {/* Target Grades */}
            <div>
              <label className="block text-xs font-semibold mb-1.5">ระดับชั้นที่เปิดรับสมัคร</label>
              <div className="flex gap-2">
                {[10, 11, 12].map(g => {
                  const active = targetGrades.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setTargetGrades(prev => active ? prev.filter(x => x !== g) : [...prev, g])}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        active ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      ม.{g - 6} (มัธยมศึกษาปีที่ {g - 6})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dates & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">วันเริ่มจัดกิจกรรม *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm border"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">วันสิ้นสุดกิจกรรม *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm border"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">วันปิดรับสมัคร *</label>
                <input
                  type="date"
                  value={applicationDeadline}
                  onChange={e => setApplicationDeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm border"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1">สถานที่จัดกิจกรรม</label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="เช่น จุฬาลงกรณ์มหาวิทยาลัย อาคารวิศวฯ"
                  className="w-full px-3.5 py-2 rounded-xl text-sm border"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">รูปแบบกิจกรรม</label>
                <button
                  type="button"
                  onClick={() => setIsOnline(!isOnline)}
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                >
                  <span>{isOnline ? '🌐 ออนไลน์ (Online)' : '📍 หน้างาน (Onsite)'}</span>
                </button>
              </div>
            </div>

            {/* Capacity & Registration Fee */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">จำนวนรับสมัคร (คน)</label>
                <input
                  type="number"
                  value={capacity}
                  onChange={e => setCapacity(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">ค่าลงทะเบียนที่เก็บจากนักเรียน (บาท)</label>
                <input
                  type="number"
                  value={cost}
                  onChange={e => setCost(Number(e.target.value))}
                  placeholder="0 = ฟรี"
                  className="w-full px-3.5 py-2 rounded-xl text-sm border font-mono"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                />
                <p className="text-[10px] text-slate-400 mt-0.5">{cost === 0 ? '✓ ค่ายฟรีไม่มีค่าใช้จ่าย' : `เก็บเงินนักเรียน ฿${cost.toLocaleString()} บาท/คน`}</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end" style={{ borderColor: 'var(--color-border)' }}>
            <button
              type="button"
              onClick={handleNextToPackage}
              className="py-3 px-6 rounded-2xl text-white font-extrabold text-sm gradient-brand shadow-lg hover:scale-105 transition-transform active:scale-95 cursor-pointer"
            >
              ต่อไป: เลือกพื้นที่โปรโมตค่าย →
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 2: CHOOSE PROMO PACKAGE ─── */}
      {step === 2 && (
        <div className="rounded-3xl p-6 border space-y-6"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <h3 className="text-xl font-black" style={{ fontFamily: 'Syne, sans-serif' }}>
                📢 เลือกแพ็กเกจพื้นที่โปรโมตค่าย
              </h3>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                เลือกพื้นที่เพื่อให้ค่าย "{title}" ได้รับการมองเห็นสูงสุด
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              ← แก้ไขข้อมูลค่าย
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PROMO_PACKAGES.map(pkg => {
              const selected = selectedPkg.id === pkg.id;
              return (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPkg(pkg)}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    selected ? 'border-purple-600 shadow-xl bg-purple-500/5' : 'border-slate-200 dark:border-slate-800 hover:border-purple-300'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                        {pkg.badge}
                      </span>
                      <p className="text-xl font-black text-purple-600 dark:text-purple-400 font-mono">
                        {pkg.price === 0 ? 'ฟรี' : formatTHB(pkg.price)}
                      </p>
                    </div>

                    <h4 className="font-extrabold text-base mb-1">{pkg.name}</h4>
                    <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-muted)' }}>
                      {pkg.description}
                    </p>

                    <div className="space-y-1.5 border-t pt-2.5" style={{ borderColor: 'var(--color-border)' }}>
                      {pkg.features.map(f => (
                        <div key={f} className="flex items-center gap-1.5 text-xs">
                          <span className="text-emerald-500 font-bold">✓</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t flex justify-between items-center text-xs" style={{ borderColor: 'var(--color-border)' }}>
                    <span style={{ color: 'var(--color-muted)' }}>ระยะเวลา: {pkg.durationDays} วัน</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">
                      {selected ? '● เลือกแพ็กเกจนี้' : 'เลือก'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t flex justify-between items-center" style={{ borderColor: 'var(--color-border)' }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
            >
              ← กลับไปแก้ไขค่าย
            </button>

            <button
              type="button"
              onClick={handleNextToPayment}
              className="py-3 px-6 rounded-2xl text-white font-extrabold text-sm gradient-brand shadow-lg hover:scale-105 transition-transform active:scale-95 cursor-pointer"
            >
              ต่อไป: สรุปคำสั่งซื้อและชำระเงิน ({selectedPkg.price === 0 ? 'ฟรี' : formatTHB(selectedPkg.price)}) →
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: PAYMENT & CLOSING THE SALE (จบการขาย) ─── */}
      {step === 3 && (
        <div className="rounded-3xl p-6 border space-y-6"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="border-b pb-3 flex justify-between items-center" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <h3 className="text-xl font-black" style={{ fontFamily: 'Syne, sans-serif' }}>
                💳 ชำระเงิน & เผยแพร่ค่าย (Checkout)
              </h3>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                ยืนยันการสั่งซื้อพื้นที่โฆษณาและเผยแพร่ค่ายสู่หน้าเว็บนักเรียนทันที
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
              Ref: {orderRefNumber}
            </span>
          </div>

          {/* Order Summary Box */}
          <div className="rounded-2xl p-4 border space-y-2 text-xs"
            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
            <div className="flex justify-between items-start pb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <strong className="text-sm block">{title}</strong>
                <span style={{ color: 'var(--color-muted)' }}>แพ็กเกจ: {selectedPkg.name} ({selectedPkg.durationDays} วัน)</span>
              </div>
              <span className="text-base font-black text-purple-600 dark:text-purple-400 font-mono">
                {selectedPkg.price === 0 ? 'ฟรี' : formatTHB(selectedPkg.price)}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-muted)' }}>ผู้จัดค่าย:</span>
              <span>{profile.organizationName}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-muted)' }}>ค่าธรรมเนียมระบบ:</span>
              <span className="text-emerald-600 font-bold">ฟรี (ไม่มีค่าบริการแอบแฝง)</span>
            </div>
            <div className="flex justify-between text-base font-black pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <span>ยอดชำระสุทธิ (Net Total):</span>
              <span className="text-xl text-purple-600 dark:text-purple-400 font-mono">
                {selectedPkg.price === 0 ? '฿0 ฟรี' : formatTHB(selectedPkg.price)}
              </span>
            </div>
          </div>

          {/* Free Standard Package Mode */}
          {selectedPkg.price === 0 ? (
            <div className="rounded-2xl p-5 border text-center space-y-2 bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
              <span className="text-3xl block">🎉</span>
              <h4 className="font-extrabold text-base">แพ็กเกจ Standard ไม่มีค่าใช้จ่าย</h4>
              <p className="text-xs">
                คุณสามารถกดยืนยันเพื่อเผยแพร่ค่ายนี้ลงบนเว็บให้นักเรียนค้นหาและสมัครได้ทันที
              </p>
            </div>
          ) : (
            /* Paid Promo Space Mode */
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                เลือกช่องทางการชำระเงิน
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('promptpay')}
                  className={`p-3 rounded-2xl border text-center cursor-pointer transition-all ${
                    paymentMethod === 'promptpay' ? 'border-purple-600 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-black' : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <span className="text-xl block mb-1">📱</span>
                  <span className="text-xs">PromptPay QR Code</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('credit_card')}
                  className={`p-3 rounded-2xl border text-center cursor-pointer transition-all ${
                    paymentMethod === 'credit_card' ? 'border-purple-600 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-black' : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <span className="text-xl block mb-1">💳</span>
                  <span className="text-xs">บัตรเครดิตองค์กร / Visa</span>
                </button>
              </div>

              {/* PromptPay QR Section */}
              {paymentMethod === 'promptpay' && (
                <div className="rounded-3xl p-5 border flex flex-col items-center shadow-sm"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <div className="w-full max-w-xs bg-[#1A365D] text-white py-2 px-4 rounded-t-2xl flex items-center justify-between text-xs font-bold">
                    <span>🇹🇭 PromptPay • พร้อมเพย์</span>
                    <span className="font-mono text-sky-200">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
                  </div>

                  <div className="w-full max-w-xs bg-white p-5 rounded-b-2xl border-x border-b border-slate-200 shadow-md flex flex-col items-center text-slate-800">
                    <div className="w-48 h-48 bg-white p-2 rounded-xl border flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
                        <rect x="5" y="5" width="26" height="26" rx="4" fill="#0F172A" />
                        <rect x="9" y="9" width="18" height="18" rx="2" fill="white" />
                        <rect x="13" y="13" width="10" height="10" rx="1" fill="#0F172A" />
                        <rect x="69" y="5" width="26" height="26" rx="4" fill="#0F172A" />
                        <rect x="73" y="9" width="18" height="18" rx="2" fill="white" />
                        <rect x="77" y="13" width="10" height="10" rx="1" fill="#0F172A" />
                        <rect x="5" y="69" width="26" height="26" rx="4" fill="#0F172A" />
                        <rect x="9" y="73" width="18" height="18" rx="2" fill="white" />
                        <rect x="13" y="77" width="10" height="10" rx="1" fill="#0F172A" />
                        <circle cx="50" cy="50" r="9" fill="#7C3AED" />
                        <path d="M47 50L53 50M50 47L50 53" stroke="white" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>

                    <p className="text-xl font-black text-slate-900 font-mono mt-2">
                      {formatTHB(selectedPkg.price)}.00
                    </p>
                    <p className="text-[10px] text-slate-400">สแกนชำระผ่านแอปธนาคารขององค์กร/บุคคลได้ทุกธนาคาร</p>
                  </div>

                  {/* Simulated Slip Verification */}
                  <div className="w-full mt-4 p-3.5 rounded-2xl border flex items-center justify-between"
                    style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center gap-2">
                      <span>{slipVerified ? '✅' : '📎'}</span>
                      <span className="text-xs font-bold">
                        {slipVerified ? 'สลิปการชำระเงินได้รับการตรวจสอบแล้ว' : 'แนบสลิปเพื่อยืนยันชำระเงิน'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSlipVerified(true)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 cursor-pointer"
                    >
                      {slipVerified ? '✓ สลิปถูกต้อง' : '⚡ ตรวจสอบสลิปทันที'}
                    </button>
                  </div>
                </div>
              )}

              {/* Credit Card Section */}
              {paymentMethod === 'credit_card' && (
                <div className="rounded-2xl p-4 border space-y-3"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <div>
                    <label className="block text-xs font-semibold mb-1">หมายเลขบัตรเครดิตองค์กร</label>
                    <input
                      type="text"
                      defaultValue="5412 •••• •••• 8899"
                      className="w-full px-3.5 py-2 rounded-xl text-sm border font-mono"
                      style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold mb-1">วันหมดอายุ (MM/YY)</label>
                      <input type="text" defaultValue="08/29" className="w-full px-3.5 py-2 rounded-xl text-sm border font-mono" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">CVV</label>
                      <input type="password" defaultValue="888" className="w-full px-3.5 py-2 rounded-xl text-sm border font-mono" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Tax Invoice Info */}
              <div className="p-4 rounded-2xl border space-y-2"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
                <p className="text-xs font-bold flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                  <span>📄</span> ข้อมูลสำหรับออกใบกำกับภาษี / ใบเสร็จรับเงินองค์กร
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">ชื่อหน่วยงาน/องค์กร</span>
                    <input
                      type="text"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border"
                      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                    />
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">เลขประจำตัวผู้เสียภาษี (Tax ID)</span>
                    <input
                      type="text"
                      value={companyTaxId}
                      onChange={e => setCompanyTaxId(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border font-mono"
                      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Checkout CTA */}
          <div className="pt-4 border-t flex justify-between items-center" style={{ borderColor: 'var(--color-border)' }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
            >
              ← เปลี่ยนแพ็กเกจ
            </button>

            <button
              type="button"
              onClick={handleFinalCheckout}
              disabled={submitting || (selectedPkg.price > 0 && paymentMethod === 'promptpay' && !slipVerified)}
              className="py-3.5 px-8 rounded-2xl text-white font-extrabold text-sm gradient-brand shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? 'กำลังบันทึกและเผยแพร่...' : `🔒 ยืนยันชำระเงิน ${selectedPkg.price === 0 ? 'ฟรี' : formatTHB(selectedPkg.price)} & เผยแพร่ค่ายทันที`}
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 4: SUCCESS & OFFICIAL TAX RECEIPT ─── */}
      {step === 4 && (
        <div className="rounded-3xl p-6 border space-y-6 text-center"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <span className="text-5xl block animate-bounce">🎉</span>
          <div>
            <h3 className="text-2xl font-black" style={{ fontFamily: 'Syne, sans-serif' }}>
              เผยแพร่ค่าย & ชำระเงินค่าโฆษณาสำเร็จ!
            </h3>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1">
              ✓ ค่ายของคุณขึ้นแสดงผลบนระบบหน้าเว็บนักเรียนเรียบร้อยแล้ว
            </p>
          </div>

          {/* Official Tax Receipt Card */}
          <div className="max-w-md mx-auto rounded-3xl p-5 border text-left space-y-3 shadow-md"
            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
            <div className="flex justify-between items-start pb-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <p className="text-[10px] font-bold text-slate-400">ใบเสร็จรับเงิน / ใบกำกับภาษีอิเล็กทรอนิกส์</p>
                <h4 className="text-base font-black">SWIFT PORT (THAILAND) CO., LTD.</h4>
                <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>เลขประจำตัวผู้เสียภาษี: 0105562098741</p>
              </div>
              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-900">
                PAID ✓
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">เลขที่ใบเสร็จ:</span>
                <span className="font-mono font-bold">{orderRefNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">วันที่:</span>
                <span>{formatDate(new Date())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ลูกค้า:</span>
                <span>{companyName} (Tax ID: {companyTaxId})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">รายการ:</span>
                <span>{selectedPkg.name} ({title})</span>
              </div>
              <div className="flex justify-between text-base font-black pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <span>ยอดเงินสุทธิ:</span>
                <span className="text-purple-600 dark:text-purple-400 font-mono">
                  {selectedPkg.price === 0 ? '฿0 ฟรี' : formatTHB(selectedPkg.price)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => alert(`ดาวน์โหลดใบเสร็จรับเงิน ${orderRefNumber} เรียบร้อยแล้ว!`)}
              className="px-5 py-3 rounded-2xl text-xs font-bold border border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:bg-purple-50 cursor-pointer"
            >
              📥 บันทึกใบเสร็จเบิกงบองค์กร (PDF)
            </button>
            <button
              type="button"
              onClick={onComplete}
              className="px-6 py-3 rounded-2xl text-white font-extrabold text-xs gradient-brand shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
            >
              กลับสู่หน้าภาพรวมค่าย →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── My Ads Tab ───────────────────────────────────────────────────────────────

function MyAdsTab({ ads, onGoCreate }: { ads: AdListing[]; onGoCreate: () => void }) {
  if (ads.length === 0) {
    return (
      <div className="text-center py-20 rounded-3xl"
        style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)' }}>
        <p className="text-5xl mb-4">📢</p>
        <p className="font-bold text-lg">ยังไม่มีโฆษณาที่โปรโมต</p>
        <p className="mt-1 text-xs mb-4" style={{ color: 'var(--color-muted)' }}>
          คุณสามารถโปรโมตค่ายของคุณเพื่อให้ขึ้นเป็นค่ายแนะนำหรือติดแบนเนอร์หน้าแรก
        </p>
        <button
          onClick={onGoCreate}
          className="px-5 py-2.5 rounded-xl text-xs font-bold text-white gradient-brand shadow-md"
        >
          ➕ ลงข้อมูลค่าย & ซื้อพื้นที่โปรโมต
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
          {ads.length} รายการโฆษณาที่กำลังแสดงผลบนระบบ
        </p>
        <button
          onClick={onGoCreate}
          className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
        >
          + ซื้อพื้นที่โปรโมตเพิ่ม
        </button>
      </div>

      {ads.map(ad => (
        <div key={ad.id} className="rounded-2xl overflow-hidden p-4 border flex gap-4"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <img src={ad.imageUrl} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <h4 className="font-bold text-sm truncate">{ad.title}</h4>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                🟢 กำลังแสดงผล
              </span>
            </div>
            <p className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--color-muted)' }}>{ad.description}</p>
            <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--color-muted)' }}>
              <span>📦 {ad.packageName}</span>
              <span>📅 {formatDate(new Date(ad.startDate))} – {formatDate(new Date(ad.endDate))}</span>
              <span className="font-bold text-purple-600 dark:text-purple-400">{formatTHB(ad.totalCost)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Organizer Dashboard Component ────────────────────────────────────────

const NAV_ITEMS: { tab: Tab; icon: string; label: string }[] = [
  { tab: 'overview',     icon: '📊', label: 'ภาพรวม' },
  { tab: 'create-camp',  icon: '⛺', label: 'ลงข้อมูลค่าย & ซื้อพื้นที่' },
  { tab: 'my-ads',       icon: '📢', label: 'โฆษณาของฉัน' },
];

export default function OrganizerDashboard() {
  const { profile: userProfile, logout } = useAuth();
  const profile: OrganizerProfile = (userProfile as OrganizerProfile) || {
    id: 'demo_organizer_01',
    email: 'org@example.com',
    role: 'organizer',
    organizationName: 'Demo Organization',
    contactEmail: 'org@example.com',
    description: 'A demo organization',
    verified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [camps, setCamps] = useState<Camp[]>(() => getSystemCamps());
  const [ads, setAds] = useState<AdListing[]>(() => getActiveSponsoredAds());
  const [dark, setDark] = useState(false);

  // Reload camps and ads
  const refreshData = useCallback(() => {
    setCamps(getSystemCamps());
    setAds(getActiveSponsoredAds());
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const toggleDark = () => {
    setDark(d => {
      document.documentElement.classList.toggle('dark', !d);
      return !d;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {/* ─── Desktop Sidebar ─── */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 sticky top-0 h-screen overflow-y-auto"
        style={{ background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}>
        {/* Logo */}
        <div className="p-5 flex items-center" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <SwiftPortLogo
            size="sm"
            subtitle="Organizer Hub"
          />
        </div>

        {/* Organizer Info */}
        <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: '#EDE9FE' }}>🏛️</div>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-snug truncate">{profile.organizationName}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: '#DCFCE7', color: '#16A34A' }}>✅ Verified Hub</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1" aria-label="Organizer menu">
          {NAV_ITEMS.map(({ tab, icon, label }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all text-left cursor-pointer ${
                activeTab === tab
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Footer actions */}
        <div className="p-3 border-t space-y-2" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-xl border border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors cursor-pointer"
          >
            <span>👀 สลับไปมุมมองนักเรียน</span>
          </button>

          <button
            onClick={toggleDark}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-xl border transition-colors cursor-pointer"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
          >
            <span>{dark ? '☀️ Light Mode' : '🌙 Dark Mode'}</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full py-2 text-xs font-bold rounded-xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-200 transition-colors cursor-pointer"
          >
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 flex items-center justify-between px-6 h-16"
          style={{
            background: 'color-mix(in srgb, var(--color-surface) 85%, transparent)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--color-border)',
          }}>
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <SwiftPortLogo size="xs" showText={false} />
            </div>
            <h1 className="font-extrabold text-base" style={{ fontFamily: 'Syne, sans-serif' }}>
              {activeTab === 'overview'     && '📊 ภาพรวมค่าย & สถิติ'}
              {activeTab === 'create-camp'  && '⛺ ลงข้อมูลค่าย & ซื้อพื้นที่โปรโมต'}
              {activeTab === 'my-ads'       && '📢 โฆษณาที่กำลังแสดงผล'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="text-xs px-3 py-1.5 rounded-xl border border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-400 font-bold hover:bg-purple-50 transition-colors cursor-pointer"
            >
              👀 ดูเว็บนักเรียน
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'overview' && (
            <OverviewTab
              camps={camps}
              ads={ads}
              profile={profile}
              onGoCreate={() => setActiveTab('create-camp')}
            />
          )}

          {activeTab === 'create-camp' && (
            <CreateCampWizard
              profile={profile}
              onComplete={() => {
                refreshData();
                setActiveTab('overview');
              }}
            />
          )}

          {activeTab === 'my-ads' && (
            <MyAdsTab
              ads={ads}
              onGoCreate={() => setActiveTab('create-camp')}
            />
          )}
        </main>
      </div>


    </div>
  );
}
