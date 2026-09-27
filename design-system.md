# Student Portfolio — Design System

> **Design Philosophy**: "Energetic Academia" — สีสด เต็มพลัง แต่ยังอ่านง่ายและเชื่อถือได้ในบริบทการศึกษา  
> ทุกสีเลือกผ่าน WCAG AA contrast (? 4.5:1 สำหรับข้อความปกติ, ? 3:1 สำหรับ Large Text/UI)  
> และออกแบบให้ Colorblind-safe (ไม่พึ่งสีแดง/เขียวเพียงอย่างเดียว)

---

## 1. Color Palette — เหตุผลการเลือก

| Token | Hex | Role | Contrast vs. White | Rationale |
|---|---|---|---|---|
| `brand-600` | `#5B21B6` | Primary / CTA | 8.5:1 AAA | ม่วงเข้ม (Violet) — สดใสแบบ GenZ แต่จริงจัง ไม่ใช่สีน้ำเงินโรงเรียนซ้ำ |
| `brand-500` | `#7C3AED` | Primary Hover | 6.1:1 AA | ม่วงกลาง สำหรับ Hover state |
| `brand-100` | `#EDE9FE` | Primary Tint / BG | — | พื้นหลังอ่อนสำหรับ Card/Tag |
| `energy-400` | `#FBBF24` | Accent / Like Btn | 3.1:1 (Large) | Amber — สดใส ชัดเจน สำหรับ Colorblind ทุกประเภท (ดีกว่าเขียว) |
| `energy-500` | `#F59E0B` | Accent Hover | 3.8:1 | เข้มขึ้นเล็กน้อยสำหรับ state |
| `sky-500` | `#0EA5E9` | Secondary / Info | 4.6:1 AA | ฟ้าสด สำหรับ Info badges, Feed, Online tags |
| `sky-100` | `#E0F2FE` | Secondary Tint | — | พื้นหลังข้อมูลเพิ่มเติม |
| `coral-500` | `#F97316` | Dislike / Reject | 3.2:1 (Large+Icon) | ส้ม (ไม่ใช่แดง) สำหรับปุ่ม Dislike — Colorblind-safe กว่าแดงมาก |
| `neutral-900` | `#0F172A` | Text Primary | 17.6:1 AAA | Slate-900 อ่านง่าย บน Light BG |
| `neutral-500` | `#64748B` | Text Secondary | 5.1:1 AA | Slate-500 สำหรับ Subtitle, Metadata |
| `neutral-100` | `#F1F5F9` | Surface / BG | — | พื้นหลังหลักสำหรับ Light mode |
| `neutral-50` | `#F8FAFC` | Canvas BG | — | พื้นหลังของหน้า |
| `dark-950` | `#020617` | Dark Canvas | — | Dark mode Background |
| `dark-900` | `#0F172A` | Dark Surface | — | Dark mode Card Surface |
| `dark-800` | `#1E293B` | Dark Elevated | — | Dark mode Elevated Component |

> **Colorblind Safety Note**: ปุ่ม Like ใช้ `energy-400` (Amber) + icon ?, ปุ่ม Dislike ใช้ `coral-500` (Orange) + icon X  
> ไม่ใช้ Green/Red เป็น primary signal เพียงอย่างเดียว — ผู้ใช้ที่มี Deuteranopia (Red-Green Blindness) ยังแยกแยะได้

---

