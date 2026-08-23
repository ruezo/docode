// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  presentNativeCodeBlocks,
  readNativeCodeLanguage,
} from '../../src/views/topic/codeBlockPresentation';

describe('native code block presentation', () => {
  it('normalizes real Linux DO language evidence without inferring source text', () => {
    document.body.innerHTML = `<main id="root">
      <pre id="typescript"><code class="hljs lang-ts">const value = 1;</code></pre>
      <pre id="java" data-language="java"><code>class Main {}</code></pre>
      <pre id="go"><code class="language-golang">func main() {}</code></pre>
      <pre id="yaml"><code class="lang-auto language-yml">enabled: true</code></pre>
      <pre id="shell"><code lang="zsh">echo ready</code></pre>
      <pre id="plain"><code>const looksLikeTypeScript = true;</code></pre>
      <pre id="unsafe"><code class="language-&lt;script&gt;">alert(1)</code></pre>
    </main>`;

    const language = (id: string) => {
      const pre = document.querySelector<HTMLElement>(`#${id}`);
      if (!pre) throw new Error(`Missing ${id} fixture.`);
      return readNativeCodeLanguage(pre);
    };

    expect(language('typescript')).toEqual({ id: 'typescript', label: 'TypeScript' });
    expect(language('java')).toEqual({ id: 'java', label: 'Java' });
    expect(language('go')).toEqual({ id: 'go', label: 'Go' });
    expect(language('yaml')).toEqual({ id: 'yaml', label: 'YAML' });
    expect(language('shell')).toEqual({ id: 'shell', label: 'Shell' });
    expect(language('plain')).toEqual({ id: 'plaintext', label: 'Plain Text' });
    expect(language('unsafe')).toEqual({ id: 'plaintext', label: 'Plain Text' });
  });

  it('adds reversible labels without replacing native code or highlighter spans', () => {
    document.body.innerHTML = `<main id="root"><pre aria-label="Configuration"><code class="language-json hljs"><span class="hljs-attr">"ready"</span>: <span class="hljs-literal">true</span></code></pre></main>`;
    const root = document.querySelector<HTMLElement>('#root');
    const pre = root?.querySelector<HTMLElement>('pre');
    const code = pre?.querySelector<HTMLElement>('code');
    const attribute = code?.querySelector<HTMLElement>('.hljs-attr');
    if (!root || !pre || !code || !attribute) throw new Error('Missing code fixture.');
    const originalMarkup = root.innerHTML;

    const restore = presentNativeCodeBlocks(root);

    expect(pre.dataset.docodeCodeLanguage).toBe('json');
    expect(pre.dataset.docodeCodeLanguageLabel).toBe('JSON');
    expect(pre.getAttribute('aria-label')).toBe('Configuration, JSON');
    expect(pre.querySelector('code')).toBe(code);
    expect(pre.querySelector('.hljs-attr')).toBe(attribute);
    expect(code.textContent).toBe('"ready": true');

    restore();

    expect(root.innerHTML).toBe(originalMarkup);
    expect(pre.querySelector('code')).toBe(code);
    expect(pre.querySelector('.hljs-attr')).toBe(attribute);
  });
});
