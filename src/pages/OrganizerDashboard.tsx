/**
 * Organizer Dashboard — Complete page
 *
 * Sections:
 *   1. Sidebar navigation (desktop) / top tab bar (mobile)
 *   2. Overview tab  — Summary cards + Camp list feed (read-only)
 *   3. My Ads tab    — AdListing table with status badges
 *   4. Buy Ads tab   — Package picker + creative form + preview
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  AdListing,
  AdListingForm,
  AdPackage,
  Camp,
  OrganizerProfile,
} from '../types/models';
import { AD_PACKAGES } from '../types/models';
import { createAdListing, fetchOrganizerAds, deleteAdListing } from '../services/adService';
import { mockCamps } from '../data/mockData';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import DevTestBar from '../components/DevTestBar';
import SwiftPortLogo from '../components/SwiftPortLogo';

const ALL_CAMPS: Camp[] = mockCamps;

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'my-ads' | 'buy-ads';

const STATUS_CONFIG = {
  pending:  { label: 'รอ Approve', color: '#F59E0B', bg: '#FEF3C7', icon: '⏳' },
  approved: { label: 'อนุมัติแล้ว', color: '#0284C7', bg: '#E0F2FE', icon: '✅' },
  active:   { label: 'กำลังแสดง', color: '#16A34A', bg: '#DCFCE7', icon: '🟢' },
  rejected: { label: 'ถูกปฏิเสธ', color: '#DC2626', bg: '#FEE2E2', icon: '❌' },
  expired:  { label: 'หมดอายุ', color: '#6B7280', bg: '#F3F4F6', icon: '⌛' },
} as const;

const PLACEMENT_LABELS: Record<string, string> = {
  feed_featured:   '📰 Feed Featured',
  explore_banner:  '🔍 Explore Banner',
  sidebar_right:   '📌 Sidebar',
  checklist_cta:   '🎯 Checklist CTA',
};

function formatDate(d: Date) {
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }).format(d);
}

function formatTHB(n: number) {
  return `฿${n.toLocaleString('th-TH')}`;
}

function daysUntil(d: Date) {
  const diff = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  return diff;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }: {
  icon: string; label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-2"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-2xl font-bold" style={{ color: accent ?? 'var(--color-text)' }}>{value}</p>
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{sub}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span aria-hidden="true">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function CampFeedCard({ camp }: { camp: Camp }) {
  const daysLeft = daysUntil(camp.applicationDeadline);
  return (
    <article className="flex gap-4 rounded-2xl p-4 transition-all"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <img src={camp.coverImageUrl} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-snug">{camp.title}</h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{
              background: camp.status === 'published' ? '#DCFCE7' : '#F3F4F6',
              color: camp.status === 'published' ? '#16A34A' : '#6B7280',
            }}>
            {camp.status === 'published' ? '🟢 เผยแพร่' : '📝 Draft'}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 my-1.5">
          {camp.tags.slice(0, 3).map(t => (
            <span key={t} className="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: '#EDE9FE', color: '#5B21B6' }}>{t}</span>
          ))}
        </div>
        <div className="flex gap-4 text-xs" style={{ color: 'var(--color-muted)' }}>
          <span>👀 {camp.metrics.views.toLocaleString()}</span>
          <span>❤️ {camp.metrics.swipesRight.toLocaleString()}</span>
          <span>📝 {camp.metrics.applications} สมัคร</span>
          <span className={daysLeft <= 7 ? 'font-semibold text-orange-500' : ''}>
            ⏰ {daysLeft > 0 ? `${daysLeft} วัน` : 'หมดเขต'}
          </span>
        </div>
      </div>
    </article>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ ads, profile }: { ads: AdListing[], profile: OrganizerProfile }) {
  const MY_CAMPS = mockCamps.filter(c => c.organizerId === profile.id);
  const activeAds = ads.filter(a => a.status === 'active').length;
  const pendingAds = ads.filter(a => a.status === 'pending').length;
  const totalImpressions = ads.reduce((s, a) => s + a.metrics.impressions, 0);
  const totalClicks = ads.reduce((s, a) => s + a.metrics.clicks, 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="⛺" label="ค่ายของฉัน" value={MY_CAMPS.length} sub="ที่เผยแพร่แล้ว" />
        <StatCard icon="📊" label="Total Views" value={MY_CAMPS.reduce((s,c)=>s+c.metrics.views,0).toLocaleString()} sub="ทุกค่ายรวมกัน" accent="#7C3AED" />
        <StatCard icon="🟢" label="โฆษณากำลังแสดง" value={activeAds} sub={`รอ Approve ${pendingAds} รายการ`} accent="#16A34A" />
        <StatCard icon="👆" label="Ad Clicks" value={totalClicks.toLocaleString()} sub={`${totalImpressions.toLocaleString()} impressions`} accent="#0EA5E9" />
      </div>

      {/* My Camps Feed */}
      <section>
        <h2 className="text-base font-bold mb-3">📋 ค่ายของฉัน</h2>
        {MY_CAMPS.length === 0 ? (
          <div className="text-center py-12 rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-4xl mb-3">🏕️</p>
            <p className="font-semibold">ยังไม่มีค่าย</p>
            <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>สร้างค่ายแรกเพื่อเริ่มต้น</p>
          </div>
        ) : (
          <div className="space-y-3">
            {MY_CAMPS.map(c => <CampFeedCard key={c.id} camp={c} />)}
          </div>
        )}
      </section>

      {/* All Camps Feed (read-only) */}
      <section>
        <h2 className="text-base font-bold mb-3">🌐 ค่ายทั้งหมดในระบบ</h2>
        <div className="space-y-3">
          {ALL_CAMPS.filter(c => c.organizerId !== profile.id).map(c => (
            <CampFeedCard key={c.id} camp={c} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── My Ads Tab ───────────────────────────────────────────────────────────────

function MyAdsTab({ ads, onDelete, loading }: {
  ads: AdListing[];
  onDelete: (id: string) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-current border-t-transparent animate-spin"
          style={{ color: '#7C3AED' }} />
      </div>
    );
  }

  if (ads.length === 0) {
    return (
      <div className="text-center py-20 rounded-2xl"
        style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)' }}>
        <p className="text-5xl mb-4">📢</p>
        <p className="font-bold text-lg">ยังไม่มีโฆษณา</p>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
          ไปที่แท็บ "ซื้อพื้นที่โฆษณา" เพื่อสร้างโฆษณาแรก
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
        {ads.length} รายการ — สถานะ pending จะรอ Admin approve ก่อนเริ่มแสดงผล
      </p>

      {ads.map(ad => {
        const daysLeft = daysUntil(ad.endDate);
        const canDelete = ad.status === 'pending' || ad.status === 'rejected';

        return (
          <div key={ad.id} className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex gap-4 p-4">
              {/* Ad Image */}
              <div className="relative flex-shrink-0">
                <img src={ad.imageUrl || 'https://via.placeholder.com/80x80?text=No+Image'}
                  alt={ad.title}
                  className="w-20 h-20 rounded-xl object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80x80?text=Ad'; }}
                />
                <span className="absolute -top-1.5 -right-1.5 text-xs px-1.5 py-0.5 rounded-full text-white font-semibold"
                  style={{ background: '#5B21B6', fontSize: '10px' }}>
                  {PLACEMENT_LABELS[ad.placement]}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="font-bold text-sm leading-snug">{ad.title}</h3>
                  <StatusBadge status={ad.status} />
                </div>
                <p className="text-xs line-clamp-2 mb-2" style={{ color: 'var(--color-muted)' }}>
                  {ad.description}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--color-muted)' }}>
                  <span>📦 {ad.packageName}</span>
                  <span>📅 {formatDate(ad.startDate)} – {formatDate(ad.endDate)}</span>
                  <span className={`font-semibold ${daysLeft <= 3 && daysLeft > 0 ? 'text-orange-500' : ''}`}>
                    {daysLeft > 0 ? `⏰ เหลือ ${daysLeft} วัน` : '⌛ หมดอายุ'}
                  </span>
                  <span className="font-semibold" style={{ color: '#5B21B6' }}>
                    {formatTHB(ad.totalCost)}
                  </span>
                </div>
              </div>
            </div>

            {/* Metrics row (for active/expired ads) */}
            {(ad.status === 'active' || ad.status === 'expired') && (
              <div className="flex gap-6 px-4 pb-4 pt-0">
                {[
                  { label: 'Impressions', v: ad.metrics.impressions.toLocaleString(), icon: '👁️' },
                  { label: 'Clicks', v: ad.metrics.clicks.toLocaleString(), icon: '👆' },
                  { label: 'CTR', v: `${ad.metrics.ctr.toFixed(1)}%`, icon: '📈' },
                ].map(m => (
                  <div key={m.label} className="rounded-xl px-3 py-2 text-center"
                    style={{ background: 'var(--color-elevated)' }}>
                    <p className="text-base font-bold">{m.icon} {m.v}</p>
                    <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{m.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Rejection reason */}
            {ad.status === 'rejected' && ad.rejectionReason && (
              <div className="mx-4 mb-4 px-3 py-2 rounded-xl text-xs"
                style={{ background: '#FEE2E2', color: '#DC2626' }}>
                ❌ เหตุผล: {ad.rejectionReason}
              </div>
            )}

            {/* Actions */}
            {canDelete && (
              <div className="px-4 pb-4 flex justify-end">
                <button
                  onClick={() => onDelete(ad.id)}
                  className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95"
                  style={{ background: '#FEE2E2', color: '#DC2626' }}>
                  🗑️ ลบโฆษณา
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Buy Ads Tab ──────────────────────────────────────────────────────────────

function BuyAdsTab({ onSuccess, profile }: { onSuccess: () => void, profile: OrganizerProfile }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPkg, setSelectedPkg] = useState<AdPackage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<AdListingForm>({
    packageId: '',
    title: '',
    description: '',
    imageUrl: '',
    targetUrl: '',
    ctaText: 'สมัครเลย',
    startDate: '',
    endDate: '',
  });

  // Auto-set end date when package selected
  const pickPackage = (pkg: AdPackage) => {
    setSelectedPkg(pkg);
    const today = new Date();
    const end = new Date(today.getTime() + pkg.durationDays * 86_400_000);
    const toISO = (d: Date) => d.toISOString().split('T')[0];
    setForm(f => ({
      ...f,
      packageId: pkg.id,
      startDate: toISO(today),
      endDate: toISO(end),
    }));
    setStep(2);
  };

  const handleField = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const isFormValid = form.title.trim().length >= 3
    && form.description.trim().length >= 10
    && form.targetUrl.trim().startsWith('http')
    && form.startDate
    && form.endDate;

  const handleSubmit = async () => {
    if (!isFormValid || !selectedPkg) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createAdListing(profile.id, profile.organizationName, form);
      setStep(3);
      setTimeout(() => {
        onSuccess();
        setStep(1);
        setSelectedPkg(null);
        setForm({ packageId: '', title: '', description: '', imageUrl: '', targetUrl: '', ctaText: 'สมัครเลย', startDate: '', endDate: '' });
      }, 2500);
    } catch (err) {
      setSubmitError('ไม่สามารถส่งโฆษณาได้ กรุณาลองใหม่ (หรือตรวจสอบ Firebase config)');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 3) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-6"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}>🎉</div>
        <h2 className="text-2xl font-bold mb-2">ส่งโฆษณาสำเร็จ!</h2>
        <p style={{ color: 'var(--color-muted)' }}>
          โฆษณาของคุณอยู่ในสถานะ <strong>Pending</strong> — รอ Admin อนุมัติก่อนเริ่มแสดงผล
        </p>
        <p className="text-sm mt-3" style={{ color: 'var(--color-muted)' }}>กำลังพาไปยัง "โฆษณาของฉัน"...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* ─── Step Indicator ─── */}
      <div className="flex items-center gap-3">
        {[
          { n: 1, label: 'เลือกแพ็กเกจ' },
          { n: 2, label: 'กรอกรายละเอียด' },
        ].map(({ n, label }, i) => (
          <div key={n} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px" style={{ background: 'var(--color-border)' }} />}
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  background: step >= n ? '#5B21B6' : 'var(--color-elevated)',
                  color: step >= n ? 'white' : 'var(--color-muted)',
                }}>{n}</span>
              <span className="text-sm font-medium hidden sm:block"
                style={{ color: step >= n ? 'var(--color-text)' : 'var(--color-muted)' }}>
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Step 1: Package Picker ─── */}
      {step === 1 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold mb-1">เลือกแพ็กเกจโฆษณา</h2>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              ราคาทั้งหมดไม่รวม VAT — โฆษณาจะเริ่มแสดงหลัง Admin approve
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {AD_PACKAGES.map(pkg => (
              <button key={pkg.id} onClick={() => pickPackage(pkg)}
                className="text-left rounded-2xl p-5 transition-all active:scale-[0.98] hover:shadow-lg"
                style={{
                  background: 'var(--color-surface)',
                  border: `2px solid ${selectedPkg?.id === pkg.id ? '#7C3AED' : 'var(--color-border)'}`,
                }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold">{pkg.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                      {PLACEMENT_LABELS[pkg.placement]}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold" style={{ color: '#5B21B6' }}>
                      {formatTHB(pkg.price)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                      {pkg.durationDays} วัน
                    </p>
                  </div>
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--color-muted)', lineHeight: '1.6' }}>
                  {pkg.description}
                </p>
                <div className="flex items-center gap-2 text-xs font-semibold"
                  style={{ color: '#0284C7' }}>
                  <span>👁️ ~{pkg.impressionsEst.toLocaleString()} impressions/วัน</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ─── Step 2: Ad Creative Form ─── */}
      {step === 2 && selectedPkg && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep(1)}
              className="text-sm px-3 py-1.5 rounded-xl transition-all"
              style={{ background: 'var(--color-elevated)', color: 'var(--color-muted)' }}>
              ← กลับ
            </button>
            <div>
              <h2 className="text-xl font-bold">กรอกรายละเอียดโฆษณา</h2>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                แพ็กเกจ: <strong>{selectedPkg.name}</strong> — {formatTHB(selectedPkg.price)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ─── Form Left ─── */}
            <div className="space-y-4">
              <FormField label="หัวเรื่องโฆษณา *" hint="ชื่อที่ผู้ใช้จะเห็น">
                <input name="title" value={form.title} onChange={handleField}
                  placeholder="เช่น Young Robotics Camp 2027"
                  className="w-full px-4 py-2.5 rounded-xl text-sm transition-all"
                  style={{ background: 'var(--color-elevated)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
                  required />
              </FormField>

              <FormField label="คำอธิบายสั้น *" hint="แสดงใต้หัวเรื่อง ไม่เกิน 150 ตัวอักษร">
                <textarea name="description" value={form.description} onChange={handleField}
                  placeholder="แนะนำค่ายของคุณสั้นๆ ให้น่าสนใจ..."
                  rows={3} maxLength={150}
                  className="w-full px-4 py-2.5 rounded-xl text-sm resize-none transition-all"
                  style={{ background: 'var(--color-elevated)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
                />
                <p className="text-right text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                  {form.description.length}/150
                </p>
              </FormField>

              <FormField label="URL รูปภาพ" hint="รูปสัดส่วน 16:9 หรือ 4:3 ดีที่สุด (HTTPS)">
                <input name="imageUrl" value={form.imageUrl} onChange={handleField}
                  type="url" placeholder="https://..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm transition-all"
                  style={{ background: 'var(--color-elevated)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
                />
              </FormField>

              <FormField label="URL ปลายทาง *" hint="ลิงก์ที่ผู้ใช้จะไปเมื่อคลิก">
                <input name="targetUrl" value={form.targetUrl} onChange={handleField}
                  type="url" placeholder="https://yourcamp.ac.th/apply"
                  className="w-full px-4 py-2.5 rounded-xl text-sm transition-all"
                  style={{ background: 'var(--color-elevated)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
                  required />
              </FormField>

              <FormField label="ข้อความปุ่ม CTA" hint="ปุ่มที่แสดงบนโฆษณา">
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {['สมัครเลย', 'ดูรายละเอียด', 'ลงทะเบียน'].map(t => (
                    <button key={t} type="button"
                      onClick={() => setForm(f => ({ ...f, ctaText: t }))}
                      className="py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: form.ctaText === t ? '#5B21B6' : 'var(--color-elevated)',
                        color: form.ctaText === t ? 'white' : 'var(--color-muted)',
                        border: `1.5px solid ${form.ctaText === t ? '#5B21B6' : 'var(--color-border)'}`,
                      }}>
                      {t}
                    </button>
                  ))}
                </div>
                <input name="ctaText" value={form.ctaText} onChange={handleField}
                  placeholder="หรือพิมพ์เอง..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm transition-all"
                  style={{ background: 'var(--color-elevated)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="วันเริ่มแสดง *">
                  <input name="startDate" value={form.startDate} onChange={handleField}
                    type="date"
                    className="w-full px-4 py-2.5 rounded-xl text-sm transition-all"
                    style={{ background: 'var(--color-elevated)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
                  />
                </FormField>
                <FormField label="วันสิ้นสุด *">
                  <input name="endDate" value={form.endDate} onChange={handleField}
                    type="date"
                    className="w-full px-4 py-2.5 rounded-xl text-sm transition-all"
                    style={{ background: 'var(--color-elevated)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
                  />
                </FormField>
              </div>
            </div>

            {/* ─── Ad Preview ─── */}
            <div className="space-y-4">
              <p className="text-sm font-semibold">👁️ ตัวอย่างโฆษณา</p>

              {/* Feed Featured Preview */}
              {selectedPkg.placement === 'feed_featured' && (
                <div className="rounded-2xl overflow-hidden"
                  style={{ border: '2px solid #7C3AED', boxShadow: '0 8px 32px rgba(91,33,182,0.2)' }}>
                  <div className="relative h-36 bg-gray-200">
                    {form.imageUrl ? (
                      <img src={form.imageUrl} alt="" className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl"
                        style={{ background: 'linear-gradient(135deg,#EDE9FE,#DDD6FE)' }}>🖼️</div>
                    )}
                    <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full text-white font-bold"
                      style={{ background: 'rgba(91,33,182,0.9)' }}>📢 โฆษณา</span>
                  </div>
                  <div className="p-4" style={{ background: 'var(--color-surface)' }}>
                    <p className="font-bold text-sm">{form.title || 'หัวเรื่องโฆษณา'}</p>
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-muted)' }}>
                      {form.description || 'คำอธิบายสั้นๆ เกี่ยวกับค่าย/โปรโมชั่นของคุณ'}
                    </p>
                    <button className="mt-3 w-full py-2 rounded-xl text-sm font-bold text-white transition-all"
                      style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)' }}>
                      {form.ctaText || 'สมัครเลย'} →
                    </button>
                  </div>
                </div>
              )}

              {/* Explore Banner Preview */}
              {selectedPkg.placement === 'explore_banner' && (
                <div className="rounded-2xl p-4 flex items-center gap-4"
                  style={{ border: '2px solid #7C3AED', background: 'linear-gradient(135deg,#EDE9FE,#DDD6FE)', boxShadow: '0 8px 32px rgba(91,33,182,0.2)' }}>
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-white/50">
                    {form.imageUrl
                      ? <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl">🖼️</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm" style={{ color: '#4C1D95' }}>
                      {form.title || 'หัวเรื่องโฆษณา'}
                    </p>
                    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#5B21B6' }}>
                      {form.description || 'คำอธิบาย...'}
                    </p>
                  </div>
                  <button className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                    style={{ background: '#5B21B6' }}>
                    {form.ctaText || 'สมัคร'}
                  </button>
                </div>
              )}

              {/* Checklist CTA Preview */}
              {selectedPkg.placement === 'checklist_cta' && (
                <div className="rounded-2xl p-5"
                  style={{ border: '2px solid #7C3AED', background: 'linear-gradient(135deg,#FEF3C7,#FDE68A)', boxShadow: '0 8px 32px rgba(251,191,36,0.2)' }}>
                  <p className="text-[10px] font-bold mb-2" style={{ color: '#92400E' }}>🎯 แนะนำสำหรับพอร์ตฟอลิโอของคุณ</p>
                  <p className="font-bold text-sm" style={{ color: '#78350F' }}>
                    {form.title || 'หัวเรื่องโฆษณา'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#92400E' }}>
                    {form.description || 'คำอธิบาย...'}
                  </p>
                  <button className="mt-3 w-full py-2 rounded-xl text-sm font-bold"
                    style={{ background: '#D97706', color: 'white' }}>
                    {form.ctaText || 'สมัครเลย'} →
                  </button>
                </div>
              )}

              {/* Sidebar Preview */}
              {selectedPkg.placement === 'sidebar_right' && (
                <div className="rounded-2xl overflow-hidden"
                  style={{ border: '2px solid #7C3AED', boxShadow: '0 8px 32px rgba(91,33,182,0.2)' }}>
                  <div className="h-24 bg-gray-200 relative">
                    {form.imageUrl
                      ? <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-3xl"
                          style={{ background: '#EDE9FE' }}>🖼️</div>}
                  </div>
                  <div className="p-3" style={{ background: 'var(--color-surface)' }}>
                    <p className="font-bold text-xs">{form.title || 'หัวเรื่อง'}</p>
                    <button className="mt-2 w-full py-1.5 rounded-lg text-xs font-bold text-white"
                      style={{ background: '#7C3AED' }}>
                      {form.ctaText || 'สมัครเลย'}
                    </button>
                  </div>
                </div>
              )}

              {/* Cost Summary */}
              <div className="rounded-2xl p-4 space-y-2"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <p className="text-sm font-bold">💳 สรุปการสั่งซื้อ</p>
                {[
                  ['แพ็กเกจ', selectedPkg.name],
                  ['ตำแหน่ง', PLACEMENT_LABELS[selectedPkg.placement]],
                  ['ระยะเวลา', `${selectedPkg.durationDays} วัน`],
                  ['ประมาณ Impressions', `${(selectedPkg.impressionsEst * selectedPkg.durationDays).toLocaleString()} ครั้ง`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span style={{ color: 'var(--color-muted)' }}>{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between"
                  style={{ borderColor: 'var(--color-border)' }}>
                  <span className="font-bold">ราคารวม (ยังไม่รวม VAT)</span>
                  <span className="font-bold text-lg" style={{ color: '#5B21B6' }}>
                    {formatTHB(selectedPkg.price)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Error */}
          {submitError && (
            <div className="px-4 py-3 rounded-xl text-sm font-medium"
              style={{ background: '#FEE2E2', color: '#DC2626' }}>
              ⚠️ {submitError}
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end">
            <button onClick={handleSubmit} disabled={!isFormValid || submitting}
              className="flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', boxShadow: '0 4px 12px rgba(91,33,182,0.35)' }}>
              {submitting
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />กำลังส่ง...</>
                : <>📢 ส่งโฆษณาให้ Admin Review →</>
              }
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-1.5">{label}</label>
      {hint && <p className="text-xs mb-1.5" style={{ color: 'var(--color-muted)' }}>{hint}</p>}
      {children}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV_ITEMS: { tab: Tab; icon: string; label: string }[] = [
  { tab: 'overview', icon: '📊', label: 'ภาพรวม' },
  { tab: 'my-ads',   icon: '📢', label: 'โฆษณาของฉัน' },
  { tab: 'buy-ads',  icon: '➕', label: 'ซื้อพื้นที่โฆษณา' },
];

// ─── Main Dashboard ───────────────────────────────────────────────────────────

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
    updatedAt: new Date()
  };
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [ads, setAds] = useState<AdListing[]>([]);
  const [loadingAds, setLoadingAds] = useState(false);
  const [dark, setDark] = useState(false);

  const loadAds = useCallback(async () => {
    try {
      const fetched = await fetchOrganizerAds(profile.id);
      setAds(fetched);
    } catch {
      setAds([]);
    } finally {
      setLoadingAds(false);
    }
  }, [profile.id]);

  useEffect(() => { loadAds(); }, [loadAds]);

  const handleDelete = async (adId: string) => {
    if (!confirm('ลบโฆษณานี้ใช่ไหม?')) return;
    try {
      await deleteAdListing(adId);
      setAds(prev => prev.filter(a => a.id !== adId));
    } catch {
      alert('ลบไม่สำเร็จ — ตรวจสอบ Firebase config');
    }
  };

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

  const handleResetAds = () => {
    localStorage.removeItem(`sp_local_ads_${profile.id}`);
    setAds([]);
  };

  const pendingCount = ads.filter(a => a.status === 'pending').length;

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
                style={{ background: '#DCFCE7', color: '#16A34A' }}>✅ Verified</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1" aria-label="Organizer menu">
          {NAV_ITEMS.map(({ tab, icon, label }) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left relative"
              aria-current={activeTab === tab ? 'page' : undefined}
              style={{
                background: activeTab === tab ? '#EDE9FE' : 'transparent',
                color: activeTab === tab ? '#5B21B6' : 'var(--color-muted)',
              }}>
              <span aria-hidden="true">{icon}</span>
              {label}
              {tab === 'my-ads' && pendingCount > 0 && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold text-white"
                  style={{ background: '#F59E0B' }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Dark Mode + Footer */}
        <div className="p-4" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button onClick={toggleDark}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors"
            style={{ color: 'var(--color-muted)' }}>
            <span>{dark ? '☀️' : '🌙'}</span>
            {dark ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={handleLogout} className="mt-2 w-full px-3 py-2 text-sm font-bold rounded-lg bg-red-100 text-red-600 transition-colors hover:bg-red-200">
            Logout
          </button>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
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
            <h1 className="font-bold text-base">
              {activeTab === 'overview'  && '📊 ภาพรวม'}
              {activeTab === 'my-ads'    && '📢 โฆษณาของฉัน'}
              {activeTab === 'buy-ads'   && '➕ ซื้อพื้นที่โฆษณา'}
            </h1>
          </div>
          {/* Mobile tab switcher */}
          <div className="flex lg:hidden gap-1 rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--color-border)', background: 'var(--color-elevated)' }}>
            {NAV_ITEMS.map(({ tab, icon }) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="px-3 py-1.5 text-sm relative transition-colors"
                style={{
                  background: activeTab === tab ? '#5B21B6' : 'transparent',
                  color: activeTab === tab ? 'white' : 'var(--color-muted)',
                }}>
                {icon}
                {tab === 'my-ads' && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] font-bold text-white flex items-center justify-center"
                    style={{ background: '#F59E0B' }}>{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'overview' && <OverviewTab ads={ads} profile={profile} />}
          {activeTab === 'my-ads'   && <MyAdsTab ads={ads} onDelete={handleDelete} loading={loadingAds} />}
          {activeTab === 'buy-ads'  && <BuyAdsTab onSuccess={() => { loadAds(); setActiveTab('my-ads'); }} profile={profile} />}
        </main>
      </div>

      {/* Dev Test Bar (Remove when project is finished) */}
      <DevTestBar onResetAds={handleResetAds} />
    </div>
  );
}