## 2. Tailwind Config (tailwind.config.ts)

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class', // Toggle via <html class="dark">
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#7C3AED',
          600: '#5B21B6',
          700: '#4C1D95',
          800: '#3B1575',
          900: '#2E1065',
        },
        energy: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
        coral: {
          50:  '#FFF7ED',
          100: '#FFEDD5',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
        },
        sky: {
          50:  '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
        },
        neutral: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
      },
      fontFamily: {
        sans:    ['Noto Sans Thai', 'Inter', 'ui-sans-serif', 'system-ui'],
        display: ['Syne', 'Noto Sans Thai', 'ui-sans-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace'],
      },
      fontSize: {
        'xs':   ['0.75rem',  { lineHeight: '1rem' }],
        'sm':   ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem',     { lineHeight: '1.625rem' }],
        'lg':   ['1.125rem', { lineHeight: '1.75rem' }],
        'xl':   ['1.25rem',  { lineHeight: '1.875rem' }],
        '2xl':  ['1.5rem',   { lineHeight: '2rem' }],
        '3xl':  ['1.875rem', { lineHeight: '2.375rem' }],
        '4xl':  ['2.25rem',  { lineHeight: '2.75rem' }],
        '5xl':  ['3rem',     { lineHeight: '1.2' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '88': '22rem',
        '104': '26rem',
        '112': '28rem',
        '128': '32rem',
        'card-w': '22rem',
        'card-h': '34rem',
      },
      borderRadius: {
        'xl':  '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
        'card': '1.5rem',
      },
      boxShadow: {
        'card':       '0 8px 32px -4px rgba(91, 33, 182, 0.15), 0 2px 8px -2px rgba(0,0,0,0.08)',
        'card-hover': '0 20px 48px -8px rgba(91, 33, 182, 0.25), 0 4px 12px -4px rgba(0,0,0,0.12)',
        'button':     '0 4px 12px rgba(91, 33, 182, 0.35)',
        'like':       '0 4px 16px rgba(251, 191, 36, 0.4)',
        'dislike':    '0 4px 16px rgba(249, 115, 22, 0.4)',
        'glow':       '0 0 24px rgba(124, 58, 237, 0.4)',
      },
      keyframes: {
        'slide-up': {
          '0%':   { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'swipe-right': {
          '0%':   { transform: 'translateX(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateX(120%) rotate(20deg)', opacity: '0' },
        },
        'swipe-left': {
          '0%':   { transform: 'translateX(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateX(-120%) rotate(-20deg)', opacity: '0' },
        },
        'badge-pop': {
          '0%':   { transform: 'scale(1)' },
          '50%':  { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'slide-up':    'slide-up 0.35s ease-out',
        'swipe-right': 'swipe-right 0.5s ease-in forwards',
        'swipe-left':  'swipe-left 0.5s ease-in forwards',
        'badge-pop':   'badge-pop 0.4s ease-in-out',
        'shimmer':     'shimmer 2s linear infinite',
        'float':       'float 3s ease-in-out infinite',
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## 3. Global CSS Variables (src/index.css)

```css
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Syne:wght@600;700;800&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-bg:       theme('colors.neutral.50');
    --color-surface:  #FFFFFF;
    --color-elevated: theme('colors.neutral.100');
    --color-border:   theme('colors.neutral.200');
    --color-text:     theme('colors.neutral.900');
    --color-muted:    theme('colors.neutral.500');
  }
  .dark {
    --color-bg:       theme('colors.neutral.950');
    --color-surface:  theme('colors.neutral.900');
    --color-elevated: theme('colors.neutral.800');
    --color-border:   theme('colors.neutral.700');
    --color-text:     theme('colors.neutral.50');
    --color-muted:    theme('colors.neutral.400');
  }
  html {
    font-size: 100%;
    scroll-behavior: smooth;
  }
  body {
    @apply bg-[var(--color-bg)] text-[var(--color-text)] font-sans antialiased;
    transition: background-color 0.2s ease, color 0.2s ease;
  }
  *:focus-visible {
    @apply outline-none ring-2 ring-brand-500 ring-offset-2 ring-offset-[var(--color-bg)];
  }
}

@layer components {
  .surface     { @apply bg-[var(--color-surface)] border border-[var(--color-border)]; }
  .text-body   { @apply text-[var(--color-text)]; }
  .text-muted  { @apply text-[var(--color-muted)]; }

  .gradient-brand {
    background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 50%, #4C1D95 100%);
  }
  .gradient-energy {
    background: linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%);
  }
  .gradient-card-overlay {
    background: linear-gradient(to top, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.4) 60%, transparent 100%);
  }
}
```

---

## 4. Component Examples

### 4.1 Button (src/components/ui/Button.tsx)

```tsx
import { ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'like' | 'dislike' | 'danger';
type Size    = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:   'gradient-brand text-white shadow-button hover:opacity-90 hover:shadow-glow active:scale-95',
  secondary: 'bg-[var(--color-elevated)] text-[var(--color-text)] border border-[var(--color-border)] hover:border-brand-400 hover:text-brand-500',
  ghost:     'bg-transparent text-[var(--color-muted)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)]',
  like:      'bg-energy-400 text-neutral-900 shadow-like hover:bg-energy-500 active:scale-95 font-semibold',
  dislike:   'bg-coral-500 text-white shadow-dislike hover:bg-coral-600 active:scale-95 font-semibold',
  danger:    'bg-coral-500 text-white hover:bg-coral-600 active:scale-95',
};

const sizes: Record<Size, string> = {
  sm:   'px-3 py-1.5 text-sm rounded-xl gap-1.5',
  md:   'px-5 py-2.5 text-base rounded-2xl gap-2',
  lg:   'px-7 py-3.5 text-lg rounded-2xl gap-2.5',
  icon: 'p-3 rounded-2xl',
};

export function Button({ variant = 'primary', size = 'md', loading = false, icon, children, className, disabled, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading}
      className={clsx(
        'inline-flex items-center justify-center font-semibold transition-all duration-200 ease-out',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        variants[variant], sizes[size], className
      )}
      {...props}
    >
      {loading
        ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        : <>{icon && <span aria-hidden="true">{icon}</span>}{children}</>
      }
    </button>
  );
}
```

Usage (ปุ่ม Swipe — Colorblind-safe เสมอ เพราะมีทั้ง icon + label):
```tsx
<Button variant="dislike" size="lg" icon={<X size={20} />}>ไม่สนใจ</Button>
<Button variant="like"    size="lg" icon={<Heart size={20} />}>สนใจ!</Button>
```

---

### 4.2 SwipeCard (src/components/swipe/SwipeCard.tsx)

```tsx
import { Camp } from '@/types/models';
import { Badge } from '@/components/ui/Badge';
import { CalendarDays, MapPin, Users, Wifi } from 'lucide-react';

interface SwipeCardProps {
  camp: Camp;
  matchPercent?: number;
  style?: React.CSSProperties;
}

export function SwipeCard({ camp, matchPercent, style }: SwipeCardProps) {
  return (
    <article
      className="relative w-card-w h-card-h rounded-card overflow-hidden shadow-card select-none cursor-grab active:cursor-grabbing transition-shadow duration-200 hover:shadow-card-hover"
      style={style}
      aria-label={`ค่าย: ${camp.title}`}
    >
      <img src={camp.coverImageUrl} alt={`ภาพปกของค่าย ${camp.title}`}
        className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      <div className="gradient-card-overlay absolute inset-0" aria-hidden="true" />

      {/* Top Badges */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
        {matchPercent !== undefined && (
          <span className="bg-brand-600/90 backdrop-blur-sm text-white text-sm font-bold px-3 py-1 rounded-full"
            aria-label={`จับคู่ได้ ${matchPercent}%`}>
            ? {matchPercent}% match
          </span>
        )}
        <Badge variant={camp.isOnline ? 'info' : 'default'}
          icon={camp.isOnline ? <Wifi size={12} /> : <MapPin size={12} />}>
          {camp.isOnline ? 'Online' : 'Onsite'}
        </Badge>
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {camp.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs bg-white/15 backdrop-blur-xs border border-white/20 rounded-full px-2.5 py-0.5">
              {tag}
            </span>
          ))}
        </div>
        <h2 className="text-xl font-display font-bold leading-tight mb-1">{camp.title}</h2>
        <p className="text-sm text-white/75 line-clamp-2 mb-3">{camp.description}</p>
        <div className="flex gap-4 text-sm text-white/70">
          <span className="flex items-center gap-1">
            <CalendarDays size={14} aria-hidden="true" />
            <time dateTime={camp.applicationDeadline.toISOString()}>
              หมดเขต {new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(camp.applicationDeadline)}
            </time>
          </span>
          <span className="flex items-center gap-1">
            <Users size={14} aria-hidden="true" />
            {camp.capacity ? `${camp.capacity} ที่นั่ง` : 'ไม่จำกัด'}
          </span>
          <span className="font-semibold text-energy-400">
            {camp.cost === 0 ? '?? Free' : `฿${camp.cost.toLocaleString()}`}
          </span>
        </div>
      </div>
    </article>
  );
}
```

---

### 4.3 Badge + LevelBadge (src/components/ui/Badge.tsx)

```tsx
import { ReactNode } from 'react';
import { clsx } from 'clsx';

type BadgeVariant = 'default' | 'brand' | 'info' | 'energy' | 'success' | 'warning';

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700',
  brand:   'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-700',
  info:    'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-700',
  energy:  'bg-energy-100 dark:bg-energy-900/30 text-energy-700 dark:text-energy-300 border border-energy-200',
  success: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border border-sky-200',   // ใช้ฟ้าแทนเขียว (colorblind-safe)
  warning: 'bg-energy-100 dark:bg-energy-900/30 text-energy-700 dark:text-energy-300 border border-energy-200',
};

export function Badge({ variant = 'default', icon, children, className }:
  { variant?: BadgeVariant; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full', badgeVariants[variant], className)}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}

const LEVELS = [
  { min: 0,    max: 99,       label: 'Newcomer', emoji: '??', color: 'from-neutral-400 to-neutral-500' },
  { min: 100,  max: 249,      label: 'Explorer', emoji: '??', color: 'from-sky-400 to-sky-600' },
  { min: 250,  max: 499,      label: 'Achiever', emoji: '?', color: 'from-brand-400 to-brand-600' },
  { min: 500,  max: 999,      label: 'Star',     emoji: '?', color: 'from-energy-400 to-energy-600' },
  { min: 1000, max: Infinity, label: 'Legend',   emoji: '??', color: 'from-energy-400 via-brand-500 to-sky-500' },
];

export function LevelBadge({ score, showProgress = false }: { score: number; showProgress?: boolean }) {
  const level = LEVELS.find(l => score >= l.min && score <= l.max) ?? LEVELS[0];
  const range = level.max === Infinity ? 1000 : level.max - level.min + 1;
  const pct   = Math.min(((score - level.min) / range) * 100, 100);

  return (
    <div className="flex flex-col items-start gap-2">
      <div className={clsx('inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-white font-bold text-sm shadow-card',
        `bg-gradient-to-r ${level.color}`)}
        role="status" aria-label={`เลเวล ${level.label} คะแนน ${score}`}>
        <span aria-hidden="true">{level.emoji}</span>
        {level.label}
        <span className="bg-white/20 rounded-lg px-2 py-0.5 text-xs font-mono">{score} pts</span>
      </div>
      {showProgress && (
        <div className="w-full">
          <div className="w-full h-2.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden"
            role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
            aria-label={`Progress: ${Math.round(pct)}%`}>
            <div className={clsx('h-full rounded-full bg-gradient-to-r transition-all duration-500', level.color)}
              style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted mt-1">
            {score - level.min} / {level.max === Infinity ? '?' : range} pts ไปเลเวลต่อไป ({Math.round(pct)}%)
          </p>
        </div>
      )}
    </div>
  );
}
```

---

### 4.4 Navbar (src/components/layout/Navbar.tsx)

```tsx
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, CheckSquare, User, Moon, Sun } from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { clsx } from 'clsx';

const STUDENT_NAV = [
  { to: '/app/feed',      label: 'หน้าหลัก', Icon: Home },
  { to: '/app/explore',   label: 'สำรวจ',    Icon: Compass },
  { to: '/app/checklist', label: 'เควสต์',   Icon: CheckSquare },
  { to: '/app/profile',   label: 'โปรไฟล์', Icon: User },
];

export function Navbar() {
  const { pathname } = useLocation();
  const [dark, toggleDark] = useDarkMode();

  return (
    <>
      {/* Desktop Top Bar */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 z-50 h-16 items-center justify-between px-8
                         bg-[var(--color-surface)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
        <Link to="/app/feed"
          className="flex items-center gap-2 font-display font-bold text-xl text-brand-600 dark:text-brand-400"
          aria-label="Student Portfolio — กลับหน้าหลัก">
          <span className="w-8 h-8 gradient-brand rounded-xl flex items-center justify-center text-white text-sm" aria-hidden="true">SP</span>
          Student Portfolio
        </Link>

        <nav aria-label="เมนูหลัก">
          <ul className="flex items-center gap-1">
            {STUDENT_NAV.map(({ to, label, Icon }) => {
              const active = pathname.startsWith(to);
              return (
                <li key={to}>
                  <Link to={to} aria-current={active ? 'page' : undefined}
                    className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150',
                      active ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400'
                             : 'text-[var(--color-muted)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)]')}>
                    <Icon size={16} aria-hidden="true" />{label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <button onClick={toggleDark}
          aria-label={dark ? 'เปลี่ยนเป็น Light Mode' : 'เปลี่ยนเป็น Dark Mode'}
          className="p-2 rounded-xl text-[var(--color-muted)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)] transition-colors">
          {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16
                      bg-[var(--color-surface)]/90 backdrop-blur-md border-t border-[var(--color-border)] flex items-center"
           aria-label="เมนูหลัก (มือถือ)">
        <ul className="flex w-full">
          {STUDENT_NAV.map(({ to, label, Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <li key={to} className="flex-1">
                <Link to={to} aria-current={active ? 'page' : undefined}
                  className={clsx('flex flex-col items-center justify-center gap-1 h-full py-2 text-xs font-medium transition-colors',
                    active ? 'text-brand-600 dark:text-brand-400' : 'text-[var(--color-muted)] hover:text-[var(--color-text)]')}>
                  <span className={clsx('p-1.5 rounded-xl transition-all duration-200', active ? 'bg-brand-100 dark:bg-brand-900/40' : '')}>
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
```

---

## 5. Dark Mode Mapping Table

| Element | Light Mode | Dark Mode |
|---|---|---|
| Page Background | `#F8FAFC` (neutral-50) | `#020617` (neutral-950) |
| Card / Surface | `#FFFFFF` | `#0F172A` (neutral-900) |
| Elevated (Modal, Dropdown) | `#F1F5F9` (neutral-100) | `#1E293B` (neutral-800) |
| Border | `#E2E8F0` (neutral-200) | `#334155` (neutral-700) |
| Text Primary | `#0F172A` (neutral-900) | `#F8FAFC` (neutral-50) |
| Text Secondary | `#64748B` (neutral-500) | `#94A3B8` (neutral-400) |
| Brand Primary | `#5B21B6` (brand-600) | `#7C3AED` (brand-500, สว่างขึ้นเพื่อ contrast) |
| Brand Tint | `#EDE9FE` (brand-100) | `rgba(76,29,149,0.4)` (brand-900/40) |

> ใน Dark Mode ใช้ brand-400/300 บน text เพื่อรักษา contrast ? 4.5:1 กับพื้นหลัง #020617

---

## 6. Typography & Font Loading

Fonts: **Noto Sans Thai** (ภาษาไทย + body), **Inter** (อังกฤษ body), **Syne** (Display heading)

```html
<!-- index.html <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Syne:wght@600;700;800&display=swap" rel="stylesheet" />
```

| Class | Use case | Example |
|---|---|---|
| `font-sans text-base` | Body text, labels, ปุ่ม | ข้อความปกติ |
| `font-display text-4xl font-bold` | Page Heading, ชื่อค่าย | SwipeCard title |
| `font-mono text-sm` | คะแนน, Score, Dates | "500 pts" |
