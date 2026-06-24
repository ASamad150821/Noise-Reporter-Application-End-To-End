import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
  children: ReactNode;
};

export default function Button({ variant = 'primary', className = '', disabled, children, ...rest} : ButtonProps) {

    const base =
    'px-4 py-2 rounded font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';

    const styles =
    variant === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700'
      : 'bg-gray-200 text-gray-800 hover:bg-gray-300';

    return (
    <button className={`${base} ${styles} ${className}`} {...rest}>
      {children}
    </button>
    )
}