/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IExtUri } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';

/**
 * Computes how many folder steps separate the folder `from` and the folder
 * containing the file `to`: the number of steps up from `from` to the closest
 * common ancestor, plus the number of steps down from there to the folder of `to`.
 *
 * A file inside `from` has distance 0, a file in a sibling folder has distance 2.
 * Returns `Number.POSITIVE_INFINITY` when the two resources share no common
 * ancestor (e.g. different schemes or authorities).
 */
export function getFolderDistance(extUri: IExtUri, from: URI, to: URI): number {
	let up = 0;
	let ancestor = from;
	while (!extUri.isEqualOrParent(to, ancestor)) {
		const parent = extUri.dirname(ancestor);
		if (extUri.isEqual(parent, ancestor)) {
			return Number.POSITIVE_INFINITY; // reached the root without finding a common ancestor
		}

		ancestor = parent;
		up++;
	}

	// `ancestor` contains `to`, so the steps down are the difference in folder depth.
	// Not using `extUri.relativePath` because it ignores path casing for file URIs.
	const down = getFolderDepth(extUri.dirname(to)) - getFolderDepth(ancestor);

	return up + down;
}

function getFolderDepth(folder: URI): number {
	return folder.path.split('/').filter(segment => segment.length > 0).length;
}

/**
 * Creates a comparer that orders items by how close their resource is to `folder`,
 * closest first. Items without a resource, or whose resource is not related to
 * `folder`, sort last. Distances are cached per item for the lifetime of the comparer.
 */
export function createProximityComparer<T>(extUri: IExtUri, folder: URI, getResource: (item: T) => URI | undefined): (itemA: T, itemB: T) => number {
	const distances = new Map<T, number>();

	const getDistance = (item: T): number => {
		let distance = distances.get(item);
		if (distance === undefined) {
			const resource = getResource(item);
			distance = resource ? getFolderDistance(extUri, folder, resource) : Number.POSITIVE_INFINITY;
			distances.set(item, distance);
		}

		return distance;
	};

	return (itemA, itemB) => {
		const distanceA = getDistance(itemA);
		const distanceB = getDistance(itemB);
		if (distanceA === distanceB) {
			return 0; // also covers both being infinite, where subtraction would yield NaN
		}

		return distanceA < distanceB ? -1 : 1;
	};
}
