import {
  BOT_BACKUP_SCENE,
  CHAT_SCENE,
  PORTFOLIO_SCENE,
  SENSEI_SCENE,
  SETTINGS_SCENE,
} from '../constants';

export const BASE_COMMANDS = [
  {
    command: 'dojo',
    description: 'View portfolio and main menu',
    scene: PORTFOLIO_SCENE,
  },
  // {
  //   command: 'topup',
  //   description: 'Add Solana to your Wallet',
  //   scene: TOPUP_SCENE,
  // },
  {
    command: 'settings',
    description: 'Edit settings',
    scene: SETTINGS_SCENE,
  },
  {
    command: 'sensei',
    description: 'Get help and FAQs',
    scene: SENSEI_SCENE,
  },
  {
    command: 'apps',
    description: 'Explore the Ninja app marketplace (coming soon)',
    scene: '',
  },
  {
    command: 'chat',
    description: 'Join our telegram group for questions and feedback',
    scene: CHAT_SCENE,
  },
  {
    command: 'bots',
    description: 'Switch to backup bots, same wallet',
    scene: BOT_BACKUP_SCENE,
  },
];

export const handleBaseCommands = async (ctx: any) => {
  const text = ctx.message.text || ctx.update.message.text;
  const baseCommand = BASE_COMMANDS.find(
    (c) => c.command === text.toLowerCase().replace('/', ''),
  );

  if (baseCommand && baseCommand.scene) {
    await ctx.scene.exit();
    await ctx.scenes.enter(baseCommand.scene);
  }

  return baseCommand !== undefined;
};
