// hallmaster-ical-proxy
// Proxying router for generated Hallmaster iCal feeds (THAT HAVE LOCATIONS!)
// Uses cached iCal feeds from hallmaster/ical_fetch.js
// Cameron Fleming (c) 2024

import { Router } from 'express';
import { logger, config } from '../index.js';

let cache = {};

export const router = Router();

export const register_in_cache = (room_slug, ical) => {
  // Register an iCal string in the cache.
  logger.debug(`feeds.register_in_cache: Registering iCal feed for room: ${room_slug}`);
  cache[room_slug] = ical;
}

// GET /ical/:room_slug
router.get('/:room_slug', async (req, res) => {
  const room_slug = req.params.room_slug;
  logger.info(`feeds.ical_gen: Request for iCal feed for room: ${room_slug}`);

  if (!cache[room_slug]) {
    logger.error(`feeds.ical_gen: Requested iCal feed for room: ${room_slug} not found in cache`);
    res.status(404).send('Not Found');
    return;
  }

  res.set('Content-Type', 'text/calendar');
  res.send(cache[room_slug]);
});
