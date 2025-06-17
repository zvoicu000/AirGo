/**
 * Weather Object
 */

import { isNumeric, roundTo } from '../shared';

// Setup the lookup tables for the METARs
const PRECIPITATION_LEVEL = {
  TS: 4,
  '-TS': 4,
  '+TS': 4,
  VCTS: 4,
  VCTSRA: 4,
  VCTSDZ: 4,
  TSRA: 4,
  '-TSRA': 4,
  '+TSRA': 4,
  TSGR: 4,
  '-TSGR': 4,
  '+TSGR': 4,
  DZ: 1,
  VCDZ: 1,
  '-DZ': 1,
  '+DZ': 1,
  FZDZ: 1,
  '-FZDZ': 1,
  '+FZDZ': 2,
  SHDZ: 1,
  '-SHDZ': 1,
  '+SHDZ': 2,
  RA: 2,
  VCRA: 0,
  '-RA': 1,
  '+RA': 3,
  SHRA: 2,
  '-SHRA': 1,
  '+SHRA': 3,
  FZRA: 2,
  '-FZRA': 1,
  '+FZRA': 3,
  SH: 2,
  VCSH: 0,
  '-SH': 1,
  '+SH': 3,
  SN: 2,
  VCSN: 0,
  '-SN': 1,
  '+SN': 3,
  SHSN: 2,
  '-SHSN': 2,
  '+SHSN': 3,
  DRSN: 2,
  '-DRSN': 2,
  '+DRSN': 3,
  BLSN: 2,
  '-BLSN': 2,
  '+BLSN': 3,
  VCBLSN: 0,
  SG: 2,
  VCSG: 0,
  '-SG': 2,
  '+SG': 3,
  IC: 2,
  VCIC: 0,
  '-IC': 2,
  '+IC': 3,
  PL: 2,
  VCPL: 0,
  '-PL': 2,
  '+PL': 2,
  GR: 2,
  VCGR: 0,
  SHGR: 2,
  '-SHGR': 2,
  '+SHGR': 2,
  '-GR': 2,
  '+GR': 2,
  GS: 3,
  VCGS: 0,
  '-GS': 2,
  '+GS': 3,
  UP: 2,
  DU: 0,
  DS: 0,
  SS: 0,
  BLDU: 0,
  DRDU: 0,
  VCDU: 0,
  VCBLDU: 0,
  SA: 0,
  BLSA: 0,
  DRSA: 0,
  VCSA: 0,
  FU: 0,
  PE: 0,
  VCFU: 0,
};

/**
 * The definition of the weather report object
 */
export class WeatherReport {
  isValid: boolean = true;
  lat: number;
  lon: number;
  dataTimestamp: number;
  recordTimestamp: number;
  ttl: number;
  temperature?: number;
  windSpeed?: number;
  visibility?: number;
  precipitationLevel?: number;

  /**
   * Initialize the weather object from a METAR weather report
   * @param {any} metar - The METAR object
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createWeatherReportFromMetar(metar: any) {
    // Run some validation checks on the data
    this.isValid = true;
    if (metar['latitude'] && metar['longitude']) {
      if (isNumeric(metar['latitude'][0])) {
        if (metar['latitude'][0] < -90 || metar['latitude'][0] > 90) this.isValid = false;
      } else {
        this.isValid = false;
      }
      if (isNumeric(metar['longitude'][0])) {
        if (metar['longitude'][0] < -180 || metar['longitude'][0] > 180) this.isValid = false;
      } else {
        this.isValid = false;
      }
    } else {
      this.isValid = false;
    }

    // If the validation checks pass, set the object parameters
    if (this.isValid == true) {
      // Set the coords
      this.lat = metar['latitude'][0];
      this.lon = metar['longitude'][0];

      // Set the timestamps
      this.dataTimestamp = Math.floor(new Date(metar['observation_time'][0]).getTime() / 1000);
      this.recordTimestamp = Math.floor(Date.now() / 1000);
      this.ttl = Math.floor(Date.now() / 1000) + 86400;

      // Set the weather information
      if (metar['temp_c']) if (isNumeric(metar['temp_c'][0])) this.temperature = metar['temp_c'][0];
      if (metar['wind_speed_kt'])
        if (isNumeric(metar['wind_speed_kt'][0])) this.windSpeed = metar['wind_speed_kt'][0] * 0.5144;
      if (metar['visibility_statute_mi'])
        if (isNumeric(metar['visibility_statute_mi'][0])) {
          this.visibility = metar['visibility_statute_mi'][0] * 1609.34;
        } else if (metar['visibility_statute_mi'][0].startsWith('10')) {
          this.visibility = 200000;
        }

      // Set the weather interpreted data from the weather string in the metar
      if (metar['wx_string']) {
        for (const wxElem of metar['wx_string'][0].trim().split(' ')) {
          if (wxElem in PRECIPITATION_LEVEL) {
            this.precipitationLevel = PRECIPITATION_LEVEL[wxElem as keyof typeof PRECIPITATION_LEVEL];
          }
        }
      }

      // Round the numbers
      if (this.temperature) this.temperature = roundTo(this.temperature, 1);
      if (this.windSpeed) this.windSpeed = roundTo(this.windSpeed, 1);
      if (this.visibility) this.visibility = roundTo(this.visibility, 0);
    }
  }

  /**
   * @returns {JSON} - The JSON object in format required to upload to DynamoDB
   */
  getDynamoDBJson() {
    const json = {
      GeoPoint: {
        latitude: this.lat,
        longitude: this.lon,
      },
      PutItemInput: {
        Item: {},
      },
    };

    if (this.isValid) {
      return json;
    } else {
      return null;
    }
  }
}
