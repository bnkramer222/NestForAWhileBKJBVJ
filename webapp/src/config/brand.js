/**
 * App name and tagline in one place. Change them here (or with APP_NAME / APP_TAGLINE env vars)
 * and every page title, header, and footer updates.
 */
export const brand = {
  name: process.env.APP_NAME || 'Nourish',
  org: 'Epic Cure',
  tagline: process.env.APP_TAGLINE || 'Fresh food that fits your health',
  mark: (process.env.APP_NAME || 'Nourish').trim().charAt(0).toUpperCase(),
};
