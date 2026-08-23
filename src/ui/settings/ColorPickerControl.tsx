import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

interface RgbColor {
  readonly b: number;
  readonly g: number;
  readonly r: number;
}

interface HsvColor {
  readonly h: number;
  readonly s: number;
  readonly v: number;
}

export function ColorPickerControl({
  label,
  onChange,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const hsv = useMemo(() => rgbToHsv(hexToRgb(value)), [value]);

  useEffect(() => {
    if (!open) return undefined;
    const owner = container.current?.ownerDocument;
    if (!owner) return undefined;
    const dismiss = (event: Event) => {
      if (container.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    owner.addEventListener('pointerdown', dismiss, true);
    return () => {
      owner.removeEventListener('pointerdown', dismiss, true);
    };
  }, [open]);

  const commitHsv = (next: HsvColor) => {
    onChange(hsvToHex(next));
  };

  const readSaturation = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    commitHsv({
      h: hsv.h,
      s: clamp((event.clientX - rect.left) / rect.width),
      v: 1 - clamp((event.clientY - rect.top) / rect.height),
    });
  };

  const readHue = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    commitHsv({ ...hsv, h: clamp((event.clientX - rect.left) / rect.width) * 360 });
  };

  const handleSaturationKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    if (event.key === 'ArrowLeft') commitHsv({ ...hsv, s: clamp(hsv.s - step) });
    else if (event.key === 'ArrowRight') commitHsv({ ...hsv, s: clamp(hsv.s + step) });
    else if (event.key === 'ArrowUp') commitHsv({ ...hsv, v: clamp(hsv.v + step) });
    else if (event.key === 'ArrowDown') commitHsv({ ...hsv, v: clamp(hsv.v - step) });
    else return;
    event.preventDefault();
  };

  const handleHueKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 30 : 5;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      commitHsv({ ...hsv, h: (hsv.h + 360 - step) % 360 });
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      commitHsv({ ...hsv, h: (hsv.h + step) % 360 });
    } else return;
    event.preventDefault();
  };

  return (
    <div className="docode-settings__color-control" ref={container}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${label} Picker`}
        className="docode-settings__color-swatch"
        onClick={() => {
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !open) return;
          event.preventDefault();
          setOpen(false);
        }}
        ref={trigger}
        style={{ background: value }}
        type="button"
      />
      <input
        aria-label={label}
        defaultValue={value}
        key={value}
        maxLength={7}
        onBlur={(event) => {
          if (!/^#[\da-f]{6}$/iu.test(event.currentTarget.value)) {
            event.currentTarget.value = value;
          }
        }}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (/^#[\da-f]{6}$/iu.test(next)) onChange(next.toLowerCase());
        }}
        spellCheck={false}
        type="text"
      />
      {open ? (
        <div
          aria-label={`${label} Picker`}
          className="docode-settings__color-popup"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            setOpen(false);
            trigger.current?.focus();
          }}
          role="dialog"
        >
          <div
            aria-label={`${label} Saturation And Brightness`}
            className="docode-settings__color-area"
            onKeyDown={handleSaturationKeys}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              readSaturation(event);
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              readSaturation(event);
            }}
            role="group"
            style={{ '--docode-color-picker-hue': hueColor(hsv.h) } as Record<string, string>}
            tabIndex={0}
          >
            <span
              className="docode-settings__color-area-handle"
              style={{ left: `${String(hsv.s * 100)}%`, top: `${String((1 - hsv.v) * 100)}%` }}
            />
          </div>
          <div
            aria-label={`${label} Hue`}
            aria-valuemax={360}
            aria-valuemin={0}
            aria-valuenow={Math.round(hsv.h)}
            className="docode-settings__color-hue"
            onKeyDown={handleHueKeys}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              readHue(event);
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              readHue(event);
            }}
            role="slider"
            tabIndex={0}
          >
            <span
              className="docode-settings__color-hue-handle"
              style={{ left: `${String((hsv.h / 360) * 100)}%` }}
            />
          </div>
          <div className="docode-settings__color-preview">
            <span style={{ background: value }} />
            <span className="docode-settings__color-preview-value">{value}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function hueColor(hue: number): string {
  return hsvToHex({ h: hue, s: 1, v: 1 });
}

function hexToRgb(hex: string): RgbColor {
  const value = Number.parseInt(hex.slice(1), 16);
  return { b: value & 0xff, g: (value >> 8) & 0xff, r: (value >> 16) & 0xff };
}

function rgbToHex({ b, g, r }: RgbColor): string {
  const channel = (part: number) => part.toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function rgbToHsv({ b, g, r }: RgbColor): HsvColor {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) * 60;
    else if (max === green) hue = ((blue - red) / delta + 2) * 60;
    else hue = ((red - green) / delta + 4) * 60;
  }
  return { h: hue, s: max === 0 ? 0 : delta / max, v: max };
}

function hsvToRgb({ h, s, v }: HsvColor): RgbColor {
  const chroma = v * s;
  const secondary = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const offset = v - chroma;
  const sector = Math.floor(h / 60) % 6;
  const red = sector === 0 || sector === 5 ? chroma : sector === 1 || sector === 4 ? secondary : 0;
  const green =
    sector === 1 || sector === 2 ? chroma : sector === 0 || sector === 3 ? secondary : 0;
  const blue = sector === 3 || sector === 4 ? chroma : sector === 2 || sector === 5 ? secondary : 0;
  return {
    b: Math.round((blue + offset) * 255),
    g: Math.round((green + offset) * 255),
    r: Math.round((red + offset) * 255),
  };
}

function hsvToHex(hsv: HsvColor): string {
  return rgbToHex(hsvToRgb(hsv));
}
