import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import {
  DEFAULT_WORKBENCH_APPEARANCE,
  type WorkbenchAppearancePreference,
  type WorkbenchThemePreference,
} from '../../settings/workbenchAppearancePreference';
import { Codicon } from '../icons/codicon';
import { ColorPickerControl } from './ColorPickerControl';

type AppearanceKey = keyof WorkbenchAppearancePreference;

interface SettingsEditorProps {
  readonly onChange: (preference: WorkbenchAppearancePreference) => void;
  readonly preference: WorkbenchAppearancePreference;
  readonly resolvedTheme: 'dark' | 'light';
}

interface SelectOption {
  readonly description: string;
  readonly label: string;
  readonly value: string;
}

const SETTING_SEARCH_TEXT: Readonly<Record<AppearanceKey, string>> = {
  commandCenterLabel: 'workbench command center label title bar search text docode',
  showTopicAvatars: 'editor topic detail post body avatar author profile image',
  theme: 'workbench appearance color theme dark light system operating system',
  topicDetailBodyColor: 'editor topic detail post body foreground font color',
  topicListBodyColor: 'editor topic list body foreground font color latest unread new hot',
};

const THEME_COLORS = {
  dark: { topicDetailBodyColor: '#ce9178', topicListBodyColor: '#dcdcaa' },
  light: { topicDetailBodyColor: '#a31515', topicListBodyColor: '#795e26' },
} as const;

const THEME_OPTIONS: readonly SelectOption[] = [
  {
    description: 'Follows the operating system appearance and updates when the system changes.',
    label: 'System Default',
    value: 'system',
  },
  {
    description: 'Uses the Dark Modern workbench palette regardless of the operating system.',
    label: 'Dark Modern',
    value: 'dark',
  },
  {
    description: 'Uses the Light Modern workbench palette regardless of the operating system.',
    label: 'Light Modern',
    value: 'light',
  },
];

