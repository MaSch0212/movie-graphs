import { Environment } from './environment.type';

export const environment: Environment = {
  version: (document.head.querySelector('meta[name="version"]') as HTMLMetaElement)?.content ?? '',
};
