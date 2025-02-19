import { Reflector } from '@nestjs/core';
import { SetMetadata, Injectable } from '@nestjs/common';
import { Scene as GrammyScene } from 'grammy-scenes';

export enum StepType {
  ENTRY = 'entry',
  WAIT = 'wait',
}

export const Scene = (sceneName: string) => {
  return function (constructor: Function) {
    SetMetadata('scene', sceneName)(constructor);
    constructor.prototype.scene = new GrammyScene(sceneName);

    Injectable({})(constructor); // Ensure class is a NestJS injectable
  };
};

export const SceneStep = (label: string, type: StepType = StepType.ENTRY) =>
  SetMetadata('sceneStep', { label, type });

export const SceneEnter = () =>
  SetMetadata('sceneStep', {
    label: 'onEnter',
    type: StepType.ENTRY,
  });

export const CallbackQuery = (args: string | RegExp | string[]) =>
  SetMetadata('callbackQuery', {
    callbackQuery: args,
  });

export const setupScene = (instance: any, prototype: any) => {
  const reflector = new Reflector();
  const methods = Object.getOwnPropertyNames(prototype);

  methods.forEach((method) => {
    // console.log('Step', method);
    if (typeof prototype[method] === 'function') {
      // const callbackQueryMethod = reflector.get<{
      //   label: string;
      //   callbackQuery: string | RegExp | string[];
      // }>('callbackQuery', instance[method]);

      // if (callbackQueryMethod) {
      //   console.log('Adding callback query', callbackQueryMethod);

      //   instance.scene
      //     .wait()
      //     .on(
      //       'callback_query',
      //       callbackQueryMethod.callbackQuery,
      //       instance[method].bind(instance),
      //     );
      // }

      // steps
      const step = reflector.get<{ label: string; type: StepType }>(
        'sceneStep',
        instance[method],
      );
      // console.log('step', step);
      if (step) {
        // register scene step
        switch (step.type) {
          case StepType.ENTRY:
            // console.log('Adding step', instance.scene.id, step.label);
            // allows jumping to steps by label
            instance.scene.label(step.label);
            instance.scene.step(instance[method].bind(instance));
            break;
          case StepType.WAIT:
            instance.scene
              .wait(step.label)
              .on('message:text', instance[method].bind(instance));
            break;
          // TODO: Add more step types READ - https://github.com/IlyaSemenov/grammy-scenes
        }
      }
    }
  });
};
