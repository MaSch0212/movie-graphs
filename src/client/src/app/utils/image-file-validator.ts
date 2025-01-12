import { ValidatorFn } from '@angular/forms';

export const imageFileValidator: ValidatorFn = control => {
  const file = control.value;
  if (!(file instanceof File)) {
    return null;
  }
  if (!file.type.startsWith('image/')) {
    return { imageFile: 'The file must be an image.' };
  }
  if (file.size > 1024 * 1024) {
    return { imageFile: 'The image must be smaller than 1MB.' };
  }
  return null;
};
