/** Two ways to paint the same landscape: ink wash on paper, or blue-green mineral colour. */
export type StyleId = 'ink' | 'qinglv';

export interface Style {
  background: string;
  /** Ground colours: low and flat, steep, and high. */
  low: string;
  steep: string;
  high: string;
  water: string;
  road: string;
  pine: [string, string]; // dry, wet
  reed: string;
  flower: [string, string];
  rock: string;
  roof: string;
  wall: string;
  lantern: string;
  /** Particle trails: head colour, and the colour they fade into. */
  trail: [string, string];
  stroke: string;
}

export const STYLES: Record<StyleId, Style> = {
  ink: {
    background: '#efe8d8',
    low: '#ece4d2',
    steep: '#6f6b63',
    high: '#b9b3a6',
    water: '#9fa6a3',
    road: '#cfc6b1',
    pine: ['#3d3b37', '#1f1e1c'],
    reed: '#5a574f',
    flower: ['#9b2f22', '#c0392b'],
    rock: '#4a4741',
    roof: '#2b2a27',
    wall: '#8f897d',
    lantern: '#c0392b',
    trail: ['#1b1a18', '#efe8d8'],
    stroke: '#1b1a18',
  },
  qinglv: {
    background: '#cfe3e6',
    low: '#a9c18b',
    steep: '#b48d5c',
    high: '#3f78a8',
    water: '#5fb3c9',
    road: '#d8c49a',
    pine: ['#5f7a3c', '#2f6b4a'],
    reed: '#8aa35a',
    flower: ['#f2a65a', '#e8618c'],
    rock: '#8c7a62',
    roof: '#2f5d8a',
    wall: '#c9483a',
    lantern: '#ffcf6b',
    trail: ['#ffffff', '#5fb3c9'],
    stroke: '#c9483a',
  },
};
