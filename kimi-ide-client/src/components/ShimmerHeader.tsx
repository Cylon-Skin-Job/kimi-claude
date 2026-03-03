interface ShimmerHeaderProps {
  text?: string;
  icon?: 'lightbulb' | 'lens_blur';
  className?: string;
}

export function ShimmerHeader({ 
  text = 'Thinking', 
  icon = 'lightbulb',
  className = '' 
}: ShimmerHeaderProps) {
  return (
    <div 
      className={`shimmer-header ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        background: 'rgba(var(--theme-primary-rgb), 0.05)',
        borderRadius: '6px'
      }}
    >
      <span 
        className="material-symbols-outlined" 
        style={{ fontSize: '16px', color: 'var(--theme-primary)' }}
      >
        {icon}
      </span>
      <span className="shimmer-text" style={{ fontSize: '14px', fontWeight: 500 }}>
        {text}
      </span>
    </div>
  );
}
