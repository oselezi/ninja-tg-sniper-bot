/**
 * @module logger.logger.service
 *
 * @description
 * Definitions for the custom logger service gateway
 */

/** NestJS */
import {
  ConsoleLogger,
  HttpException,
  HttpStatus,
  Injectable,
  Scope,
  ConsoleLoggerOptions,
} from '@nestjs/common';
import debug from 'debug';

/** API */
import * as bunyan from 'bunyan';
import { LoggingBunyan } from '@google-cloud/logging-bunyan';

import { isGCP } from '../util';
/**
 * Logger service implementation
 * @class
 */
@Injectable({
  scope: Scope.TRANSIENT,
})
class GCPCloudCustomLogger extends ConsoleLogger {
  private loggingBunyan: LoggingBunyan;
  private logger: bunyan;
  private debugLoggers: { [namespace: string]: debug.IDebugger } = {};

  constructor(context?: string, options: ConsoleLoggerOptions = {}) {
    super(context, options);

    // Initializes Google Cloud Logging Bunyan
    this.loggingBunyan = new LoggingBunyan();

    const streams = [];

    // if not GCP environment, add stdout stream
    if (!isGCP) {
      // @ts-ignore
      // streams.push({ stream: process.stdout });
      // streams.push(this.loggingBunyan.stream('debug'));
    } else {
      streams.push(this.loggingBunyan.stream('info'));
      // Initialize debug logger for GCP
      if (process.env.DEBUG) {
        this.initializeDebugLoggers(process.env.DEBUG);
        streams.push(this.loggingBunyan.stream('debug'));
      }
      streams.push(this.loggingBunyan.stream('error'));
    }
    // Creates a Bunyan logger
    this.logger = bunyan.createLogger({
      name: 'nestjs',
      // level: 'info',
      streams: streams,
    });
  }

  private initializeDebugLoggers(debugNamespaces: string) {
    debugNamespaces.split(',').forEach((namespace) => {
      this.debugLoggers[namespace] = debug(namespace);
    });
  }

  log(message: any, context?: string) {
    !isGCP && super.log(message, context); // Call the original method to log to console
    this.publishToCloudLogging('info', message, context);
  }

  error(message: any, stack?: string, context?: string) {
    !isGCP && super.error(message, stack, context); // Call the original method to log to console
    this.publishToCloudLogging('error', message, context, stack);
  }

  debug(message: any, context?: string, stack?: string) {
    if (!isGCP) {
      super.debug(message, context, stack);
    }

    const debugLogger = this.debugLoggers[context];
    if (debugLogger && debugLogger.enabled) {
      this.publishToCloudLogging('debug', message, context, stack);
      debugLogger(message);
    }
  }

  warn(message: any, stack?: string, context?: string) {
    !isGCP && super.warn(message, stack, context); // Call the original method to log to console
    this.publishToCloudLogging('warn', message, context, stack);
  }

  private publishToCloudLogging(
    level: bunyan.LogLevelString,
    message: any,
    context?: string,
    stack?: string,
  ) {
    if (
      typeof message === 'object' &&
      !Array.isArray(message) &&
      message !== null
    ) {
      // The message is a JSON object, log it as is
      this.logger[level]({ context, ...message });
    } else {
      // The message is not a JSON object, log it as a string
      this.logger[level]({ message, context, stack });
    }
  }

  /**
   * Custom HTTP logger method, logs the error and throw correct HTTP exception
   * @param message
   * @param code
   * @param endpoint
   */
  public httpError(
    message: string,
    code: HttpStatus,
    endpoint: string,
    details?: any,
  ) {
    /** HTTP error prefix */
    const prefix = `HTTP Error ${code} in ${endpoint}, `;

    /** Tries to add details in logging */
    let detailsError = '';
    if (details) {
      try {
        detailsError = ` / Details: ${JSON.stringify(details)}`;
      } catch {
        detailsError = details;
      }
    }

    /** Send error to internal default logger */
    try {
      this.log(prefix + message + detailsError);
    } catch {
      this.log(prefix + message);
    }

    /** Generates response wrap */
    const response = {
      message,
      errors: [message],
    };

    /** Throw HTTP exception */
    throw new HttpException(response, code);
  }
}

/** Exports */
export { GCPCloudCustomLogger };
