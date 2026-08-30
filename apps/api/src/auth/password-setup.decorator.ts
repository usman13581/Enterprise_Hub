import { SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_SETUP = 'allowPasswordSetup';
export const AllowPasswordSetup = () => SetMetadata(ALLOW_PASSWORD_SETUP, true);
