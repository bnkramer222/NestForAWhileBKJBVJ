/**
 * Plain-language wording for shoppers, in their language. Clinical terms (approved / capped /
 * restricted, ICD-10 codes) stay on the volunteer and staff screens.
 */
const STATUSES = ['approved', 'capped', 'restricted'];
const CATEGORIES = ['produce', 'protein', 'dairy', 'grain', 'pantry'];

export function statusCopy(t) {
  return Object.fromEntries(
    STATUSES.map((status) => [
      status,
      {
        label: t(`status.${status}.label`),
        headline: t(`status.${status}.headline`),
        detail: t(`status.${status}.detail`),
      },
    ]),
  );
}

export function categoryCopy(t) {
  return Object.fromEntries(CATEGORIES.map((category) => [category, t(`cat.${category}`)]));
}
