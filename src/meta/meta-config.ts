import rawConfig from './meta-config.json'

export type MetaTitleRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'
export type MetaTitleDefinition = { id: string; name: string; rarity: MetaTitleRarity }
export type MetaGameDefinition = { family: string; label: string }

export const CASINO_META_CONFIG = rawConfig as {
  version: number
  currency: { code: 'PR'; displayName: 'PR' }
  identity: { ownerDisplayName: string }
  games: Record<string, MetaGameDefinition>
  titles: MetaTitleDefinition[]
}

export const PR = CASINO_META_CONFIG.currency.code
export const OTTOMAN_MAFIA_TITLES = CASINO_META_CONFIG.titles
