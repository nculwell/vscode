/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { extractRangeFromFilter, IFilterAndRange, stripLeadingCurrentDirectory } from '../../common/search.js';

suite('extractRangeFromFilter', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	suite('basics', function () {
		const base = '/some/path/file.txt';
		const at = (line: number, column = 1) => ({ startLineNumber: line, startColumn: column, endLineNumber: line, endColumn: column });
		const testSpecs: { filter: string; result: IFilterAndRange | undefined }[] = [
			// no line number
			{ filter: '', result: undefined },
			{ filter: '/some/path', result: undefined },
			{ filter: '/some/path/file.txt', result: undefined },

			// line only
			{ filter: '/some/path/file.txt:20', result: { filter: base, range: at(20) } },
			{ filter: '/some/path/file.txt#20', result: { filter: base, range: at(20) } },
			{ filter: '/some/path/file.txt(20', result: { filter: base, range: at(20) } },
			{ filter: '/some/path/file.txt:line 20', result: { filter: base, range: at(20) } },

			// line with a trailing column separator but no column
			{ filter: '/some/path/file.txt:20:', result: { filter: base, range: at(20) } },
			{ filter: '/some/path/file.txt:20#', result: { filter: base, range: at(20) } },
			{ filter: '/some/path/file.txt:20,', result: { filter: base, range: at(20) } },
			{ filter: '/some/path/file.txt#20:', result: { filter: base, range: at(20) } },
			{ filter: '/some/path/file.txt#20#', result: { filter: base, range: at(20) } },
			{ filter: '/some/path/file.txt#20,', result: { filter: base, range: at(20) } },
			{ filter: '/some/path/file.txt(20:', result: { filter: base, range: at(20) } },
			{ filter: '/some/path/file.txt(20#', result: { filter: base, range: at(20) } },
			{ filter: '/some/path/file.txt(20,', result: { filter: base, range: at(20) } },
			{ filter: '/some/path/file.txt:line 20:', result: { filter: base, range: at(20) } },
			{ filter: '/some/path/file.txt:line 20#', result: { filter: base, range: at(20) } },
			{ filter: '/some/path/file.txt:line 20,', result: { filter: base, range: at(20) } },

			// line and column
			{ filter: '/some/path/file.txt:20:3', result: { filter: base, range: at(20, 3) } },
			{ filter: '/some/path/file.txt:20#3', result: { filter: base, range: at(20, 3) } },
			{ filter: '/some/path/file.txt:20,3', result: { filter: base, range: at(20, 3) } },
			{ filter: '/some/path/file.txt#20:3', result: { filter: base, range: at(20, 3) } },
			{ filter: '/some/path/file.txt#20#3', result: { filter: base, range: at(20, 3) } },
			{ filter: '/some/path/file.txt#20,3', result: { filter: base, range: at(20, 3) } },
			{ filter: '/some/path/file.txt(20:3', result: { filter: base, range: at(20, 3) } },
			{ filter: '/some/path/file.txt(20#3', result: { filter: base, range: at(20, 3) } },
			{ filter: '/some/path/file.txt(20,3', result: { filter: base, range: at(20, 3) } },
			{ filter: '/some/path/file.txt:line 20:3', result: { filter: base, range: at(20, 3) } },
			{ filter: '/some/path/file.txt:line 20#3', result: { filter: base, range: at(20, 3) } },
			{ filter: '/some/path/file.txt:line 20,3', result: { filter: base, range: at(20, 3) } },

			// space between path and line
			{ filter: '/some/path/file.txt (19,20)', result: { filter: base, range: at(19, 20) } },
		];
		for (const { filter, result } of testSpecs) {
			test(JSON.stringify(filter), () => {
				assert.deepStrictEqual(extractRangeFromFilter(filter), result);
			});
		}
	});

	suite('ranges', function () {
		const base = '/some/path/file.txt';
		const testSpecs = [
			// line range: "20-40"
			{ filter: `${base}:20-40`, range: { startLineNumber: 20, startColumn: 1, endLineNumber: 40, endColumn: 1 } },
			// line and column range: "20:3-40:5"
			{ filter: `${base}:20:3-40:5`, range: { startLineNumber: 20, startColumn: 3, endLineNumber: 40, endColumn: 5 } },
			// end column defaults to start of the end line: "20:3-40"
			{ filter: `${base}:20:3-40`, range: { startLineNumber: 20, startColumn: 3, endLineNumber: 40, endColumn: 1 } },
			// mixed separators: "20#3-40,5"
			{ filter: `${base}#20#3-40,5`, range: { startLineNumber: 20, startColumn: 3, endLineNumber: 40, endColumn: 5 } },
			// paren style: "(20,3-40,5)"
			{ filter: `${base}(20,3-40,5)`, range: { startLineNumber: 20, startColumn: 3, endLineNumber: 40, endColumn: 5 } },
			// dangling separator falls back to single line: "20-"
			{ filter: `${base}:20-`, range: { startLineNumber: 20, startColumn: 1, endLineNumber: 20, endColumn: 1 } },
		];
		for (const { filter, range } of testSpecs) {
			test(filter, () => {
				assert.deepStrictEqual(extractRangeFromFilter(filter), { filter: base, range });
			});
		}

		test('hyphen in path is not treated as a range', () => {
			assert.ok(!extractRangeFromFilter('/some/path/my-file.txt'));
			assert.ok(!extractRangeFromFilter('/some/path/file-2.txt'));
		});
	});

	suite('unless', function () {
		const testSpecs = [
			// alpha-only symbol after unless
			{ filter: '/some/path/file.txt@alphasymbol', unless: ['@'], result: undefined },
			// unless as first char
			{ filter: '@/some/path/file.txt (19,20)', unless: ['@'], result: undefined },
			// unless as last char
			{ filter: '/some/path/file.txt (19,20)@', unless: ['@'], result: undefined },
			// unless before ,
			{
				filter: '/some/@path/file.txt (19,20)', unless: ['@'], result: {
					filter: '/some/@path/file.txt',
					range: {
						endColumn: 20,
						endLineNumber: 19,
						startColumn: 20,
						startLineNumber: 19
					}
				}
			},
			// unless before :
			{
				filter: '/some/@path/file.txt:19:20', unless: ['@'], result: {
					filter: '/some/@path/file.txt',
					range: {
						endColumn: 20,
						endLineNumber: 19,
						startColumn: 20,
						startLineNumber: 19
					}
				}
			},
			// unless before #
			{
				filter: '/some/@path/file.txt#19', unless: ['@'], result: {
					filter: '/some/@path/file.txt',
					range: {
						endColumn: 1,
						endLineNumber: 19,
						startColumn: 1,
						startLineNumber: 19
					}
				}
			},
		];
		for (const { filter, unless, result } of testSpecs) {
			test(`${filter} - ${JSON.stringify(unless)}`, () => {
				assert.deepStrictEqual(extractRangeFromFilter(filter, unless), result);
			});
		}
	});
});

suite('stripLeadingCurrentDirectory', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const testSpecs = [
		// leading "./" is removed
		{ input: './src/file.ts', expected: 'src/file.ts' },
		{ input: '.\\src\\file.ts', expected: 'src\\file.ts' },
		{ input: '././src/file.ts', expected: 'src/file.ts' },
		{ input: './', expected: '' },

		// anything else is left alone
		{ input: '', expected: '' },
		{ input: 'src/file.ts', expected: 'src/file.ts' },
		{ input: '../src/file.ts', expected: '../src/file.ts' },
		{ input: '.gitignore', expected: '.gitignore' },
		{ input: '/abs/./file.ts', expected: '/abs/./file.ts' },
	];
	for (const { input, expected } of testSpecs) {
		test(`${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
			assert.strictEqual(stripLeadingCurrentDirectory(input), expected);
		});
	}

	test('combined with range', function () {
		const res = extractRangeFromFilter('./src/file.ts:20:3');
		assert.deepStrictEqual({ filter: stripLeadingCurrentDirectory(res!.filter), range: res?.range }, {
			filter: 'src/file.ts',
			range: { startLineNumber: 20, startColumn: 3, endLineNumber: 20, endColumn: 3 }
		});
	});
});
