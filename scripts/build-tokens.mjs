// One source, two outputs: tokens/tend.tokens.json becomes
//   src/styles/tokens.css        CSS custom properties, light and dark
//   tokens/figma-variables.json  collections and modes for Figma Variables
// Never edit the outputs by hand; change the source and rerun `npm run tokens`.
import fs from 'node:fs';

const SRC = 'tokens/tend.tokens.json';
const CSS_OUT = 'src/styles/tokens.css';
const FIGMA_OUT = 'tokens/figma-variables.json';

const tokens = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// Resolve "{color.primitive.ink-900}" references against the source tree
const lookup = (ref) => {
  const path = ref.slice(1, -1).split('.');
  let node = tokens;
  for (const key of path) {
    node = node?.[key];
    if (node === undefined) throw new Error(`Unresolved token reference ${ref}`);
  }
  return node.$value;
};
const resolve = (value) => (typeof value === 'string' && value.startsWith('{') ? resolve(lookup(value)) : value);

// Flatten a group into [name, token] pairs, skipping $-prefixed metadata
const entries = (group, prefix = '') =>
  Object.entries(group)
    .filter(([key]) => !key.startsWith('$'))
    .flatMap(([key, node]) =>
      node.$value !== undefined ? [[`${prefix}${key}`, node]] : entries(node, `${prefix}${key}-`)
    );

const semantic = entries(tokens.color.semantic);
const scalar = [
  ...entries(tokens.font, 'font-'),
  ...entries(tokens.size),
  ...entries(tokens.space, 'space-'),
  ...entries(tokens.radius, 'radius-'),
];

const decl = (mode) => semantic.map(([name, t]) => `  --${name}: ${resolve(t.$value[mode])};`).join('\n');
const darkDecl = decl('dark').replace(/^/gm, '  ');

const css = `/* Generated from ${SRC} by scripts/build-tokens.mjs. Do not edit. */
:root {
${decl('light')}
${scalar.map(([name, t]) => `  --${name}: ${t.$value};`).join('\n')}
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${darkDecl}
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
${decl('dark')}
  color-scheme: dark;
}
`;

// Figma Variables: a Primitives collection, and a Semantic collection with
// Light and Dark modes whose values alias the primitives
const primitives = entries(tokens.color.primitive);
const figma = {
  collections: [
    {
      name: 'Primitives',
      modes: ['Value'],
      variables: primitives.map(([name, t]) => ({ name: `color/${name}`, type: 'COLOR', values: { Value: t.$value } })),
    },
    {
      name: 'Semantic',
      modes: ['Light', 'Dark'],
      variables: semantic.map(([name, t]) => ({
        name: `color/${name}`,
        type: 'COLOR',
        description: t.$description ?? '',
        values: {
          Light: { alias: `color/${t.$value.light.slice(1, -1).split('.').pop()}` },
          Dark: { alias: `color/${t.$value.dark.slice(1, -1).split('.').pop()}` },
        },
      })),
    },
    {
      name: 'Dimensions',
      modes: ['Value'],
      variables: scalar
        .filter(([, t]) => t.$type === 'dimension')
        .map(([name, t]) => ({ name: name.replace('-', '/'), type: 'FLOAT', values: { Value: parseFloat(t.$value) } })),
    },
  ],
};

fs.mkdirSync('src/styles', { recursive: true });
fs.writeFileSync(CSS_OUT, css);
fs.writeFileSync(FIGMA_OUT, JSON.stringify(figma, null, 2) + '\n');
console.log(`tokens: ${semantic.length} semantic colours (light + dark), ${primitives.length} primitives, ${scalar.length} scalars → ${CSS_OUT}, ${FIGMA_OUT}`);
