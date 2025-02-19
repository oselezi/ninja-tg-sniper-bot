// src/scenes/scene-manager.service.ts
import { Injectable } from '@nestjs/common';
import { ScenesComposer } from 'grammy-scenes';
import { setupScene } from './decorators/scene.decorator';

@Injectable()
export class SceneManagerService {
  private scenesComposer = new ScenesComposer();

  registerScene(scene: any) {
    // Load all scenes and setup them
    setupScene(scene, scene.__proto__);
    // add scenes to the composer
    this.scenesComposer.scene(scene.scene);
  }

  getManager() {
    return this.scenesComposer.manager();
  }

  get scene() {
    return this.scenesComposer;
  }
}
