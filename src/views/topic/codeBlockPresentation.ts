const CODE_LANGUAGE_ATTRIBUTE = 'data-docode-code-language';
const CODE_LANGUAGE_LABEL_ATTRIBUTE = 'data-docode-code-language-label';
const LANGUAGE_CLASS_PREFIXES = ['language-', 'lang-'] as const;
const LANGUAGE_ATTRIBUTES = ['data-code-language', 'data-language', 'data-lang', 'lang'] as const;
const SAFE_LANGUAGE_ID = /^[a-z0-9][a-z0-9+#._-]{0,39}$/u;

export interface NativeCodeLanguage {
  readonly id: string;
  readonly label: string;
}

const PLAIN_TEXT_LANGUAGE: NativeCodeLanguage = { id: 'plaintext', label: 'Plain Text' };

const LANGUAGE_ALIASES = new Map<string, NativeCodeLanguage>([
  ['bash', { id: 'shell', label: 'Shell' }],
  ['c', { id: 'c', label: 'C' }],
  ['c#', { id: 'csharp', label: 'C#' }],
  ['c++', { id: 'cpp', label: 'C++' }],
  ['cpp', { id: 'cpp', label: 'C++' }],
  ['cs', { id: 'csharp', label: 'C#' }],
  ['csharp', { id: 'csharp', label: 'C#' }],
  ['css', { id: 'css', label: 'CSS' }],
  ['dart', { id: 'dart', label: 'Dart' }],
  ['docker', { id: 'dockerfile', label: 'Dockerfile' }],
  ['dockerfile', { id: 'dockerfile', label: 'Dockerfile' }],
  ['go', { id: 'go', label: 'Go' }],
  ['golang', { id: 'go', label: 'Go' }],
  ['graphql', { id: 'graphql', label: 'GraphQL' }],
  ['html', { id: 'html', label: 'HTML' }],
  ['java', { id: 'java', label: 'Java' }],
  ['javascript', { id: 'javascript', label: 'JavaScript' }],
  ['js', { id: 'javascript', label: 'JavaScript' }],
  ['json', { id: 'json', label: 'JSON' }],
  ['jsonc', { id: 'jsonc', label: 'JSON with Comments' }],
  ['jsx', { id: 'jsx', label: 'JSX' }],
  ['kotlin', { id: 'kotlin', label: 'Kotlin' }],
  ['less', { id: 'less', label: 'Less' }],
  ['lua', { id: 'lua', label: 'Lua' }],
  ['markdown', { id: 'markdown', label: 'Markdown' }],
  ['md', { id: 'markdown', label: 'Markdown' }],
  ['objective-c', { id: 'objective-c', label: 'Objective-C' }],
  ['objc', { id: 'objective-c', label: 'Objective-C' }],
  ['php', { id: 'php', label: 'PHP' }],
  ['plaintext', PLAIN_TEXT_LANGUAGE],
  ['py', { id: 'python', label: 'Python' }],
  ['python', { id: 'python', label: 'Python' }],
  ['rb', { id: 'ruby', label: 'Ruby' }],
  ['rs', { id: 'rust', label: 'Rust' }],
  ['ruby', { id: 'ruby', label: 'Ruby' }],
  ['rust', { id: 'rust', label: 'Rust' }],
  ['sass', { id: 'sass', label: 'Sass' }],
  ['scala', { id: 'scala', label: 'Scala' }],
  ['scss', { id: 'scss', label: 'SCSS' }],
  ['sh', { id: 'shell', label: 'Shell' }],
  ['shell', { id: 'shell', label: 'Shell' }],
  ['sql', { id: 'sql', label: 'SQL' }],
  ['swift', { id: 'swift', label: 'Swift' }],
  ['text', PLAIN_TEXT_LANGUAGE],
  ['ts', { id: 'typescript', label: 'TypeScript' }],
  ['tsx', { id: 'tsx', label: 'TSX' }],
  ['typescript', { id: 'typescript', label: 'TypeScript' }],
  ['xml', { id: 'xml', label: 'XML' }],
  ['yaml', { id: 'yaml', label: 'YAML' }],
  ['yml', { id: 'yaml', label: 'YAML' }],
  ['zsh', { id: 'shell', label: 'Shell' }],
]);

const IGNORED_LANGUAGE_HINTS = new Set(['auto', 'hljs', 'nohighlight', 'none']);

export function readNativeCodeLanguage(pre: HTMLElement): NativeCodeLanguage {
  const code = pre.querySelector<HTMLElement>(':scope > code') ?? pre.querySelector('code');
  for (const element of [code, pre]) {
    if (!element) continue;
    for (const candidate of readLanguageCandidates(element)) {
      const language = normalizeLanguage(candidate);
      if (language) return language;
    }
  }
  return PLAIN_TEXT_LANGUAGE;
}

export function presentNativeCodeBlocks(root: HTMLElement): () => void {
  const codeBlocks = Array.from(root.querySelectorAll<HTMLElement>('pre'));
  const previous = codeBlocks.map((pre) => ({
    ariaLabel: pre.getAttribute('aria-label'),
    id: pre.getAttribute(CODE_LANGUAGE_ATTRIBUTE),
    label: pre.getAttribute(CODE_LANGUAGE_LABEL_ATTRIBUTE),
  }));

  codeBlocks.forEach((pre) => {
    const language = readNativeCodeLanguage(pre);
    pre.setAttribute(CODE_LANGUAGE_ATTRIBUTE, language.id);
    pre.setAttribute(CODE_LANGUAGE_LABEL_ATTRIBUTE, language.label);
    const existingLabel = pre.getAttribute('aria-label');
    pre.setAttribute(
      'aria-label',
      existingLabel ? `${existingLabel}, ${language.label}` : `${language.label} code block`,
    );
  });

  return () => {
    codeBlocks.forEach((pre, index) => {
      const value = previous[index];
      restoreAttribute(pre, 'aria-label', value?.ariaLabel ?? null);
      restoreAttribute(pre, CODE_LANGUAGE_ATTRIBUTE, value?.id ?? null);
      restoreAttribute(pre, CODE_LANGUAGE_LABEL_ATTRIBUTE, value?.label ?? null);
    });
  };
}

function readLanguageCandidates(element: HTMLElement): readonly string[] {
  const candidates: string[] = [];
  element.classList.forEach((className) => {
    for (const prefix of LANGUAGE_CLASS_PREFIXES) {
      if (className.startsWith(prefix) && className.length > prefix.length) {
        candidates.push(className.slice(prefix.length));
      }
    }
  });
  LANGUAGE_ATTRIBUTES.forEach((attribute) => {
    const value = element.getAttribute(attribute)?.trim();
    if (value) candidates.push(value);
  });
  return candidates;
}

function normalizeLanguage(value: string): NativeCodeLanguage | null {
  const id = value.trim().toLowerCase();
  if (!id || IGNORED_LANGUAGE_HINTS.has(id) || !SAFE_LANGUAGE_ID.test(id)) return null;
  return LANGUAGE_ALIASES.get(id) ?? { id, label: id };
}

function restoreAttribute(element: HTMLElement, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}
