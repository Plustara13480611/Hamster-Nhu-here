
interface SwiftPortLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
  className?: string;
}

export default function SwiftPortLogo({
  size = 'md',
  showText = true,
  subtitle,
  className = '',
}: SwiftPortLogoProps) {
  const sizeMap = {
    xs: {
      img: 'w-7 h-7 rounded-lg',
      title: 'text-sm font-bold',
      sub: 'text-[9px]',
      gap: 'gap-2',
    },
    sm: {
      img: 'w-9 h-9 rounded-xl',
      title: 'text-base font-extrabold',
      sub: 'text-[10px]',
      gap: 'gap-2.5',
    },
    md: {
      img: 'w-11 h-11 rounded-xl',
      title: 'text-lg font-extrabold',
      sub: 'text-xs',
      gap: 'gap-3',
    },
    lg: {
      img: 'w-16 h-16 rounded-2xl',
      title: 'text-2xl font-black',
      sub: 'text-xs',
      gap: 'gap-3.5',
    },
    xl: {
      img: 'w-20 h-20 rounded-3xl',
      title: 'text-3xl font-black',
      sub: 'text-sm',
      gap: 'gap-4',
    },
  };

  const current = sizeMap[size];

  return (
    <div className={`flex items-center ${current.gap} ${className}`}>
      {/* Logo Card Image with Theme-Harmonized Frame */}
      <div className="relative flex-shrink-0 group">
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 opacity-20 dark:opacity-40 blur-[3px] group-hover:opacity-50 transition-opacity" />
        <div 
          className={`relative ${current.img} overflow-hidden shadow-sm border border-purple-500/20 dark:border-purple-400/30 transition-transform duration-200 group-hover:scale-105 flex items-center justify-center`}
          style={{ background: 'var(--color-surface)' }}
        >
          <img
            src="/logo.png"
            alt="Swift Port Logo"
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {showText && (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1
              className={`${current.title} tracking-tight leading-none`}
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              <span style={{ color: 'var(--color-text)' }}>Swift</span>{' '}
              <span className="text-purple-600 dark:text-purple-400">Port</span>
            </h1>
          </div>
          {subtitle && (
            <p className={`${current.sub} mt-0.5 truncate leading-tight`} style={{ color: 'var(--color-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
