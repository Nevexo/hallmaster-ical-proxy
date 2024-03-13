// hallmaster-ical-proxy
// iCal parsing methods
// Cameron Fleming (c) 2024

import { logger, config } from '../index.js';
import { metric_events } from '../metrics/metrics.js'; 

import ical from 'node-ical';

export const parse_hallmaster_ical = async (ical_data) => {
  // Uses node-ical to parse the iCal data from Hallmaster.
  // Then provides the necessary data for re-generation of the iCal feed.
  // Split by rooms.

  logger.debug(`hallmaster.parse_hallmaster_ical: starting to parse iCal data.`);
  const ical_events = await ical.async.parseICS(ical_data).catch(e => {
    logger.error(`hallmaster.parse_hallmaster_ical: Failed to parse iCal data.`);
    logger.error(e);
    metric_events.emit('metrics', {
      "metric_name": "hallmaster_last_parse_success",
      "metric_value": 0,
    });
  })
  if (!ical_events) return false;

  metric_events.emit('metrics', {
    "metric_name": "hallmaster_last_parse_success",
    "metric_value": 1,
  });

  // Object for storing events in hallmaster-ical-proxy's format, stored by room slug.
  // I.e., events['slug'] = [{//event}];
  let events = {};

  // Iterate all objects in ical_events
  for await (const [key, value] of Object.entries(ical_events)) {
    logger.debug(`hallmaster.parse_hallmaster_ical: Start parsing event: ${value.summary}`);

    // Skip non-vevent objects
    if (value.type !== 'VEVENT') continue;

    // Attempt to find "room" human-readable name in the description.
    const d = value.description.split('\n');

    // The room name should be the last line of the description.
    // TODO: Maybe handle this differently? It has always been at the end of the description,
    // but I feel like this could change for absolutely zero reason.
    // There's literally a field for this in the iCal spec. Anyway,
    // the configuration file specifies slug: 
    //                                        name: "Room Name"
    // So we'll need to iterate through the configuration to find the slug.
    // There might also be multiple rooms assigned to the event, split by commas.
    // TODO: Currently only cares about the first name it finds, this is fine for now.
    const room_names = d[d.length - 1].split(',').map(x => x.trim());
    
    // Attempt to find the room slug in the configuration.
    let room_slug = false;
    for await (const room of Object.keys(config.rooms)) {
      if (room_names.includes(config.rooms[room].name)) {
        room_slug = room;
        break;
      }
    }

    if (!room_slug) {
      logger.warn(`hallmaster.parse_hallmaster_ical: Failed to find room slug for room(s): ${room_names.join(', ')} in event: ${value.summary}`);

      metric_events.emit('metrics', {
        "metric_name": "hallmaster_last_parse_warning",
        "metric_value": 1,
      });

      continue;
    }

    // Create the slug in events if it doesn't exist.
    if (!events[room_slug]) {
      logger.debug(`hallmaster.parse_hallmaster_ical: [!] Creating new room slug: ${room_slug}`)
      events[room_slug] = [];
    }

    // Add the event to the room slug.
    events[room_slug].push({
      "type": value.type,
      "sequence": value.sequence,
      "summary": value.summary,
      "description": value.description,
      "start": value.start,
      "end": value.end,
      "dtstamp": value.dtstamp,
      "status": value.status,
      "uid": value.uid,
      "url": value.url,
    });
    logger.debug(`hallmaster.parse_hallmaster_ical: Finished parsing event: ${value.summary}`);
  }

  logger.debug(`hallmaster.parse_hallmaster_ical: [!] Parsing stopped, counting...`)
  // Count all events
  let event_count = 0;
  for await (const room of Object.keys(events)) {
    event_count += events[room].length;
  }

  // Submit metrics for event counts
  metric_events.emit('metrics', {
    "metric_name": "hallmaster_events_in_feed",
    "metric_value": event_count,
  });

  logger.info(`hallmaster.parse_hallmaster_ical: Finished parsing iCal data, found ${event_count} events.`)
  return events;
}