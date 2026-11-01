/** Equivalent labels for ICCU's province vintage, not a boundary crosswalk.
 * Matching remains unique and scoped to the already-resolved Italian Region.
 * Do not fold abolished Sardinian provinces into current ones by name.
 */
const NAMES: Record<string, string[]> = {
  Aosta: ["Valle d'Aosta", "Valle d'Aosta/Vallée d'Aoste", "Aosta Valley"],
  "L'Aquila": ["Provincia dell' Aquila", "Provincia dell'Aquila"],
  "Reggio nell'Emilia": ["Reggio Emilia", "Provincia di Reggio Emilia"],
  "Reggio di Calabria": ["Reggio Calabria", "Provincia di Reggio Calabria"],
  Roma: ["Città metropolitana di Roma Capitale", "Roma Capitale", "Rome"],
  Firenze: ["Florence", "Province of Florence"],
  "Bolzano/Bozen": [
    "Bolzano",
    "Provincia autonoma di Bolzano",
    "Bolzano-Bozen",
  ],
  "Valle d'Aosta/Vallée d'Aoste": ["Valle d'Aosta", "Aosta Valley"],
}

export function italianProvinceAliases(name: string): string[] {
  return [
    ...new Set([
      `Provincia di ${name}`,
      `Provincia ${name}`,
      `Provincia del ${name}`,
      `Province of ${name}`,
      `Provincia autonoma di ${name}`,
      `Città metropolitana di ${name}`,
      ...(NAMES[name] ?? []),
    ]),
  ]
}
