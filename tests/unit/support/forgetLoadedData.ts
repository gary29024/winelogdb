import { afterEach } from 'vitest';
import { forgetLoadedData } from '../../../src/lib/query/client';

// The shared loader keeps each answer for five minutes after its screen closes,
// which in the app is the point. Between two tests in one file it would hand the
// second test the first one's answer, so every test starts with nothing kept.
afterEach(() => forgetLoadedData());
