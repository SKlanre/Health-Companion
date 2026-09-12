import { useState, useEffect, useRef, useCallback } from 'react';

export type MotionPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

interface UseStepCounterOptions {
  onStep: (newCount?: number) => void;
  enabled?: boolean;
}

export function useStepCounter({ onStep, enabled = true }: UseStepCounterOptions) {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<MotionPermissionStatus>('prompt');
  const [currentIntensity, setCurrentIntensity] = useState<number>(0);
  const [lastStepTime, setLastStepTime] = useState<number>(0);

  // Use a ref for onStep to prevent stale closures in event listeners
  const onStepRef = useRef(onStep);
  useEffect(() => {
    onStepRef.current = onStep;
  }, [onStep]);

  // Motion analysis state refs
  const gravityEst = useRef<number>(9.81);
  const isRisingRef = useRef<boolean>(false);
  const peakValueRef = useRef<number>(0);
  const lastStepTimestampRef = useRef<number>(0);
  const sensorRef = useRef<any>(null); // Generic Sensor API reference if used

  // Tuning thresholds for human walking cadence and acceleration
  const UPPER_THRESHOLD = 1.75; // m/s^2 above dynamic baseline
  const LOWER_THRESHOLD = 0.65; // m/s^2 hysteresis reset threshold
  const MIN_STEP_INTERVAL = 270; // ms minimum between steps (~220 steps/min)
  const MAX_STEP_INTERVAL = 2500; // ms maximum before cadence reset

  // Check initial support & saved permissions
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsSupported(false);
      setPermissionStatus('unsupported');
      return;
    }

    const hasDeviceMotion = 'DeviceMotionEvent' in window;
    const hasGenericSensor = 'Accelerometer' in window || 'LinearAccelerationSensor' in window;

    if (!hasDeviceMotion && !hasGenericSensor) {
      setIsSupported(false);
      setPermissionStatus('unsupported');
      return;
    }

    setIsSupported(true);

    // Check if iOS requestPermission is needed
    if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
      const saved = localStorage.getItem('fitai_motion_permission');
      if (saved === 'granted') {
        setPermissionStatus('prompt'); // iOS requires explicit user interaction per session
      } else if (saved === 'denied') {
        setPermissionStatus('denied');
      } else {
        setPermissionStatus('prompt');
      }
    } else {
      // Android / desktop browsers typically don't require an explicit prompt function
      setPermissionStatus('granted');
    }
  }, []);

  // Step detection handler
  const processAcceleration = useCallback((x: number, y: number, z: number, hasGravity: boolean) => {
    const now = performance.now();
    let dynamicMagnitude = 0;

    if (hasGravity) {
      // Total acceleration magnitude including gravity (rest ~ 9.8 m/s^2)
      const totalMag = Math.sqrt(x * x + y * y + z * z);
      if (isNaN(totalMag)) return;

      // Low-pass filter to track gravity orientation vector
      gravityEst.current = 0.88 * gravityEst.current + 0.12 * totalMag;
      dynamicMagnitude = Math.abs(totalMag - gravityEst.current);
    } else {
      // Linear acceleration directly (gravity removed by sensor fusion)
      dynamicMagnitude = Math.sqrt(x * x + y * y + z * z);
      if (isNaN(dynamicMagnitude)) return;
    }

    // Keep UI intensity indicator updated (throttled)
    if (Math.random() < 0.15) {
      setCurrentIntensity(Math.round(dynamicMagnitude * 10) / 10);
    }

    // Peak-valley detection state machine
    if (!isRisingRef.current) {
      if (dynamicMagnitude > UPPER_THRESHOLD) {
        isRisingRef.current = true;
        peakValueRef.current = dynamicMagnitude;
      }
    } else {
      // Track peak
      if (dynamicMagnitude > peakValueRef.current) {
        peakValueRef.current = dynamicMagnitude;
      } else if (dynamicMagnitude < LOWER_THRESHOLD) {
        // Falling edge after crossing peak
        const timeSinceLastStep = now - lastStepTimestampRef.current;
        if (timeSinceLastStep >= MIN_STEP_INTERVAL && timeSinceLastStep <= MAX_STEP_INTERVAL * 2) {
          lastStepTimestampRef.current = now;
          setLastStepTime(Date.now());
          // Fire step callback safely using latest ref
          try {
            onStepRef.current();
          } catch (err) {
            console.error('Error in onStep callback:', err);
          }
        } else if (timeSinceLastStep > MAX_STEP_INTERVAL * 2 || lastStepTimestampRef.current === 0) {
          // First step after being stationary
          lastStepTimestampRef.current = now;
          setLastStepTime(Date.now());
          try {
            onStepRef.current();
          } catch (err) {
            console.error('Error in onStep callback:', err);
          }
        }
        isRisingRef.current = false;
        peakValueRef.current = 0;
      }
    }
  }, []);

  const handleDeviceMotion = useCallback((event: DeviceMotionEvent) => {
    // Prefer linear acceleration (gravity removed) if available
    const linear = event.acceleration;
    if (linear && linear.x !== null && linear.y !== null && linear.z !== null) {
      processAcceleration(linear.x, linear.y, linear.z, false);
      return;
    }

    // Fall back to acceleration including gravity
    const withGravity = event.accelerationIncludingGravity;
    if (withGravity && withGravity.x !== null && withGravity.y !== null && withGravity.z !== null) {
      processAcceleration(withGravity.x, withGravity.y, withGravity.z, true);
    }
  }, [processAcceleration]);

  // Start tracking listener
  const startTracking = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    // Check iOS permission requirement
    if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
      try {
        const response = await (DeviceMotionEvent as any).requestPermission();
        if (response === 'granted') {
          setPermissionStatus('granted');
          localStorage.setItem('fitai_motion_permission', 'granted');
        } else {
          setPermissionStatus('denied');
          localStorage.setItem('fitai_motion_permission', 'denied');
          return false;
        }
      } catch (err) {
        console.warn('Motion permission request failed (requires user tap):', err);
        setPermissionStatus('prompt');
        return false;
      }
    } else {
      setPermissionStatus('granted');
    }

    // Register devicemotion event
    try {
      window.removeEventListener('devicemotion', handleDeviceMotion);
      window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
      setIsTracking(true);
      return true;
    } catch (e) {
      console.error('Failed to attach devicemotion listener:', e);

      // Fallback: Try Generic Sensor API
      try {
        if ('LinearAccelerationSensor' in window) {
          const sensor = new (window as any).LinearAccelerationSensor({ frequency: 50 });
          sensor.addEventListener('reading', () => {
            processAcceleration(sensor.x, sensor.y, sensor.z, false);
          });
          sensor.start();
          sensorRef.current = sensor;
          setIsTracking(true);
          return true;
        }
      } catch (sensorErr) {
        console.warn('Generic sensor fallback not available:', sensorErr);
      }

      return false;
    }
  }, [handleDeviceMotion, processAcceleration]);

  // Stop tracking listener
  const stopTracking = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('devicemotion', handleDeviceMotion);
      if (sensorRef.current) {
        try {
          sensorRef.current.stop();
        } catch (_) {}
        sensorRef.current = null;
      }
    }
    setIsTracking(false);
  }, [handleDeviceMotion]);

  // Manual / Testing simulation
  const simulateStep = useCallback(() => {
    setLastStepTime(Date.now());
    setCurrentIntensity(2.4);
    setTimeout(() => setCurrentIntensity(0.2), 300);
    onStepRef.current();
  }, []);

  // Auto-start tracking if enabled and permissions allow
  useEffect(() => {
    if (!enabled) {
      if (isTracking) stopTracking();
      return;
    }

    // If on standard browser (Android / desktop) or permission already granted, attempt start
    if (typeof (DeviceMotionEvent as any)?.requestPermission !== 'function') {
      startTracking();
    }

    return () => {
      stopTracking();
    };
  }, [enabled, startTracking, stopTracking]);

  return {
    isSupported,
    isTracking,
    permissionStatus,
    currentIntensity,
    lastStepTime,
    startTracking,
    stopTracking,
    simulateStep,
  };
}
