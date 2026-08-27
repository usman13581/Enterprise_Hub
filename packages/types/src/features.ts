/** Product UI flags — flip to re-enable shelved surfaces. */
export const SHOW_NOTIFICATIONS = false;

/** True when the company session features list includes `key`. */
export function hasFeature(
  features: string[] | undefined,
  key: string,
): boolean {
  return Array.isArray(features) && features.includes(key);
}
