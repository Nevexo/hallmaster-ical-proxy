// hallmaster-ical-proxy
// Hallmaster iCal Fetching
// Cameron Fleming (c) 2024

const BASE_URL = "https://v2.hallmaster.co.uk/api/ical/GetICalStream"
// ?HallId=12139&listrooms=true

import axios from 'axios';

import { logger } from '../index.js';
import { metric_events } from '../metrics/metrics.js';

axios.defaults.headers.common['User-Agent'] = 'hallmaster-ical-proxy/1.0';

export const fetch_ical = async (hallId) => {
  // Fetch the latest iCal from Hallmaster, uses listRooms=true.
  logger.info(`hallmaster.fetch_ical: Fetching iCal for Hall: ${hallId}`);

  const start_date = new Date();
  const request_url = `${BASE_URL}?HallId=${hallId}&listrooms=true`;
  
  const r = await axios.get(request_url).catch(e => {
    logger.error(`hallmaster.fetch_ical: Failed to fetch iCal for Hall: ${hallId}`);
    logger.error(e);
    metric_events.emit('metrics', {
      "metric_name": "hallmaster_last_fetch_success",
      "metric_value": 0,
    });
  });

  if (!r) return false;

  // Submit metrics events
  metric_events.emit('metrics', {
    "metric_name": "hallmaster_last_fetch_success",
    "metric_value": 1,
  });

  metric_events.emit('metrics', {
    "metric_name": "hallmaster_last_fetch_time",
    "metric_value": new Date().toISOString(),
  });

  metric_events.emit('metrics', {
    "metric_name": "hallmaster_last_fetch_duration",
    "metric_value": (new Date() - start_date).toString(),
  });

  return r.data;
}