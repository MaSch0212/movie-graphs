import { ValidatorFn } from '@angular/forms';

export type ImageFileError = 'notAnImage' | 'tooLarge';

/** Validates a selected poster file. The error is reported as `{ imageFile: ImageFileError }`. */
export const imageFileValidator: ValidatorFn = control => {
  const file = control.value;
  if (!(file instanceof File)) {
    return null;
  }
  if (!file.type.startsWith('image/')) {
    return { imageFile: 'notAnImage' satisfies ImageFileError };
  }
  if (file.size > 1024 * 1024) {
    return { imageFile: 'tooLarge' satisfies ImageFileError };
  }
  return null;
};
