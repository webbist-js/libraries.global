import { PMTiles, Protocol, SharedPromiseCache } from "pmtiles"

export const atlasProtocol = new Protocol()
const references = new Map<string, number>()

export function retainAtlasArchive(url: string) {
  if (!references.has(url))
    atlasProtocol.add(new PMTiles(url, new SharedPromiseCache(32)))
  references.set(url, (references.get(url) ?? 0) + 1)
}
export function releaseAtlasArchive(url: string) {
  const count = (references.get(url) ?? 1) - 1
  if (count > 0) references.set(url, count)
  else {
    references.delete(url)
    atlasProtocol.tiles.delete(url)
  }
}
