// vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';
import dts from 'vite-plugin-dts';
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    plugins: [
        dts({
            // only generate types for your entry
            include: ['src/index.ts'],
            // rename the file before it’s written to disk
            beforeWriteFile(filePath, content) {
                if (filePath.endsWith('index.d.ts')) {
                    return {
                        // e.g. "dist/index.d.ts" → "dist/target-highlight.d.ts"
                        filePath: path.resolve(
                            path.dirname(filePath),
                            'target-highlight.d.ts'
                        ),
                        content
                    };
                }
                // leave any other files untouched
                return { filePath, content };
            }
        })
    ],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'TargetHighlight',
            fileName: 'target-highlight',
        },
        rollupOptions: {
            external: [],
            output: { globals: {} },
        },
        outDir: 'dist',
        emptyOutDir: true,
    },
});