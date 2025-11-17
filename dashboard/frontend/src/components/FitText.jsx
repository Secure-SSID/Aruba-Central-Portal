import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * FitText
 * - Scales its children down (never up) to fit on a single line within the container.
 * - Uses CSS transform: scale() for crisp rendering and better performance.
 *
 * Props:
 * - children: text or inline elements to fit
 * - maxScale: upper bound for scale (default 1)
 * - minScale: lower bound for scale (default 0.5)
 * - align: left | center | right (transform origin) (default 'left')
 * - className, style: passed to container
 */
export default function FitText({
  children,
  maxScale = 1,
  minScale = 0.5,
  align = 'left',
  className,
  style,
}) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [scale, setScale] = useState(1);

  // Prefer useLayoutEffect to reduce visible layout shift on initial render
  const useIsoLayoutEffect =
    typeof window !== 'undefined' ? useLayoutEffect : useEffect;

  const computeScale = () => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    // Reset scale to 1 before measurement to get intrinsic width
    content.style.transform = 'scale(1)';
    content.style.whiteSpace = 'nowrap';

    const containerWidth = container.clientWidth;
    const contentWidth = content.scrollWidth; // intrinsic width at scale 1

    if (!containerWidth || !contentWidth) {
      setScale(1);
      return;
    }

    const nextScale = Math.max(
      minScale,
      Math.min(maxScale, containerWidth / contentWidth)
    );
    setScale(nextScale);
  };

  useIsoLayoutEffect(() => {
    computeScale();
    // Recompute on window resize
    const onResize = () => computeScale();
    window.addEventListener('resize', onResize);

    // Observe container size changes
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => computeScale());
      if (containerRef.current) {
        ro.observe(containerRef.current);
      }
    }

    return () => {
      window.removeEventListener('resize', onResize);
      if (ro && containerRef.current) {
        ro.unobserve(containerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute if children change
  useEffect(() => {
    // Slight delay to allow fonts/layout to settle
    const id = setTimeout(computeScale, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  const transformOrigin =
    align === 'center'
      ? 'center'
      : align === 'right'
      ? 'right center'
      : 'left center';

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: 'block',
        width: '100%',
        overflow: 'hidden',
        ...style,
      }}
    >
      <span
        ref={contentRef}
        style={{
          display: 'inline-block',
          transform: `scale(${scale})`,
          transformOrigin,
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
    </div>
  );
}


