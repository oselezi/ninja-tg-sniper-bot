import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Analytics from 'analytics';
import googleAnalytics from '@analytics/google-analytics';
import * as amplitude from '@amplitude/analytics-node';
import axios, { AxiosInstance } from 'axios';
import { formatDataProperties, snakeCase } from '../util';
import { EventEmitter } from 'events';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private analytics;
  private api: AxiosInstance;
  private eventEmitter = new EventEmitter();

  constructor(private configService: ConfigService) {
    this.analytics = Analytics({
      app: this.configService.get<string>('GOOGLE_CLOUD_PROJECT'),
      plugins: [
        googleAnalytics({
          measurementIds: [this.configService.get<string>('MEASUREMENT_ID')],
        }),
      ],
    });
    this.eventEmitter.on('trackEvent', this.trackEventHandler.bind(this));
    this.api = axios; // Axios instance is assigned here
  }

  async pushEventToGTM(name: string, params = {}) {
    const url = `https://www.google-analytics.com/mp/collect?api_secret=${this.configService.get<string>('GTM_API_KEY')}&measurement_id=${this.configService.get<string>('GTM_API_MEASUREMENT_ID')}`;

    // this.logger.debug(`Sending to GA: ${url}`, params);

    try {
      await this.api.post(
        url,
        {
          client_id: 'backend-api',
          user_id: params?.['userId'],
          events: [{ name, params }],
        },
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (e) {
      this.logger.error('Error logging to GA', e);
    }
  }

  async trackUsingFirebase(event: string, payload?: any) {
    try {
      if (event) {
        return await this.analytics.track(event, payload);
      }
      return null;
    } catch (error) {
      this.logger.error('ERROR WHILE TRACKING FIREBASE EVENT', error);
      return null;
    }
  }

  async trackUsingAmplitude(event: string, payload?: any) {
    try {
      await amplitude.init(
        this.configService.get<string>('VITE_AMPLITUDE_API_KEY'),
        {},
      ).promise;

      if (event) {
        amplitude.track(event, payload, { user_id: payload?.user_id });
        return await amplitude.flush().promise;
      } else {
        return null;
      }
    } catch (error) {
      this.logger.error('ERROR WHILE TRACKING AMPLITUDE EVENT', error);
      return null;
    }
  }

  // change all events to non blocking
  async trackEvent(event: string, payload?: any) {
    // this.logger.debug('Analytics', event, payload);
    this.logger.debug('Analytics', event, payload);
    const _name = snakeCase(event);
    const _data = formatDataProperties(payload);

    this.eventEmitter.emit('trackEvent', _name, _data);
  }

  private async trackEventHandler(event: string, payload?: any) {
    const _name = snakeCase(event);
    const _data = formatDataProperties(payload);
    await Promise.all([
      this.trackUsingFirebase(_name, _data),
      // this.trackUsingAmplitude(event, payload),
      this.pushEventToGTM(_name, _data),
    ]);
  }
}
