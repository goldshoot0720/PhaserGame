import { cp, rm } from 'node:fs/promises';
// Only this generated staging directory is replaced; source and saves stay intact.
await rm('packaging/windows/site', { recursive: true, force: true });
await cp('.cache/release-site', 'packaging/windows/site', { recursive: true });
console.log('Windows offline site staged.');
