import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { GrammyArgumentsHost } from '@grammyjs/nestjs';
import { Context } from '../../interfaces/context.interface';
import { Logger } from '@nestjs/common';

@Catch()
export class GrammyExceptionFilter implements ExceptionFilter {
  logger = new Logger(GrammyExceptionFilter.name);
  async catch(exception: Error, host: ArgumentsHost): Promise<void> {
    const grammyHost = GrammyArgumentsHost.create(host);
    const ctx = grammyHost.getContext<Context>();

    this.logger.error(
      exception?.message || exception,
      `CODE_${ctx?.from?.id}/${ctx?.msgId} // ${exception?.stack}`,
    );

    // Some errors occur with no context of the bot or user
    if (typeof ctx?.replyWithHTML == 'function') {
      await ctx.replyWithHTML(
        `<b>Something went wrong, we have reported this error for you and will resolve shortly</b>\n<i>Reference: ${ctx?.from?.id}/${ctx?.msgId}</i>`,
      );
    }
  }
}
