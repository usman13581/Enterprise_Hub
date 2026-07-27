import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SessionContext } from './session.types';

export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionContext => {
    const req = ctx.switchToHttp().getRequest<{ session: SessionContext }>();
    return req.session;
  },
);
