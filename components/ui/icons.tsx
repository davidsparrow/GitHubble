import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

/** Telescope on a tripod. */
export const TelescopeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m3.5 13.5 12.6-7.3 1.9 3.3-12.6 7.3z" />
    <path d="m16.1 6.2 2.6-1.5 1.9 3.3-2.6 1.5" />
    <path d="m10.5 13.8-3 6.7M11.5 13.2l3 7.3" />
  </Icon>
);

/** A spiral galaxy seen from above. */
export const GalaxyIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 12.8a.8.8 0 1 1 .8-.8" />
    <path d="M12.8 12a2.6 2.6 0 1 1-2.6-2.6" />
    <path d="M10.2 9.4a5 5 0 1 1-4.9 5.9" />
    <path d="M19.9 12.7A8 8 0 1 1 11.3 4" />
  </Icon>
);

export const ResetIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4.5V9h4.5" />
  </Icon>
);

export const ExternalIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 5h10v10" />
    <path d="M19 5 6 18" />
  </Icon>
);

/** Four-point star with diffraction spikes (also the logo mark). */
export const SparkleIcon = (props: IconProps) => (
  <Icon {...props} fill="currentColor" stroke="none">
    <path d="M12 2.5 13.2 10.8 21.5 12 13.2 13.2 12 21.5 10.8 13.2 2.5 12 10.8 10.8Z" />
  </Icon>
);

export const ArrowLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);

/** Corner brackets: frame the results. */
export const FrameIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 9V5h4M16 5h4v4M20 15v4h-4M8 19H4v-4" />
  </Icon>
);
