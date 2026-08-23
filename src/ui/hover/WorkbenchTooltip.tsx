import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

interface TooltipState {
  readonly content: string;
  readonly left: number;
  readonly top: number;
}

const TOOLTIP_MARGIN = 8;

export function WorkbenchTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const tooltipId = `${useId()}-tooltip`;
  const tooltipElement = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLElement | null>(null);
  const pendingTarget = useRef<HTMLElement | null>(null);
  const timer = useRef<number | null>(null);
  const previousDescription = useRef<string | null>(null);

  useLayoutEffect(() => {
    const element = tooltipElement.current;
    const anchor = target.current;
    if (!tooltip || !element || !anchor?.isConnected) return;

    const elementRect = element.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const maximumLeft = Math.max(
      TOOLTIP_MARGIN,
      window.innerWidth - elementRect.width - TOOLTIP_MARGIN,
    );
    const left = clamp(
      anchorRect.left + anchorRect.width / 2 - elementRect.width / 2,
      TOOLTIP_MARGIN,
      maximumLeft,
    );
    const below = anchorRect.bottom + TOOLTIP_MARGIN;
    const top =
      below + elementRect.height <= window.innerHeight - TOOLTIP_MARGIN
        ? below
        : Math.max(TOOLTIP_MARGIN, anchorRect.top - elementRect.height - TOOLTIP_MARGIN);

    if (left !== tooltip.left || top !== tooltip.top) {
      setTooltip((current) => (current ? { ...current, left, top } : current));
    }
  }, [tooltip]);

  useEffect(() => {
    const element = tooltipElement.current;
    const root = element?.closest<HTMLElement>('.docode-workbench');
    if (!root) return;

    const clearTimer = () => {
      if (timer.current === null) return;
      window.clearTimeout(timer.current);
      timer.current = null;
    };
    const detachDescription = () => {
      const activeTarget = target.current;
      if (!activeTarget) return;
      if (previousDescription.current === null) activeTarget.removeAttribute('aria-describedby');
      else activeTarget.setAttribute('aria-describedby', previousDescription.current);
      previousDescription.current = null;
    };
    const hide = () => {
      clearTimer();
      detachDescription();
      pendingTarget.current = null;
      target.current = null;
      setTooltip(null);
    };
    const show = (nextTarget: HTMLElement) => {
      clearTimer();
      const content = nextTarget.dataset.docodeTooltip?.trim();
      if (!content || !nextTarget.isConnected) return;
      detachDescription();
      pendingTarget.current = null;
      target.current = nextTarget;
      previousDescription.current = nextTarget.getAttribute('aria-describedby');
      nextTarget.setAttribute(
        'aria-describedby',
        [previousDescription.current, tooltipId].filter(Boolean).join(' '),
      );
      setTooltip({ content, left: TOOLTIP_MARGIN, top: TOOLTIP_MARGIN });
    };
    const schedule = (nextTarget: HTMLElement) => {
      if (pendingTarget.current === nextTarget || target.current === nextTarget) return;
      hide();
      pendingTarget.current = nextTarget;
      timer.current = window.setTimeout(() => {
        if (pendingTarget.current === nextTarget) show(nextTarget);
      }, getWorkbenchHoverDelay());
    };
    const tooltipTarget = (eventTarget: EventTarget | null) => {
      if (!(eventTarget instanceof Element)) return null;
      const candidate = eventTarget.closest<HTMLElement>('[data-docode-tooltip]');
      return candidate && root.contains(candidate) ? candidate : null;
    };
    const onPointerOver = (event: PointerEvent) => {
      const nextTarget = tooltipTarget(event.target);
      if (nextTarget) schedule(nextTarget);
    };
    const onPointerOut = (event: PointerEvent) => {
      const activeTarget = pendingTarget.current ?? target.current;
      if (!activeTarget) return;
      if (event.relatedTarget instanceof Node && activeTarget.contains(event.relatedTarget)) return;
      if (tooltipTarget(event.target) === activeTarget) hide();
    };
    const onFocusIn = (event: FocusEvent) => {
      const nextTarget = tooltipTarget(event.target);
      if (nextTarget) show(nextTarget);
    };
    const onFocusOut = (event: FocusEvent) => {
      const activeTarget = target.current;
      if (!activeTarget) return;
      if (event.relatedTarget instanceof Node && activeTarget.contains(event.relatedTarget)) return;
      if (tooltipTarget(event.target) === activeTarget) hide();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') hide();
    };

    root.addEventListener('pointerover', onPointerOver);
    root.addEventListener('pointerout', onPointerOut);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('pointerdown', hide);
    root.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    window.addEventListener('resize', hide);
    return () => {
      root.removeEventListener('pointerover', onPointerOver);
      root.removeEventListener('pointerout', onPointerOut);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('pointerdown', hide);
      root.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
      window.removeEventListener('resize', hide);
      hide();
    };
  }, [tooltipId]);

  return (
    <div
      className="docode-workbench-tooltip"
      hidden={tooltip === null}
      id={tooltipId}
      ref={tooltipElement}
      role="tooltip"
      style={tooltip ? { left: tooltip.left, top: tooltip.top } : undefined}
    >
      {tooltip?.content}
    </div>
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

function getWorkbenchHoverDelay(): number {
  return window.navigator.platform.includes('Mac') ? 1500 : 500;
}
