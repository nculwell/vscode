/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { extUri, extUriIgnorePathCase } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createProximityRanking, getFolderDistance } from '../../common/pathProximity.js';

suite('pathProximity', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('getFolderDistance', function () {
		const from = URI.file('/repo/src/app');
		const targets = [
			'/repo/src/app/file.ts',			// same folder
			'/repo/src/app/sub/file.ts',		// child folder
			'/repo/src/file.ts',				// parent folder
			'/repo/src/lib/file.ts',			// sibling folder
			'/repo/test/unit/app/file.ts',		// cousin folder
			'/file.ts',							// root
			'/repo/src/application/file.ts',	// sibling whose name starts with the same text
		];

		assert.deepStrictEqual(
			targets.map(target => getFolderDistance(extUri, from, URI.file(target))),
			[0, 1, 1, 2, 5, 3, 2]
		);
	});

	test('getFolderDistance - unrelated resources are infinitely far', function () {
		const from = URI.file('/repo/src');

		assert.deepStrictEqual([
			getFolderDistance(extUri, from, URI.from({ scheme: 'untitled', path: 'Untitled-1' })),
			getFolderDistance(extUri, from, URI.from({ scheme: 'vscode-remote', authority: 'ssh-remote+host', path: '/repo/src/file.ts' })),
		], [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]);
	});

	test('getFolderDistance - respects path casing of the file system', function () {
		const from = URI.file('/Repo/Src');
		const to = URI.file('/repo/src/file.ts');

		assert.deepStrictEqual({
			caseSensitive: getFolderDistance(extUri, from, to),
			caseInsensitive: getFolderDistance(extUriIgnorePathCase, from, to)
		}, {
			caseSensitive: 4,
			caseInsensitive: 0
		});
	});

	test('createProximityRanking - tie breaker', function () {
		const compare = createProximityRanking(extUri, URI.file('/repo/src/app'), (resource: URI | undefined) => resource).tieBreaker!;
		const resources = [
			undefined,
			URI.file('/elsewhere/deep/folder/index.ts'),
			URI.from({ scheme: 'untitled', path: 'Untitled-1' }),
			URI.file('/repo/src/lib/index.ts'),
			URI.file('/repo/src/app/index.ts'),
			URI.file('/repo/src/app/views/index.ts'),
		];

		assert.deepStrictEqual(resources.sort(compare).map(resource => resource?.toString()), [
			'file:///repo/src/app/index.ts',
			'file:///repo/src/app/views/index.ts',
			'file:///repo/src/lib/index.ts',
			'file:///elsewhere/deep/folder/index.ts',
			'untitled:Untitled-1',
			undefined, // Array.sort always places undefined last
		]);
	});

	test('createProximityRanking - score boost', function () {
		const resources = ['/repo/src/app/index.ts', '/repo/src/index.ts', '/repo/test/index.ts', '/elsewhere/a/b/c/index.ts'].map(path => URI.file(path));
		const boost = (value?: number) => createProximityRanking(extUri, URI.file('/repo/src/app'), (resource: URI) => resource, value).scoreBoost;

		assert.deepStrictEqual({
			default: boost(),
			zero: boost(0),
			boosts: resources.map(boost(64)!),
		}, {
			default: undefined,
			zero: undefined,
			boosts: [64, 32, 8, 0.5], // distances 0, 1, 3 and 7
		});
	});

	test('createProximityRanking - resolves each item once', function () {
		const resolved: string[] = [];
		const ranking = createProximityRanking(extUri, URI.file('/repo'), (relativePath: string) => {
			resolved.push(relativePath);
			return URI.file(`/repo/${relativePath}`);
		}, 8);

		const sorted = ['a/b/c/file.ts', 'a/file.ts', 'file.ts', 'a/b/file.ts'].sort(ranking.tieBreaker);
		sorted.forEach(ranking.scoreBoost!);

		assert.deepStrictEqual({ sorted, resolved: resolved.sort() }, {
			sorted: ['file.ts', 'a/file.ts', 'a/b/file.ts', 'a/b/c/file.ts'],
			resolved: ['a/b/c/file.ts', 'a/b/file.ts', 'a/file.ts', 'file.ts']
		});
	});
});
