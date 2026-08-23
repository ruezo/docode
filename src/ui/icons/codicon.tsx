export type CodiconName =
  | 'account'
  | 'add'
  | 'arrow-left'
  | 'arrow-right'
  | 'bell'
  | 'bookmark'
  | 'check'
  | 'chrome-close'
  | 'chrome-maximize'
  | 'chrome-minimize'
  | 'chevron-down'
  | 'chevron-right'
  | 'circle-slash'
  | 'close'
  | 'comment-discussion'
  | 'debug-disconnect'
  | 'debug-alt'
  | 'debug-stop'
  | 'edit'
  | 'ellipsis'
  | 'extensions'
  | 'error'
  | 'file'
  | 'files'
  | 'filter'
  | 'folder'
  | 'git-branch'
  | 'home'
  | 'heart'
  | 'info'
  | 'link-external'
  | 'layout'
  | 'layout-panel'
  | 'layout-panel-off'
  | 'layout-sidebar-left'
  | 'layout-sidebar-left-off'
  | 'layout-sidebar-right-off'
  | 'list-unordered'
  | 'loading'
  | 'mirror'
  | 'redo'
  | 'refresh'
  | 'remote'
  | 'remote-explorer'
  | 'search'
  | 'screen-full'
  | 'screen-normal'
  | 'settings-gear'
  | 'source-control'
  | 'sync'
  | 'split-horizontal'
  | 'symbol-field'
  | 'symbol-method'
  | 'tag'
  | 'terminal'
  | 'trash'
  | 'warning'
  | 'zoom-in'
  | 'zoom-out';

interface CodiconProps {
  readonly name: CodiconName;
  readonly spin?: boolean;
}

export function Codicon({ name, spin = false }: CodiconProps) {
  const modifier = spin ? ' codicon-modifier-spin' : '';
  return (
    <span aria-hidden="true" className={`codicon codicon-${name} docode-codicon${modifier}`} />
  );
}
