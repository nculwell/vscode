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
 * Creates a comparer that orders resources by how close they are to the folder
 * of `activeResource`, closest first. Resources that are `undefined` or not related
 * to `activeResource` sort last. Distances are cached for the lifetime of the comparer.
 */
export function createProximityComparer(extUri: IExtUri, activeResource: URI): (resourceA: URI | undefined, resourceB: URI | undefined) => number {
	const activeFolder = extUri.dirname(activeResource);
	const distances = new Map<string, number>();

	const getDistance = (resource: URI | undefined): number => {
		if (!resource) {
			return Number.POSITIVE_INFINITY;
		}

		const key = extUri.getComparisonKey(resource);
		let distance = distances.get(key);
		if (distance === undefined) {
			distance = getFolderDistance(extUri, activeFolder, resource);
			distances.set(key, distance);
		}

		return distance;
	};

	return (resourceA, resourceB) => {
		const distanceA = getDistance(resourceA);
		const distanceB = getDistance(resourceB);
		if (distanceA === distanceB) {
			return 0; // also covers both being infinite, where subtraction would yield NaN
		}

		return distanceA < distanceB ? -1 : 1;
	};
}
