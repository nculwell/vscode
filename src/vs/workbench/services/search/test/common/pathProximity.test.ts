/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { extUri, extUriIgnorePathCase } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createProximityComparer, getFolderDistance } from '../../common/pathProximity.js';

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

	test('createProximityComparer', function () {
		const compare = createProximityComparer(extUri, URI.file('/repo/src/app'), (resource: URI | undefined) => resource);
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

	test('createProximityComparer - resolves each item once', function () {
		const resolved: string[] = [];
		const compare = createProximityComparer(extUri, URI.file('/repo'), (relativePath: string) => {
			resolved.push(relativePath);
			return URI.file(`/repo/${relativePath}`);
		});

		const sorted = ['a/b/c/file.ts', 'a/file.ts', 'file.ts', 'a/b/file.ts'].sort(compare);
		sorted.sort(compare);

		assert.deepStrictEqual({ sorted, resolved: resolved.sort() }, {
			sorted: ['file.ts', 'a/file.ts', 'a/b/file.ts', 'a/b/c/file.ts'],
			resolved: ['a/b/c/file.ts', 'a/b/file.ts', 'a/file.ts', 'file.ts']
		});
	});
});
