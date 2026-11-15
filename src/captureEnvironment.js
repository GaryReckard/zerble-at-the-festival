// User-supplied context is descriptive evidence, never hardware detection.
export function readCaptureEnvironment(search = '') {
  let params;
  try { params = new URLSearchParams(typeof search === 'string' ? search : ''); }
  catch { params = new URLSearchParams(); }
  const text = (key, limit) => {
    const value = params.get(key)?.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    return value ? value.slice(0, limit) : null;
  };
  const state = key => {
    const value = params.get(key);
    return ['on', 'off', 'unknown'].includes(value) ? value : 'unknown';
  };
  const battery = params.get('perfDeviceBatteryPercent');
  const batteryPercent = battery !== null && /^(?:0|[1-9]\d{0,2})$/.test(battery) && Number(battery) <= 100
    ? Number(battery) : null;
  return {
    deviceModel: text('perfDeviceModel', 160),
    lowPowerMode: state('perfDeviceLowPowerMode'),
    charging: state('perfDeviceCharging'),
    batteryPercent,
    thermalNote: text('perfDeviceThermalNote', 500),
  };
}

export function createTitleCadenceEstimate() {
  const intervals = [];
  const maxSamples = 120;
  return {
    sample(intervalMs, {hidden = false, running = false} = {}) {
      if (hidden || running || intervals.length >= maxSamples || !Number.isFinite(intervalMs) || intervalMs < 4 || intervalMs > 100) return;
      intervals.push(intervalMs);
    },
    snapshot() {
      const sorted = intervals.slice().sort((a, b) => a - b);
      const interval = sorted.length >= 20 ? sorted[Math.ceil(sorted.length * 0.1) - 1] : null;
      return {
        sampleCount: sorted.length,
        maxSamples,
        intervalP10Ms: interval === null ? null : Math.round(interval * 1000) / 1000,
        estimatedHz: interval === null ? null : Math.round(10000 / interval) / 10,
        method: 'Reciprocal of the nearest-rank p10 of the first 120 valid visible title callback intervals (4–100 ms); at least 20 samples required.',
        limitation: 'Title callback cadence includes loading, scheduling and display pacing. This is not a measured hardware refresh rate.',
      };
    },
  };
}
