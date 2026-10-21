import type { ReactNode } from 'react';

function Icon({ size = 22, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const CalendarIcon = () => (
  <Icon><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></Icon>
);
export const ChartIcon = () => (
  <Icon><path d="M4 20V11M10 20V4M16 20v-7M2 20h20" /></Icon>
);
export const CheckCircleIcon = () => (
  <Icon><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></Icon>
);
export const ReportIcon = () => (
  <Icon><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></Icon>
);
export const BackIcon = () => (
  <Icon><path d="M15 5l-7 7 7 7" /></Icon>
);
export const ClockIcon = ({ size }: { size?: number }) => (
  <Icon size={size}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>
);
