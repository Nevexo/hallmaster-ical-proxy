// hallmaster-ical-proxy
// A proxying service for Hallmaster iCal feeds to provide a feed for each room in a Hallmaster instance.
// Cameron Fleming (c) 2024.

import winston from 'winston';
import express from 'express';
import cors from 'cors';
import { EventEmitter } from 'events';
import YAML from 'yaml';
import fs from 'fs';
import cron from 'node-cron';

// Setup event emitter
export const events = new EventEmitter();

import { router as metricsRouter } from './metrics/metrics.js';
import { fetch_ical } from './hallmaster/ical_fetch.js';
import { parse_hallmaster_ical } from './hallmaster/ical_parse.js';
import { generate_ical } from './feeds/ical_gen.js';
import { register_in_cache } from './ical_server/ical_server.js';
import { router as icalProxyRouter } from './ical_server/ical_server.js';

export let config = {};

// Setup and export Winston logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' })
  ]
})

// Setup express app
const app = express();

// Setup CORS
app.use(cors());

// Register routers
app.use('/metrics', metricsRouter);
app.use('/ical', icalProxyRouter);

// iCal Sync Method
const sync_calendars = async () => {
  logger.info(`sync_calendars: [!] Starting full sync of Hallmaster iCal feeds`);

  // Begin a full sync of the Hallmaster iCal to the internal cache.
  const hm_ical = await fetch_ical(config.hallmaster.hall_id);
  if (!hm_ical) return;

  const parsed = await parse_hallmaster_ical(hm_ical);
  if (!parsed) return;

  for (const [room, ical] of Object.entries(parsed)) {
    const ical_by_room = await generate_ical(room, config.rooms[room].name, ical);
    register_in_cache(room, ical_by_room);
  }

  logger.info(`sync_calendars: [!] Full sync of Hallmaster iCal feeds complete`);
}

// Entrypoint
const main = async () => {
  logger.info(`[!] initializing hallmaster-ical-proxy...`)
  
  // Read configuration file
  config = await YAML.parse(await fs.promises.readFile('config.yaml', 'utf8'));
  if (!config) {
    logger.error(`Failed to read configuration file`);
    process.exit(1);
  }

  // Ensure required configuration is present
  if (!config.hallmaster || !config.hallmaster.hall_id) {
    logger.error(`Configuration file is missing hallmaster.hall_id`);
    process.exit(1);
  }

  if (!config.rooms) {
    logger.error(`Configuration file is missing rooms configuration`);
    process.exit(1);
  }

  if (!config.cron || !config.cron.sync_schedule) {
    logger.error(`Configuration file is missing cron.sync_schedule`);
    process.exit(1);
  }

  // Run the initial sync
  await sync_calendars();

  // Schedule the sync cron job
  cron.schedule(config.cron.sync_schedule, async () => {
    logger.info(`Cron: Running scheduled sync of Hallmaster iCal feeds, the time is: ${new Date().toISOString()}`)
    await sync_calendars();
    logger.info(`Cron: Scheduled sync of Hallmaster iCal feeds complete at ${new Date().toISOString()} - waiting.`);
  });

  // Start the server
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    logger.info(`hallmaster-ical-proxy: Listening on port ${PORT}`);
  });
}

main();