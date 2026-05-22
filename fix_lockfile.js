const fs = require('fs');
const lockfile = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));

// Only add the missing emnapi dependencies without touching name or peer fields
const packages = lockfile.packages;

if (!packages['node_modules/@emnapi/core']) {
  packages['node_modules/@emnapi/core'] = {
    "version": "1.10.0",
    "resolved": "https://registry.npmjs.org/@emnapi/core/-/core-1.10.0.tgz",
    "integrity": "sha512-yq6OkJ4p82CAfPl0u9mQebQHKPJkY7WrIuk205cTYnYe+k2Z8YBh11FrbRG/H6ihirqcacOgl2BIO8oyMQLeXw==",
    "dev": true,
    "license": "MIT",
    "optional": true,
    "dependencies": {
      "@emnapi/wasi-threads": "1.2.1",
      "tslib": "^2.4.0"
    }
  };
}

if (!packages['node_modules/@emnapi/runtime']) {
  packages['node_modules/@emnapi/runtime'] = {
    "version": "1.10.0",
    "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.10.0.tgz",
    "integrity": "sha512-ewvYlk86xUoGI0zQRNq/mC+16R1QeDlKQy21Ki3oSYXNgLb45GV1P6A0M+/s6nyCuNDqe5VpaY84BzXGwVbwFA==",
    "license": "MIT",
    "optional": true,
    "dependencies": {
      "tslib": "^2.4.0"
    }
  };
}

if (!packages['node_modules/@oxc-parser/binding-wasm32-wasi/node_modules/@emnapi/core']) {
  packages['node_modules/@oxc-parser/binding-wasm32-wasi/node_modules/@emnapi/core'] = {
    "version": "1.9.2",
    "resolved": "https://registry.npmjs.org/@emnapi/core/-/core-1.9.2.tgz",
    "integrity": "sha512-UC+ZhH3XtczQYfOlu3lNEkdW/p4dsJ1r/bP7H8+rhao3TTTMO1ATq/4DdIi23XuGoFY+Cz0JmCbdVl0hz9jZcA==",
    "dev": true,
    "license": "MIT",
    "optional": true,
    "dependencies": {
      "@emnapi/wasi-threads": "1.2.1",
      "tslib": "^2.4.0"
    }
  };
}

if (!packages['node_modules/@oxc-parser/binding-wasm32-wasi/node_modules/@emnapi/runtime']) {
  packages['node_modules/@oxc-parser/binding-wasm32-wasi/node_modules/@emnapi/runtime'] = {
    "version": "1.9.2",
    "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.9.2.tgz",
    "integrity": "sha512-3U4+MIWHImeyu1wnmVygh5WlgfYDtyf0k8AbLhMFxOipihf6nrWC4syIm/SwEeec0mNSafiiNnMJwbza/Is6Lw==",
    "dev": true,
    "license": "MIT",
    "optional": true,
    "dependencies": {
      "tslib": "^2.4.0"
    }
  };
}

fs.writeFileSync('package-lock.json', JSON.stringify(lockfile, null, 2) + '\n');
