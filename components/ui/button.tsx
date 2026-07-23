import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'outline';

type ButtonProps = {
  children: React.ReactNode;
  variant?: ButtonVariant;
  href?: string;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-primary text-white shadow-md hover:bg-accent-primary/90 focus-visible:ring-accent-primary',
  secondary:
    'bg-accent-secondary text-white shadow-md hover:bg-accent-secondary/90 focus-visible:ring-accent-secondary',
  outline:
    'border-2 border-accent-primary text-accent-primary hover:bg-accent-primary/5 focus-visible:ring-accent-primary',
};

const baseClasses =
  'inline-flex items-center justify-center rounded-md px-6 py-3 text-base font-medium transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg';

export function Button({
  children,
  variant = 'primary',
  href,
  className,
  onClick,
  disabled,
  ...props
}: ButtonProps) {
  const classes = cn(
    baseClasses,
    variantClasses[variant],
    disabled && 'pointer-events-none opacity-50',
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
