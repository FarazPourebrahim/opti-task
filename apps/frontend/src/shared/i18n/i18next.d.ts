import type { resources } from './index';

/**
 * Types every translation key from en.json, so `t('common.save')` is checked
 * and a typo is a compile error rather than a string rendered raw to a user.
 */
declare module 'i18next' {
  /* eslint-disable @typescript-eslint/consistent-type-definitions --
     Module augmentation only works with `interface`; a `type` alias cannot
     merge into an existing declaration. This is the documented exception to
     the working agreement's `type`-over-`interface` rule. */
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: (typeof resources)['en'];
  }
  /* eslint-enable @typescript-eslint/consistent-type-definitions */
}
