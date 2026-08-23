import { Codicon } from '../icons/codicon';
import type { WorkbenchViewContext } from './workbenchContext';

interface WorkbenchBreadcrumbsProps {
  readonly context: WorkbenchViewContext;
  readonly currentPostHref: string | null;
  readonly currentPostNumber: number | null;
}

export function WorkbenchBreadcrumbs({
  context,
  currentPostHref,
  currentPostNumber,
}: WorkbenchBreadcrumbsProps) {
  const topic = context.route.kind === 'topic';
  return (
    <nav className="docode-workbench__breadcrumbs" aria-label="Breadcrumbs">
      <a className="docode-workbench__breadcrumb" href="https://linux.do/latest">
        <Codicon name="folder" />
        <span>linux.do</span>
      </a>
      <BreadcrumbSeparator />
      <a className="docode-workbench__breadcrumb" href={context.route.href}>
        <Codicon name={topic ? 'file' : context.icon} />
        <span>{context.label}</span>
      </a>
      {topic && currentPostNumber !== null && currentPostHref ? (
        <>
          <BreadcrumbSeparator />
          <a className="docode-workbench__breadcrumb" href={currentPostHref}>
            <Codicon name="symbol-method" />
            <span>reply #{currentPostNumber}</span>
          </a>
        </>
      ) : null}
    </nav>
  );
}

function BreadcrumbSeparator() {
  return (
    <span className="docode-workbench__breadcrumb-separator" aria-hidden="true">
      <Codicon name="chevron-right" />
    </span>
  );
}
