// src/scenes/scene-loader.service.ts
import { Injectable, OnModuleInit, Type } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { SceneManagerService } from './scene-manager.service';
import { Reflector } from '@nestjs/core';

import { Bot, Context } from 'grammy';
import { InjectBot } from '@grammyjs/nestjs';

@Injectable()
export class SceneLoaderService implements OnModuleInit {
  constructor(
    private readonly moduleContainer: ModulesContainer,
    private readonly sceneManagerService: SceneManagerService,
    private readonly reflector: Reflector,
    @InjectBot() private readonly bot: Bot<Context>,
  ) {}

  onModuleInit() {
    const providers = [...this.moduleContainer.values()].flatMap((module) =>
      Array.from(module.providers.values()),
    );

    providers.forEach((provider) => {
      if (!provider.metatype) {
        return; // Skip providers without a metatype (e.g., value providers)
      }

      const sceneName = this.reflector.get<string>('scene', provider.metatype);

      if (sceneName && provider.instance) {
        this.sceneManagerService.registerScene(provider.instance);
      }
    });

    this.bot.use(this.sceneManagerService.scene);
  }
}
