// Custom SVG replicas of three Lucide icons (Layers / Target / Sword) used in
// the sidebar. Same shape as the originals — same viewBox, stroke-width,
// linecaps — but with each path/circle individually addressable so we can run
// per-element animations on hover.
//
// The animations live in globals.css (`@keyframes layers-stack`, etc.) and
// fire on `:hover` of the closest `.group/nav` ancestor (matching the
// existing sidebar group-class).

import type { SVGProps } from "react";

const baseProps: SVGProps<SVGSVGElement> = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};

/**
 * Layers — three stacked diamond layers. On hover each layer slides down to
 * its resting position one after the other, mimicking sheets dropping onto a
 * pile (the bank-organizer-as-stacker metaphor).
 */
export function LayersAnim(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      {/* Top layer — slowest to "drop in" (animation-delay set in CSS). */}
      <path
        className="sidebar-icon-layer-top"
        d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"
      />
      <path
        className="sidebar-icon-layer-mid"
        d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"
      />
      <path
        className="sidebar-icon-layer-bot"
        d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"
      />
    </svg>
  );
}

/**
 * Target — three concentric circles. On hover the outer rings pulse inward,
 * mimicking a scope locking onto its centre.
 */
export function TargetAnim(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <circle className="sidebar-icon-target-outer" cx="12" cy="12" r="10" />
      <circle className="sidebar-icon-target-mid"   cx="12" cy="12" r="6"  />
      <circle className="sidebar-icon-target-inner" cx="12" cy="12" r="2"  />
    </svg>
  );
}

/**
 * Sword — blade + hilt + crossguard. On hover the blade rotates ~15° around
 * its hilt for a brief "slash" motion, then settles back.
 */
export function SwordAnim(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      {/* `transform-box: fill-box` lets the rotation pivot at the bottom-left
          corner of the blade where the hilt sits. */}
      <g className="sidebar-icon-sword-blade">
        <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      </g>
      <line x1="13" x2="19" y1="19" y2="13" />
      <line x1="16" x2="20" y1="16" y2="20" />
      <line x1="19" x2="21" y1="21" y2="19" />
    </svg>
  );
}
