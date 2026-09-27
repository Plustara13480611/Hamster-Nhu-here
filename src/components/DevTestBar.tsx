import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface DevTestBarProps {
  onUndoSwipe?: () => void;
  onResetSwipes?: () => void;
  onResetQuests?: () => void;
  onResetAds?: () => void;
  canUndo?: boolean;
}

export default function DevTestBar({
  onUndoSwipe,
  onResetSwipes,
  onResetQuests,
  onResetAds,
  canUndo = false,
}: DevTestBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleResetAll = () => {
    if (!confirm('ต้องการล้างข้อมูลทดสอบทั้งหมด (Swipe History, Quests, Ads) เพื่อเริ่มทดสอบใหม่ใช่หรือไม่?')) return;
    
    // Clear all test keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sp_local_') || key === 'sp_demo_user')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    showToast('💥 ล้างข้อมูลทดสอบทั้งหมดเรียบร้อยแล้ว กำลังโหลดหน้าใหม่...');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  return (
    <>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl text-xs font-bold text-white shadow-2xl flex items-center gap-2 animate-bounce"
          style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.2)' }}>
          <span>🔔</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating Dev Test Widget (Bottom-Right) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 font-sans">
        {expanded && (
          <div 
            className="w-72 rounded-2xl p-4 shadow-2xl backdrop-blur-lg border transition-all animate-in fade-in slide-in-from-bottom-4 duration-200"
            style={{ 
              background: 'color-mix(in srgb, var(--color-surface) 90%, transparent)', 
              borderColor: 'var(--color-border)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
            }}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                <span>🧪</span>
                <span>ปุ่มทดสอบระบบ (Dev Tools)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-mono">
                {profile?.role === 'organizer' ? 'ผู้จัดค่าย' : 'นักเรียน'}
              </span>
            </div>

            <p className="text-[11px] mb-3 text-slate-500 dark:text-slate-400">
              ใช้สำหรับรีเซ็ตหรือย้อนกลับข้อมูลในระหว่างทดสอบหลายๆ รอบ (ลบออกได้เมื่องานเสร็จ)
            </p>

            <div className="space-y-2">
              {/* Undo Last Swipe */}
              {onUndoSwipe && (
                <button
                  type="button"
                  onClick={() => { onUndoSwipe(); showToast('↩️ ย้อนกลับการ์ดล่าสุดแล้ว'); }}
                  disabled={!canUndo}
                  className="w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all border active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                >
                  <span className="flex items-center gap-2">
                    <span>↩️</span>
                    <span>ย้อนกลับการ์ดล่าสุด</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Undo</span>
                </button>
              )}

              {/* Reset Swipes */}
              {onResetSwipes && (
                <button
                  type="button"
                  onClick={() => { onResetSwipes(); showToast('🔄 รีเซ็ตค่ายทั้งหมดพร้อมปัดใหม่!'); }}
                  className="w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all border active:scale-95 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-500/30"
                >
                  <span className="flex items-center gap-2">
                    <span>🔄</span>
                    <span>รีเซ็ตการปัด (ให้ค่ายกลับมาครบ)</span>
                  </span>
                </button>
              )}

              {/* Reset Quests */}
              {onResetQuests && (
                <button
                  type="button"
                  onClick={() => { onResetQuests(); showToast('📋 รีเซ็ตเควสต์กลับเป็น 0% แล้ว!'); }}
                  className="w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all border active:scale-95 cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/30 text-purple-600 dark:text-purple-400 border-purple-500/30"
                >
                  <span className="flex items-center gap-2">
                    <span>📋</span>
                    <span>รีเซ็ตเควสต์พอร์ตฟอลิโอ</span>
                  </span>
                </button>
              )}

              {/* Reset Organizer Ads */}
              {onResetAds && (
                <button
                  type="button"
                  onClick={() => { onResetAds(); showToast('🗑️ ล้างโฆษณาทดสอบทั้งหมดแล้ว'); }}
                  className="w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all border active:scale-95 cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-950/30 text-sky-600 dark:text-sky-400 border-sky-500/30"
                >
                  <span className="flex items-center gap-2">
                    <span>🗑️</span>
                    <span>ล้างรายการโฆษณาที่สร้าง</span>
                  </span>
                </button>
              )}

              {/* Reset All */}
              <button
                type="button"
                onClick={handleResetAll}
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all border active:scale-95 cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-500/30"
              >
                <span className="flex items-center gap-2">
                  <span>💥</span>
                  <span>ล้างข้อมูลทดสอบทั้งหมด</span>
                </span>
                <span className="text-[10px] text-rose-400">Reset All</span>
              </button>

              {/* Quick Switch Role */}
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all border active:scale-95 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span className="flex items-center gap-2">
                  <span>🚪</span>
                  <span>ออกจากระบบ / สลับบทบาท</span>
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Toggle Button */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-xs shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
          style={{ 
            background: expanded ? 'var(--color-surface)' : 'linear-gradient(135deg, #F59E0B, #D97706)', 
            color: expanded ? 'var(--color-text)' : '#FFFFFF',
            border: '2px solid rgba(245,158,11,0.4)',
            boxShadow: '0 8px 24px rgba(245,158,11,0.35)'
          }}
        >
          <span>{expanded ? '✕ ปิด' : '🧪 ปุ่มทดสอบระบบ (ย้อนกลับข้อมูล)'}</span>
          {!expanded && canUndo && (
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          )}
        </button>
      </div>
    </>
  );
}
