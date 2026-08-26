import { useEffect, useRef, useState } from 'react';

import { Codicon } from '../../ui/icons/codicon';
import type { ShareCardModel } from './shareCard';
import { readShareCardPalette, renderShareCard } from './shareCardRenderer';

interface ShareCardDialogProps {
  readonly model: ShareCardModel;
  readonly onClose: () => void;
  readonly postNumber: number;
}

type ShareCardStatus =
  | { readonly kind: 'copied' }
  | { readonly kind: 'copy-failed' }
  | { readonly kind: 'downloaded' }
  | { readonly kind: 'error' }
  | { readonly kind: 'idle' }
  | { readonly kind: 'rendering' };

export function ShareCardDialog({ model, onClose, postNumber }: ShareCardDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ShareCardStatus>({ kind: 'rendering' });

  useEffect(() => {
    let cancelled = false;
    const host = dialogRef.current;
    const workbenchRoot = host?.closest<HTMLElement>('[data-docode-workbench-root]') ?? null;
    const targetDocument = host?.ownerDocument ?? document;
    renderShareCard(model, readShareCardPalette(workbenchRoot), targetDocument).then(
      (canvas) => {
        if (cancelled) return;
        canvasRef.current = canvas;
        setPreviewUrl(canvas.toDataURL('image/png'));
        setStatus({ kind: 'idle' });
      },
      () => {
        if (!cancelled) setStatus({ kind: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [model]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const copyImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        setStatus({ kind: 'copy-failed' });
        return;
      }
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(
        () => {
          setStatus({ kind: 'copied' });
        },
        () => {
          setStatus({ kind: 'copy-failed' });
        },
      );
    }, 'image/png');
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    const host = dialogRef.current;
    if (!canvas || !host) return;
    const link = host.ownerDocument.createElement('a');
    link.download = `docode-${model.fileName.replace(/\.java$/u, '')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setStatus({ kind: 'downloaded' });
  };

  const ready = status.kind !== 'rendering' && status.kind !== 'error' && previewUrl !== null;

  return (
    <div
      className="docode-topic-code__share-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        aria-label={`Share card for post ${String(postNumber)}`}
        className="docode-topic-code__share-dialog"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="docode-topic-code__share-header">
          <span className="docode-topic-code__share-title">Share {model.fileName}</span>
          <button
            aria-label="Close share card"
            className="docode-topic-code__share-close"
            onClick={onClose}
            type="button"
          >
            <Codicon name="close" />
          </button>
        </header>
        <div className="docode-topic-code__share-preview">
          {previewUrl ? (
            <img alt={`Code card for post ${String(postNumber)}`} src={previewUrl} />
          ) : (
            <span className="docode-topic-code__share-progress">
              {status.kind === 'error' ? 'Unable to render the card.' : 'Rendering card…'}
            </span>
          )}
        </div>
        <footer className="docode-topic-code__share-actions">
          <button
            className="docode-topic-code__share-action"
            data-share-action="copy"
            disabled={!ready}
            onClick={copyImage}
            type="button"
          >
            <Codicon name="copy" /> Copy Image
          </button>
          <button
            className="docode-topic-code__share-action"
            data-share-action="download"
            disabled={!ready}
            onClick={downloadImage}
            type="button"
          >
            <Codicon name="desktop-download" /> Download PNG
          </button>
          <span aria-live="polite" className="docode-topic-code__share-status" role="status">
            {shareCardStatusLabel(status)}
          </span>
        </footer>
      </div>
    </div>
  );
}

function shareCardStatusLabel(status: ShareCardStatus): string {
  switch (status.kind) {
    case 'copied':
      return 'Copied to clipboard';
    case 'copy-failed':
      return 'Copy failed — try Download PNG';
    case 'downloaded':
      return 'Saved as PNG';
    case 'error':
      return 'Unable to render the card.';
    case 'idle':
    case 'rendering':
      return '';
  }
}
