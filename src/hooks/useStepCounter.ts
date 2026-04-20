
import { useState, useEffect, useRef } from 'react';

export function useStepCounter(onStep: () => void) {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  
  const lastX = useRef<number | null>(null);
  const lastY = useRef<number | null>(null);
  const lastZ = useRef<number | null>(null);
  const lastStepTime = useRef<number>(0);
  const threshold = 12; // Adjusted for step sensitivity
  const minStepInterval = 300; // ms

  useEffect(() => {
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      setIsSupported(true);
    } else {
      setIsSupported(false);
    }
  }, []);

  const requestPermission = async () => {
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceMotionEvent as any).requestPermission();
        if (response === 'granted') {
          setPermissionGranted(true);
          return true;
        }
      } catch (err) {
        console.error("Permission request error:", err);
      }
    } else {
      // For browsers that don't require explicit request (like Android)
      setPermissionGranted(true);
      return true;
    }
    return false;
  };

  const startTracking = async () => {
    const granted = await requestPermission();
    if (granted) {
      setIsTracking(true);
      window.addEventListener('devicemotion', handleMotion);
    }
  };

  const stopTracking = () => {
    setIsTracking(false);
    window.removeEventListener('devicemotion', handleMotion);
  };

  const handleMotion = (event: DeviceMotionEvent) => {
    const accel = event.accelerationIncludingGravity;
    if (!accel || accel.x === null || accel.y === null || accel.z === null) return;

    if (lastX.current !== null) {
      const deltaX = Math.abs(lastX.current - accel.x);
      const deltaY = Math.abs(lastY.current! - accel.y);
      const deltaZ = Math.abs(lastZ.current! - accel.z);

      const combinedDelta = deltaX + deltaY + deltaZ;
      const now = Date.now();

      if (combinedDelta > threshold && now - lastStepTime.current > minStepInterval) {
        onStep();
        lastStepTime.current = now;
      }
    }

    lastX.current = accel.x;
    lastY.current = accel.y;
    lastZ.current = accel.z;
  };

  return { isSupported, isTracking, startTracking, stopTracking, permissionGranted };
}
