export function isIOS(device = globalThis.navigator ?? {}) {
  return /iPad|iPhone|iPod/i.test(device.userAgent ?? '')
    || device.platform === 'MacIntel' && device.maxTouchPoints > 1;
}
