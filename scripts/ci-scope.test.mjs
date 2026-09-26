import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseScope } from './ci-scope.mjs';

test('checkpoints and unreadable PR diffs fail open to full coverage', () => {
  assert.equal(chooseScope([], true).unit, 'full');
  assert.equal(chooseScope([]).unit, 'full');
  assert.equal(chooseScope([]).webkit, true);
});

test('documentation changes use no executable test jobs', () => {
  const scope = chooseScope(['README.md', 'docs/testing-strategy.md']);
  assert.equal(scope.quality, false);
  assert.equal(scope.unit, 'none');
  assert.equal(scope.chromium, 'none');
  assert.equal(scope.webkit, false);
});

test('small feature and test edits select relevant suites', () => {
  const producer = chooseScope(['src/features/producers/ProducerPage.tsx']);
  assert.equal(producer.unit, 'changed');
  assert.equal(producer.sourceReaders, true);
  assert.deepEqual(producer.specs, ['tests/e2e/producer-name-review.spec.ts']);
  assert.equal(producer.webkit, false);
  const testOnly = chooseScope(['tests/unit/producerNameReview.test.ts']);
  assert.equal(testOnly.unit, 'changed');
  assert.equal(testOnly.sourceReaders, false);
  assert.equal(testOnly.chromium, 'none');
  const sharedWine = chooseScope(['src/lib/wine/detailFields.ts']);
  assert.equal(sharedWine.chromium, 'selected');
  assert.ok(sharedWine.specs.includes('tests/e2e/wine-detail-layout.spec.ts'));
  const places = chooseScope(['src/lib/places/burgundyVillageMap.ts']);
  assert.equal(places.chromium, 'selected');
  assert.ok(places.specs.includes('tests/e2e/burgundy-village-map.spec.ts'));
});

test('layout and browser edits cover their browser projects', () => {
  const css = chooseScope(['src/features/wines/wineDetailCompact.css']);
  assert.equal(css.chromium, 'selected');
  assert.equal(css.webkit, true);
  const iphone = chooseScope(['tests/e2e/iphone-layout.spec.ts']);
  assert.equal(iphone.chromium, 'none');
  assert.equal(iphone.webkit, true);
  const lwinEdit = chooseScope(['tests/e2e/lwin-edit.spec.ts']);
  assert.equal(lwinEdit.chromium, 'selected');
  assert.equal(lwinEdit.webkit, true);
  const fixture = chooseScope(['tests/e2e/fixtures/layoutWine.ts']);
  assert.equal(fixture.chromium, 'full');
  assert.equal(fixture.webkit, true);
});

test('shared risk boundaries and unknown files get full coverage', () => {
  for (const path of ['src/lib/db/migrations/0084.sql', 'src/lib/auth/session.ts', 'worker/multiUser/access.ts', 'tests/unit/fixtures/wine.ts', 'vitest.config.ts', 'unusual.bin']) {
    const scope = chooseScope([path]);
    assert.equal(scope.unit, 'full', path);
    assert.equal(scope.chromium, 'full', path);
    assert.equal(scope.webkit, true, path);
  }
});

test('worker edits retain local runtime smoke without browser-only API mocks', () => {
  const scope = chooseScope(['worker/batchRecognition.ts']);
  assert.equal(scope.platform, true);
  assert.equal(scope.unit, 'changed');
  assert.equal(scope.chromium, 'none');
});

test('Journal retrieval changes run the real-stack sharing gate', () => {
  assert.equal(chooseScope(['src/lib/journal/semanticSearch.ts']).platform, true);
  assert.equal(chooseScope(['tests/stack/sharing-journey.spec.ts']).platform, true);
});
