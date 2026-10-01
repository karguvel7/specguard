const level = process.env.SPECGUARD_LOG?.toLowerCase();

export function debug(...args: unknown[]): void {
  if (level === 'debug') {
    console.error('[specguard:debug]', ...args);
  }
}
