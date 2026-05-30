import type { SiteAdapter } from './types';
import { amazonAdapter } from './amazon';
import { flipkartAdapter } from './flipkart';
import { googleMapsAdapter } from './googleMaps';

const ADAPTERS: SiteAdapter[] = [amazonAdapter, flipkartAdapter, googleMapsAdapter];

export function adapterFor(url: string): SiteAdapter | null {
  return ADAPTERS.find(a => a.matches(url)) ?? null;
}
