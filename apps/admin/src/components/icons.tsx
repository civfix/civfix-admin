export interface IconProps {
  size?: number
  fill?: string
  stroke?: string
  /** Stroke width. */
  sw?: number
  className?: string
}

interface BaseIconProps extends IconProps {
  d?: string
  paths?: string[]
}

function Icon({
  d,
  size = 16,
  fill = "none",
  stroke = "currentColor",
  sw = 1.75,
  paths,
  className,
}: BaseIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths ? paths.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  )
}

export type IconComponent = (props: IconProps) => React.ReactElement

// A plain literal with `satisfies`, not `Record<string, IconComponent>`, so every known key stays
// non-optional under `noUncheckedIndexedAccess`.
export const Icons = {
  Pin: (p) => (
    <Icon
      {...p}
      d="M12 22s-7-7.5-7-13a7 7 0 1 1 14 0c0 5.5-7 13-7 13z M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
    />
  ),
  Map: (p) => <Icon {...p} paths={["M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z", "M9 4v16", "M15 6v16"]} />,
  Layers: (p) => (
    <Icon {...p} paths={["M12 3l9 5-9 5-9-5z", "M3 13l9 5 9-5", "M3 18l9 5 9-5"]} />
  ),
  Shield: (p) => <Icon {...p} d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z" />,
  Building: (p) => (
    <Icon
      {...p}
      paths={[
        "M3 21h18",
        "M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16",
        "M9 8h2 M13 8h2 M9 12h2 M13 12h2 M9 16h2 M13 16h2",
      ]}
    />
  ),
  Mail: (p) => (
    <Icon
      {...p}
      paths={["M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M2 7l10 6 10-6"]}
    />
  ),
  Users: (p) => (
    <Icon
      {...p}
      paths={[
        "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
        "M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
        "M22 21v-2a4 4 0 0 0-3-3.87",
        "M15 3.13a4 4 0 0 1 0 7.75",
      ]}
    />
  ),
  BarChart: (p) => (
    <Icon {...p} paths={["M3 3v18h18", "M7 16V10", "M11 16V6", "M15 16v-4", "M19 16V8"]} />
  ),
  Settings: (p) => (
    <Icon
      {...p}
      paths={[
        "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
        "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.36 16.98l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 4.36l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
      ]}
    />
  ),
  Inbox: (p) => (
    <Icon
      {...p}
      paths={[
        "M22 12h-6l-2 3h-4l-2-3H2",
        "M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
      ]}
    />
  ),
  Search: (p) => <Icon {...p} paths={["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.35-4.35"]} />,
  Plus: (p) => <Icon {...p} paths={["M12 5v14", "M5 12h14"]} />,
  Bell: (p) => (
    <Icon {...p} paths={["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"]} />
  ),
  Check: (p) => <Icon {...p} d="M20 6L9 17l-5-5" />,
  X: (p) => <Icon {...p} paths={["M18 6L6 18", "M6 6l12 12"]} />,
  ChevronRight: (p) => <Icon {...p} d="M9 18l6-6-6-6" />,
  ChevronLeft: (p) => <Icon {...p} d="M15 18l-6-6 6-6" />,
  ChevronDown: (p) => <Icon {...p} d="M6 9l6 6 6-6" />,
  ChevronUp: (p) => <Icon {...p} d="M18 15l-6-6-6 6" />,
  ArrowUp: (p) => <Icon {...p} paths={["M12 19V5", "M5 12l7-7 7 7"]} />,
  ArrowDown: (p) => <Icon {...p} paths={["M12 5v14", "M5 12l7 7 7-7"]} />,
  ArrowRight: (p) => <Icon {...p} paths={["M5 12h14", "M12 5l7 7-7 7"]} />,
  Activity: (p) => <Icon {...p} d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  AlertTriangle: (p) => (
    <Icon
      {...p}
      paths={[
        "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
        "M12 9v4",
        "M12 17h.01",
      ]}
    />
  ),
  Eye: (p) => (
    <Icon
      {...p}
      paths={["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"]}
    />
  ),
  EyeOff: (p) => (
    <Icon
      {...p}
      paths={[
        "M17.94 17.94A10.06 10.06 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24",
        "M1 1l22 22",
      ]}
    />
  ),
  Flag: (p) => <Icon {...p} paths={["M4 22V4", "M4 4h13l-2 5 2 5H4"]} />,
  Clock: (p) => <Icon {...p} paths={["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"]} />,
  ExternalLink: (p) => (
    <Icon {...p} paths={["M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6", "M15 3h6v6", "M10 14L21 3"]} />
  ),
  Lock: (p) => <Icon {...p} paths={["M3 11h18v10H3z", "M7 11V7a5 5 0 0 1 10 0v4"]} />,
  Bookmark: (p) => <Icon {...p} d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
  FileText: (p) => (
    <Icon
      {...p}
      paths={[
        "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
        "M14 2v6h6",
        "M16 13H8",
        "M16 17H8",
        "M10 9H8",
      ]}
    />
  ),
  Phone: (p) => (
    <Icon
      {...p}
      d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
    />
  ),
  Sidebar: (p) => <Icon {...p} paths={["M3 4h18v16H3z", "M9 4v16"]} />,
  Trash: (p) => (
    <Icon
      {...p}
      paths={[
        "M3 6h18",
        "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
        "M10 11v6",
        "M14 11v6",
        "M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2",
      ]}
    />
  ),
  Send: (p) => <Icon {...p} paths={["M22 2L11 13", "M22 2l-7 20-4-9-9-4z"]} />,
  Star: (p) => (
    <Icon {...p} d="M12 2l3.09 6.26 6.91 1-5 4.87 1.18 6.87L12 17.77l-6.18 3.23L7 14.13l-5-4.87 6.91-1z" />
  ),
  Filter: (p) => <Icon {...p} d="M22 3H2l8 9.46V19l4 2v-8.54z" />,
  MoreH: (p) => <Icon {...p} paths={["M5 12h.01", "M12 12h.01", "M19 12h.01"]} sw={3} />,
  CornerArr: (p) => <Icon {...p} paths={["M15 10l5 5-5 5", "M4 4v7a4 4 0 0 0 4 4h12"]} />,
  Globe: (p) => (
    <Icon
      {...p}
      paths={[
        "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
        "M2 12h20",
        "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
      ]}
    />
  ),
  Copy: (p) => (
    <Icon
      {...p}
      paths={[
        "M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z",
        "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
      ]}
    />
  ),
  Hash: (p) => <Icon {...p} paths={["M4 9h16", "M4 15h16", "M10 3L8 21", "M16 3l-2 18"]} />,
  Calendar: (p) => (
    <Icon
      {...p}
      paths={["M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M16 2v4", "M8 2v4", "M3 10h18"]}
    />
  ),
  MessageSquare: (p) => <Icon {...p} d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
} satisfies Record<string, IconComponent>
