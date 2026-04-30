#!/usr/bin/env node
import { Command } from 'commander';
import { discoverCommand } from './commands/discover.js';
import { migrateCommand } from './commands/migrate.js';
import { statusCommand } from './commands/status.js';

const program = new Command();

program
  .name('moat')
  .description('M.O.A.T. — Migrate Old APIs Today')
  .version('0.1.0');

program.addCommand(discoverCommand);
program.addCommand(migrateCommand);
program.addCommand(statusCommand);

program.parse();
