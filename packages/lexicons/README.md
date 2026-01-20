# @kelinci/danaus-lexicons

danaus schema definitions

## usage

```sh
pnpm add @kelinci/danaus-lexicons
```

### with @atcute/client

pick one of these options to register the ambient declarations:

```jsonc
// tsconfig.json
{
	"compilerOptions": {
		"types": ["@kelinci/danaus-lexicons"],
	},
}
```

```ts
// env.d.ts
/// <reference types="@kelinci/danaus-lexicons" />
```

```ts
// index.ts
import type {} from '@kelinci/danaus-lexicons';
```

### with @atcute/lex-cli

when building your own lexicons that reference these types, configure lex-cli to import from this
package:

```ts
// file: lex.config.js
import { defineLexiconConfig } from '@atcute/lex-cli';

export default defineLexiconConfig({
	files: ['lexicons-src/**/*.ts'],
	outdir: 'lib/lexicons/',
	imports: ['@kelinci/danaus-lexicons'],
});
```
