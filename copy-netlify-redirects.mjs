import { copyFile } from 'node:fs/promises';

await copyFile('public/_redirects', 'dist/_redirects');
