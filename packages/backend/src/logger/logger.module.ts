/**
 * @module logger.logger.module
 *
 * @description
 * Definitions for the logger module
 */

/** NestJS */
import { Module } from '@nestjs/common';
/** Controller / Service */
import { GCPCloudCustomLogger } from './logger.service';

/**
 * Logger Module
 */
@Module({
  providers: [GCPCloudCustomLogger],
  exports: [GCPCloudCustomLogger],
})
class LoggerModule {}

/** Exports */
export { LoggerModule };
