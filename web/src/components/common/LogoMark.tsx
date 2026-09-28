interface LogoMarkProps {
  className?: string;
  title?: string;
}

export function LogoMark({ className, title }: LogoMarkProps) {
  return (
    <img
      src="/orgchai-logo.png"
      className={className}
      alt={title || ''}
      aria-hidden={title ? undefined : true}
      width="64"
      height="64"
    />
  );
}
