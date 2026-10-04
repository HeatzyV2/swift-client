/** Fires the "Zip dashes across the screen" animation when a game launch starts. */
export const useLaunchDash = () => {
  const run = useState('launch-dash-run', () => 0)
  return { run, trigger: () => { run.value++ } }
}
