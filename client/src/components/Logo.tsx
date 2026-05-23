interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 100, className }: LogoProps) {
  return (
    <img
      src="/logo.svg"
      alt="لمة العائلة"
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  );
}
