const raw = (process.env.ENABLE_CHRONICLE ?? '').toLowerCase();
const enabled = ['1', 'true', 'yes', 'on'].includes(raw);

if (!enabled) {
  console.error('Chronicle verification disabled. Set ENABLE_CHRONICLE=1 to run full audit.');
  process.exit(1);
}
