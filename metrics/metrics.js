// hallmaster-ical-proxy
// Prometheus metrics endpoint
// Cameron Fleming (c) 2024

import { Router } from 'express';
import { EventEmitter } from 'events';

import { logger } from '../index.js';

export const router = Router();
export const metric_events = new EventEmitter();

let adhoc_metrics = {

}

let static_metrics = {
  "last_fetch_timestamp": 0 // Translate to seconds since last fetch
}

metric_events.on('metrics', (metric) => {
  logger.debug(`metrics: Received metric: ${metric.metric_name}=${metric.metric_value}`);

  if (metric.metric_name == "hallmaster_last_fetch_time") {
    static_metrics["last_fetch_timestamp"] = new Date(metric.metric_value).getTime();
  }

  adhoc_metrics[metric.metric_name] = metric.metric_value;
})

// GET /metrics (downstream metrics)
router.get('/', (req, res) => {
  logger.info(`metrics: Request for metrics`);
  res.set('Content-Type', 'text/plain');

  let response = `# hallmaster-ical-proxy metrics\n`;
  for (const [key, value] of Object.entries(adhoc_metrics)) {
    response += `${key} ${value}\n`;
  }

  // Add static metrics
  response += `# Static metrics\n`;
  const seconds_since_last_fetch = Math.round((new Date() - static_metrics["last_fetch_timestamp"]) / 1000, 0);
  response += `hallmaster_seconds_since_last_fetch ${seconds_since_last_fetch}\n`;

  res.send(response);
})