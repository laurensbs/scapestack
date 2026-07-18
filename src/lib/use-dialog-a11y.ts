"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]:not([tabindex='-1'])",
  "button:not([disabled]):not([tabindex='-1'])",
  "textarea:not([disabled]):not([tabindex='-1'])",
  "input:not([disabled]):not([tabindex='-1'])",
  "select:not([disabled]):not([tabindex='-1'])",
  "details summary",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

function focusFirstElement(dialog: HTMLElement) {
  const preferred = dialog.querySelector<HTMLElement>("[data-autofocus]");
  if (preferred) {
    preferred.focus({ preventScroll: true });
    return;
  }
  const first = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  (first ?? dialog).focus({ preventScroll: true });
}

function focusReturnTarget(target: Element | null) {
  if (target instanceof HTMLElement && document.contains(target)) {
    target.focus({ preventScroll: true });
  }
}

export function useDialogA11y<T extends HTMLElement>(
  open: boolean,
  onClose: () => void
): RefObject<T | null> {
  const dialogRef = useRef<T | null>(null);
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      if (dialogRef.current) focusFirstElement(dialogRef.current);
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0);

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      focusReturnTarget(returnFocusRef.current);
    };
  }, [onClose, open]);

  return dialogRef;
}
