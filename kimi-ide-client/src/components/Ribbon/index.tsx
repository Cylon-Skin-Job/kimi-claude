import { useEffect, useState, useRef } from 'react';
import './Ribbon.css';

interface RibbonProps {
  active: boolean;
  onComplete?: () => void;
}

/**
 * Pure UI ribbon - runs 2.5s animation independent of queue engine.
 * 
 * Bar 1: 2s slow crawl from 0-100%
 * Bar 2: 1s dart to random 55-70% position, then stops
 * Bars fade out at 2.5s, onComplete fires
 */
export function Ribbon({ active, onComplete }: RibbonProps) {
  const [bar1Width, setBar1Width] = useState(0);
  const [bar2Width, setBar2Width] = useState(0);
  const bar2TargetRef = useRef(0);
  const [opacity, setOpacity] = useState(1);
  const [isVisible, setIsVisible] = useState(false);
  const calledRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setIsVisible(false);
      setBar1Width(0);
      setBar2Width(0);
      setOpacity(1);
      calledRef.current = false;
      return;
    }

    // Start animation
    setIsVisible(true);
    setBar1Width(0);
    setBar2Width(0);
    setOpacity(1);
    calledRef.current = false;

    // Bar 2 target: random 55-70%
    const target = 55 + Math.random() * 15;
    bar2TargetRef.current = target;

    // Trigger animations on next frame
    requestAnimationFrame(() => {
      setBar1Width(100); // 2s transition in CSS
      setBar2Width(bar2TargetRef.current); // 1s transition in CSS
    });

    // Fade out at 2.5s
    const fadeTimer = setTimeout(() => {
      setOpacity(0);
    }, 2500);

    // Complete at 2.8s (after fade)
    const completeTimer = setTimeout(() => {
      setIsVisible(false);
      if (!calledRef.current) {
        calledRef.current = true;
        onComplete?.();
      }
    }, 2800);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [active, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="ribbon-container" style={{ opacity }}>
      {/* Bar 1: slow crawl 0-100% in 2s */}
      <div
        className="ribbon ribbon-bar1"
        style={{
          width: `${bar1Width}%`,
          transition: 'width 2s linear',
        }}
      />
      {/* Bar 2: dart to target in 1s */}
      <div
        className="ribbon ribbon-bar2"
        style={{
          width: `${bar2Width}%`,
          left: 0,
          transition: 'width 1s ease-out',
        }}
      />
    </div>
  );
}
