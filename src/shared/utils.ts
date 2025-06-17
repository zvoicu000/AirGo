/**
 * Splits an array into chunks of a specified size.
 *
 * @typeParam T - The type of elements in the input array.
 * @param arr - The array to be split into chunks.
 * @param size - The maximum size of each chunk.
 * @returns An array of arrays, where each sub-array has at most `size` elements.
 *
 * @example
 * ```typescript
 * const data = [1, 2, 3, 4, 5];
 * const chunks = chunkArray(data, 2);
 * ```
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
