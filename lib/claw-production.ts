export const CLAW_PRODUCTION_MS=10000;
export const CLAW_PRODUCTION_MOVIE='/claw-production/production-v19.mp4';
export type ProductionEvent={id:string;startedAt:string;durationMs:number};
export function productionAge(event:ProductionEvent,now:number){return now-Date.parse(event.startedAt);}
export function productionIsActive(event:ProductionEvent|null,now=Date.now()){if(!event)return false;const age=productionAge(event,now);return Number.isFinite(age)&&age>=0&&age<event.durationMs;}
export function validProductionRequest(value:unknown){if(typeof value!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw Error('Invalid production request.');return value;}
