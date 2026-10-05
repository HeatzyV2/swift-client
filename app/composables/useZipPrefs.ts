const KEY = 'swift.zip.enabled'

/** Whether the Zip companion is shown in a corner of the launcher (on by default). */
export const useZipPrefs = () => {
  const enabled = useState('zip-enabled', () => {
    try {
      return localStorage.getItem(KEY) !== '0'
    } catch {
      return true
    }
  })
  watch(enabled, (v) => {
    try {
      localStorage.setItem(KEY, v ? '1' : '0')
    } catch { /* ignore */ }
  })
  return { enabled }
}
