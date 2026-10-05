/** Shared open state for the Ctrl+K palette and the player card dialog. */
export const useCommandPalette = () => ({
  open: useState('command-palette-open', () => false),
  cardOpen: useState('player-card-open', () => false),
})
