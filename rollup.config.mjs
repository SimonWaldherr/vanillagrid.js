import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const banner = `/*!
 * VanillaGrid — a tiny table library
 * Features: sorting, multiple filtering modes (simple/CS/RegExp/tree),
 * pagination, grouping (sum/min/max), selection, resizing, basic editing,
 * context menu, export, tree data, and optional pivot-like view.
 * No dependencies. MIT License.
 */`;

export default [
  // ESM build
  {
    input: 'src/vanillagrid.ts',
    output: {
      file: 'dist/vanillagrid.esm.js',
      format: 'es',
      banner,
      sourcemap: true
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      }),
      resolve(),
      commonjs()
    ]
  },
  // UMD build (browser global)
  {
    input: 'src/vanillagrid.ts',
    output: {
      file: 'dist/vanillagrid.umd.js',
      format: 'umd',
      name: 'VanillaGrid',
      banner,
      sourcemap: true,
      exports: 'default'
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      }),
      resolve(),
      commonjs()
    ]
  },
  // UMD minified build
  {
    input: 'src/vanillagrid.ts',
    output: {
      file: 'dist/vanillagrid.min.js',
      format: 'umd',
      name: 'VanillaGrid',
      banner,
      sourcemap: false,
      exports: 'default'
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      }),
      resolve(),
      commonjs(),
      terser({
        format: {
          comments: /^!/
        }
      })
    ]
  },
  // Type declarations build
  {
    input: 'src/vanillagrid.ts',
    output: {
      file: 'dist/vanillagrid.d.ts',
      format: 'es'
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationMap: true,
        emitDeclarationOnly: true
      })
    ]
  }
];
