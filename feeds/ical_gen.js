// hallmaster-ical-proxy
// iCal generation, creates new location-based iCal feeds from a parsed Hallmaster iCal feed.
// Cameron Fleming (c) 2024

import { logger, config } from '../index.js';
import { metric_events } from '../metrics/metrics.js';

import ical, {ICalCalendarMethod} from 'ical-generator';

export const generate_ical = async (room_slug, room_name, events) => {
  // Generate a new iCal feed for a room.
  logger.debug(`hallmaster.generate_ical: Generating iCal feed for room: ${room_slug}`);
  
  // Create a new iCal feed
  const cal = ical({
    domain: 'hallmaster-ical-proxy',
    name: room_name,
    prodId: {company: 'hallmaster-ical-proxy', product: 'hallmaster-ical-proxy'},
    method: ICalCalendarMethod.PUBLISH,
  });

  // Iterate through events and add them to the iCal feed.
  for await (const event of events) {
    logger.debug(`hallmaster.generate_ical: Adding event: ${event.summary}`);
    try {
      cal.createEvent({
      start: event.start,
      end: event.end,
      dtstamp: event.dtstamp,
      sequence: event.sequence,
      status: event.status,
      uid: event.uid,
      url: event.url,
      summary: event.summary,
      description: event.description,
      location: room_name, // This is all Hallmaster had to do!!
     });
    } catch (e) {
      logger.error(`hallmaster.generate_ical: Failed to add event to iCal feed: ${event.summary}`);
      logger.error(e);
      metric_events.emit('metrics', {
        "metric_name": "hallmaster_last_ical_generation_error",
        "metric_value": 1,
      });
    }
  }

  // Return the iCal feed.
  return cal.toString();
}