import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { Loader2, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";
import type { DocumentPreviewKind } from "../lib/documentPreview";

const DEFAULT_FIT_HEIGHT = "h-[min(420px,55vh)]";
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

type SecureDocumentPreviewProps = {
  url: string | null;
  kind: DocumentPreviewKind | null;
  alt?: string;
  loading?: boolean;
  error?: string | null;
  fitHeightClass?: string;
  className?: string;
  imageRef?: RefObject<HTMLImageElement | null>;
  onImageLoad?: () => void;
  imageOverlay?: ReactNode;
  unavailableFallback?: ReactNode;
  onLightboxOpenChange?: (open: boolean) => void;
};

export function SecureDocumentPreview({
  url,
  kind,
  alt = "Document preview",
  loading = false,
  error = null,
  fitHeightClass = DEFAULT_FIT_HEIGHT,
  className,
  imageRef,
  onImageLoad,
  imageOverlay,
  unavailableFallback,
  onLightboxOpenChange,
}: SecureDocumentPreviewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    onLightboxOpenChange?.(lightboxOpen);
  }, [lightboxOpen, onLightboxOpenChange]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeLightbox();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [lightboxOpen, closeLightbox]);

  const openLightbox = (e: SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (kind === "image" && url && !loading && !error) {
      setLightboxOpen(true);
    }
    if (kind === "pdf" && url && !loading && !error) {
      setLightboxOpen(true);
    }
  };

  const stopDialogDismiss = (e: SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      <div className={cn("relative overflow-hidden rounded-lg border bg-white", className)}>
        {loading && (
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-2 text-gray-600",
              fitHeightClass,
            )}
          >
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Loading preview…</span>
          </div>
        )}

        {!loading && error && (
          <Alert variant="destructive" className="m-4 border-red-200">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && url && kind === "pdf" && (
          <div
            role="button"
            tabIndex={0}
            onClick={openLightbox}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openLightbox(e);
            }}
            onPointerDown={stopDialogDismiss}
            className={cn(
              "group relative block w-full cursor-zoom-in overflow-hidden bg-gray-50",
              fitHeightClass,
            )}
            aria-label="Enlarge document preview"
          >
            <iframe
              title={alt}
              src={url}
              className="pointer-events-none size-full border-0"
            />
            <EnlargeHint />
          </div>
        )}

        {!loading && !error && url && kind === "image" && (
          <div
            role="button"
            tabIndex={0}
            onClick={openLightbox}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openLightbox(e);
            }}
            onPointerDown={stopDialogDismiss}
            className={cn(
              "group relative block w-full cursor-zoom-in overflow-hidden bg-gray-50",
              fitHeightClass,
            )}
            aria-label="Enlarge image preview"
          >
            <img
              ref={imageRef}
              src={url}
              alt={alt}
              className="box-border size-full object-contain p-2"
              draggable={false}
              onLoad={onImageLoad}
            />
            {imageOverlay}
            <EnlargeHint />
          </div>
        )}

        {!loading && !error && kind === "other" && (
          <div className={cn("flex items-center justify-center p-8", fitHeightClass)}>
            {unavailableFallback ?? (
              <p className="text-center text-sm text-gray-600">
                Preview is not available for this file type.
              </p>
            )}
          </div>
        )}
      </div>

      {mounted &&
        lightboxOpen &&
        url &&
        createPortal(
          <DocumentLightbox alt={alt} kind={kind} url={url} onClose={closeLightbox} />,
          document.body,
        )}
    </>
  );
}

function DocumentLightbox({
  alt,
  kind,
  url,
  onClose,
}: {
  alt: string;
  kind: DocumentPreviewKind | null;
  url: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setZoom(1);
  }, [url]);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z.toFixed(2))));

  const zoomIn = () => setZoom((z) => clampZoom(z + ZOOM_STEP));
  const zoomOut = () => setZoom((z) => clampZoom(z - ZOOM_STEP));
  const resetZoom = () => setZoom(1);

  const handleWheel = (e: { deltaY: number; preventDefault: () => void }) => {
    if (kind !== "image") return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((z) => clampZoom(z + delta));
  };

  const handleClose = (e?: SyntheticEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label={alt}>
      {/* Backdrop — click to close */}
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/95"
        aria-label="Close enlarged preview"
        onClick={handleClose}
      />

      {/* Panel above backdrop */}
      <div className="pointer-events-none relative z-10 flex h-full flex-col">
        <div className="pointer-events-auto flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-black/90 px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">{alt}</p>

          {kind === "image" && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-white hover:bg-white/15 hover:text-white"
                onClick={zoomOut}
                disabled={zoom <= MIN_ZOOM}
                aria-label="Zoom out"
              >
                <ZoomOut className="size-4" />
              </Button>
              <span className="w-12 text-center text-xs tabular-nums text-white/90">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-white hover:bg-white/15 hover:text-white"
                onClick={zoomIn}
                disabled={zoom >= MAX_ZOOM}
                aria-label="Zoom in"
              >
                <ZoomIn className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-white hover:bg-white/15 hover:text-white"
                onClick={resetZoom}
                disabled={zoom === 1}
                aria-label="Reset zoom"
              >
                <RotateCcw className="mr-1 size-3.5" />
                Reset
              </Button>
            </div>
          )}

          <button
            type="button"
            onClick={handleClose}
            className="ml-1 shrink-0 rounded-md bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Close enlarged preview"
          >
            <X className="size-5" />
          </button>
        </div>

        <div
          ref={scrollRef}
          className="pointer-events-auto min-h-0 flex-1 overflow-auto"
          onWheel={kind === "image" ? handleWheel : undefined}
        >
          <div className="flex min-h-full min-w-full items-center justify-center p-6">
            {kind === "image" && (
              <img
                src={url}
                alt={alt}
                draggable={false}
                className="max-h-[calc(100vh-8rem)] max-w-[min(96vw,72rem)] origin-center object-contain transition-transform duration-150"
                style={{
                  transform: `scale(${zoom})`,
                }}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {kind === "pdf" && (
              <iframe
                title={alt}
                src={url}
                className="h-[calc(100vh-8rem)] w-[min(96vw,72rem)] border-0 bg-white shadow-lg"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </div>

        <p className="pointer-events-none shrink-0 bg-black/90 pb-3 text-center text-xs text-white/60">
          {kind === "image"
            ? "Scroll wheel or +/- to zoom · Escape or X to close"
            : "Escape or X to close — review screen stays open"}
        </p>
      </div>
    </div>
  );
}

function EnlargeHint() {
  return (
    <span className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 text-xs text-white opacity-90 transition-opacity group-hover:opacity-100">
      <ZoomIn className="h-3.5 w-3.5" />
      Click to enlarge
    </span>
  );
}