export function SettingsEditor({ onChange, preference, resolvedTheme }: SettingsEditorProps) {
  const [query, setQuery] = useState('');
  const [appearanceExpanded, setAppearanceExpanded] = useState(true);
  const appearanceGroup = useRef<HTMLElement | null>(null);
  const workbenchGroup = useRef<HTMLElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleKeys = useMemo(
    () =>
      new Set(
        (Object.keys(SETTING_SEARCH_TEXT) as AppearanceKey[]).filter((key) =>
          SETTING_SEARCH_TEXT[key].includes(normalizedQuery),
        ),
      ),
    [normalizedQuery],
  );
  const resultCount = visibleKeys.size;
  const update = <Key extends AppearanceKey>(
    key: Key,
    value: WorkbenchAppearancePreference[Key],
  ) => {
    onChange({ ...preference, [key]: value });
  };
  const reset = (key: AppearanceKey) => {
    onChange({ ...preference, [key]: DEFAULT_WORKBENCH_APPEARANCE[key] });
  };
  const effectiveColors = THEME_COLORS[resolvedTheme];
  const listColor =
    preference.topicListBodyColor === DEFAULT_WORKBENCH_APPEARANCE.topicListBodyColor
      ? effectiveColors.topicListBodyColor
      : preference.topicListBodyColor;
  const detailColor =
    preference.topicDetailBodyColor === DEFAULT_WORKBENCH_APPEARANCE.topicDetailBodyColor
      ? effectiveColors.topicDetailBodyColor
      : preference.topicDetailBodyColor;
  const scrollTo = (target: HTMLElement | null) => {
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <section className="docode-settings" aria-label="Settings editor">
      <header className="docode-settings__header">
        <h1 className="docode-settings__title">Settings</h1>
        <div className="docode-settings__search">
          <Codicon name="search" />
          <input
            aria-label="Search settings"
            onChange={(event) => {
              setQuery(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Escape' || query.length === 0) return;
              setQuery('');
              event.preventDefault();
            }}
            placeholder="Search settings"
            spellCheck={false}
            type="text"
            value={query}
          />
          {query ? (
            <button
              aria-label="Clear Settings Search Results"
              className="docode-settings__clear"
              onClick={() => {
                setQuery('');
              }}
              type="button"
            >
              <Codicon name="close" />
            </button>
          ) : null}
        </div>
        <div className="docode-settings__header-controls">
          <span className="docode-settings__result-count">
            {String(resultCount)} {resultCount === 1 ? 'Setting Found' : 'Settings Found'}
          </span>
        </div>
      </header>
      <div className="docode-settings__body">
        <div aria-label="Settings table of contents" className="docode-settings__toc" role="tree">
          <TocItem
            active
            label="Commonly Used"
            onClick={() => {
              scrollTo(appearanceGroup.current);
            }}
          />
          <TocItem
            expanded={appearanceExpanded}
            label="Appearance"
            onClick={() => {
              setAppearanceExpanded((current) => !current);
              scrollTo(appearanceGroup.current);
            }}
          />
          {appearanceExpanded ? (
            <TocItem
              label="Editor"
              nested
              onClick={() => {
                scrollTo(appearanceGroup.current);
              }}
            />
          ) : null}
          <TocItem
            label="Workbench"
            onClick={() => {
              scrollTo(workbenchGroup.current);
            }}
          />
        </div>
        <div className="docode-settings__content">
          {resultCount === 0 ? (
            <div className="docode-settings__empty" role="status">
              No Settings Found
            </div>
          ) : null}
          {hasAny(visibleKeys, [
            'theme',
            'topicListBodyColor',
            'topicDetailBodyColor',
            'showTopicAvatars',
          ]) ? (
            <section className="docode-settings__group" ref={appearanceGroup}>
              <h2>Appearance</h2>
              {visibleKeys.has('theme') ? (
                <SettingRow
                  description="Specifies the color theme used in the workbench. System follows the operating system and updates automatically."
                  modified={preference.theme !== DEFAULT_WORKBENCH_APPEARANCE.theme}
                  onReset={() => {
                    reset('theme');
                  }}
                  title="DOCode › Appearance: Color Theme"
                >
                  <SelectControl
                    defaultValue={DEFAULT_WORKBENCH_APPEARANCE.theme}
                    label="DOCode Appearance Color Theme"
                    onChange={(value) => {
                      update('theme', value as WorkbenchThemePreference);
                    }}
                    options={THEME_OPTIONS}
                    value={preference.theme}
                  />
                </SettingRow>
              ) : null}
              {visibleKeys.has('topicListBodyColor') ? (
                <SettingRow
                  description="Controls the foreground color of topic titles in Linux DO list source documents."
                  modified={
                    preference.topicListBodyColor !==
                    DEFAULT_WORKBENCH_APPEARANCE.topicListBodyColor
                  }
                  onReset={() => {
                    reset('topicListBodyColor');
                  }}
                  title="DOCode › Editor: Topic List Body Color"
                >
                  <ColorPickerControl
                    label="Topic List Body Color"
                    onChange={(value) => {
                      update('topicListBodyColor', value);
                    }}
                    value={listColor}
                  />
                </SettingRow>
              ) : null}
              {visibleKeys.has('topicDetailBodyColor') ? (
                <SettingRow
                  description="Controls the foreground color of reply text in Linux DO topic source documents."
                  modified={
                    preference.topicDetailBodyColor !==
                    DEFAULT_WORKBENCH_APPEARANCE.topicDetailBodyColor
                  }
                  onReset={() => {
                    reset('topicDetailBodyColor');
                  }}
                  title="DOCode › Editor: Topic Detail Body Color"
                >
                  <ColorPickerControl
                    label="Topic Detail Body Color"
                    onChange={(value) => {
                      update('topicDetailBodyColor', value);
                    }}
                    value={detailColor}
                  />
                </SettingRow>
              ) : null}
              {visibleKeys.has('showTopicAvatars') ? (
                <SettingRow
                  description="Controls whether author avatars are shown beside reply declarations in topic documents."
                  modified={
                    preference.showTopicAvatars !== DEFAULT_WORKBENCH_APPEARANCE.showTopicAvatars
                  }
                  onReset={() => {
                    reset('showTopicAvatars');
                  }}
                  title="DOCode › Editor: Show Topic Avatars"
                >
                  <label className="docode-settings__checkbox-label">
                    <input
                      checked={preference.showTopicAvatars}
                      onChange={(event) => {
                        update('showTopicAvatars', event.currentTarget.checked);
                      }}
                      type="checkbox"
                    />
                    <span aria-hidden="true" className="docode-settings__checkbox">
                      {preference.showTopicAvatars ? <Codicon name="check" /> : null}
                    </span>
                    Show author avatars in topic details
                  </label>
                </SettingRow>
              ) : null}
            </section>
          ) : null}
          {visibleKeys.has('commandCenterLabel') ? (
            <section className="docode-settings__group" ref={workbenchGroup}>
              <h2>Workbench</h2>
              <SettingRow
                description="Controls the text displayed in the title bar Command Center when Quick Open is closed."
                modified={
                  preference.commandCenterLabel !== DEFAULT_WORKBENCH_APPEARANCE.commandCenterLabel
                }
                onReset={() => {
                  reset('commandCenterLabel');
                }}
                title="DOCode › Workbench: Command Center Label"
              >
                <TextControl
                  label="Command Center Label"
                  onChange={(value) => {
                    update('commandCenterLabel', value);
                  }}
                  value={preference.commandCenterLabel}
                />
              </SettingRow>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function TocItem({
  active = false,
  expanded,
  label,
  nested = false,
  onClick,
}: {
  readonly active?: boolean;
  readonly expanded?: boolean;
  readonly label: string;
  readonly nested?: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      className={`docode-settings__toc-item${active ? ' docode-settings__toc-item--active' : ''}${nested ? ' docode-settings__toc-item--nested' : ''}`}
      onClick={onClick}
      role="treeitem"
      type="button"
      {...(expanded === undefined ? {} : { 'aria-expanded': expanded })}
    >
      <span aria-hidden="true" className="docode-settings__toc-twistie">
        {expanded === undefined ? null : (
          <Codicon name={expanded ? 'chevron-down' : 'chevron-right'} />
        )}
      </span>
      <span className="docode-settings__toc-label">{label}</span>
    </button>
  );
}

function SettingRow({
  children,
  description,
  modified,
  onReset,
  title,
}: {
  readonly children: ReactNode;
  readonly description: string;
  readonly modified: boolean;
  readonly onReset: () => void;
  readonly title: string;
}) {
  return (
    <div className="docode-settings__row" data-modified={modified ? 'true' : undefined}>
      <div className="docode-settings__row-toolbar">
        <button
          aria-label={`Reset ${title}`}
          data-docode-tooltip="Reset Setting"
          disabled={!modified}
          onClick={onReset}
          type="button"
        >
          <Codicon name="refresh" />
        </button>
      </div>
      <div className="docode-settings__row-title">{title}</div>
      <div className="docode-settings__row-description">{description}</div>
      <div className="docode-settings__control">{children}</div>
    </div>
  );
}

function SelectControl({
  defaultValue,
  label,
  onChange,
  options,
  value,
}: {
  readonly defaultValue: string;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly SelectOption[];
  readonly value: string;
}) {
  const listId = useId();
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const active = options[activeIndex] ?? options[selectedIndex];
  const selected = options[selectedIndex];

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

  const commit = (index: number) => {
    const option = options[index];
    setOpen(false);
    trigger.current?.focus();
    if (option && option.value !== value) onChange(option.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      setActiveIndex(selectedIndex);
      setOpen(true);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit(activeIndex);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(options.length - 1, current + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    }
  };

  return (
    <div className="docode-settings__select" ref={container}>
      <button
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        className="docode-settings__select-trigger"
        onBlur={(event) => {
          if (event.relatedTarget && container.current?.contains(event.relatedTarget)) return;
          setOpen(false);
        }}
        onClick={() => {
          setActiveIndex(selectedIndex);
          setOpen((current) => !current);
        }}
        onKeyDown={handleKeyDown}
        ref={trigger}
        role="combobox"
        type="button"
        {...(open ? { 'aria-activedescendant': `${listId}-${String(activeIndex)}` } : {})}
      >
        <span className="docode-settings__select-value">{selected?.label ?? value}</span>
        <Codicon name="chevron-down" />
      </button>
      {open ? (
        <div className="docode-settings__select-dropdown">
          <div className="docode-settings__select-list" id={listId} role="listbox">
            {options.map((option, index) => (
              <div
                aria-selected={option.value === value}
                className="docode-settings__select-option"
                data-active={index === activeIndex ? 'true' : undefined}
                id={`${listId}-${String(index)}`}
                key={option.value}
                onClick={() => {
                  commit(index);
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onMouseEnter={() => {
                  setActiveIndex(index);
                }}
                role="option"
              >
                <span className="docode-settings__select-option-text">{option.label}</span>
                {option.value === defaultValue ? (
                  <span aria-hidden="true" className="docode-settings__select-option-default">
                    Default
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="docode-settings__select-details">{active?.description}</div>
        </div>
      ) : null}
    </div>
  );
}

function TextControl({
  label,
  onChange,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  return (
    <input
      aria-label={label}
      defaultValue={value}
      key={value}
      maxLength={64}
      onBlur={(event) => {
        const normalized = event.currentTarget.value.trim();
        if (normalized.length > 0) onChange(normalized);
        else event.currentTarget.value = value;
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          event.currentTarget.value = value;
          event.currentTarget.blur();
        }
      }}
      spellCheck={false}
      type="text"
    />
  );
}

function hasAny(keys: ReadonlySet<AppearanceKey>, candidates: readonly AppearanceKey[]): boolean {
  return candidates.some((candidate) => keys.has(candidate));
}
