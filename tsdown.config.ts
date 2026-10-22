import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    core: 'src/core.ts',
    router: 'src/router.ts',
    csv: 'src/csv.ts',
    xlsx: 'src/xlsx.ts',
  },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  clean: true,
  external: ['react', 'fflate', /^@tanstack\//],
})
