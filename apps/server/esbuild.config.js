/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const { fork } = require('child_process');

const DEV = process.env.NODE_ENV === 'development';

// Fork process to start/kill app with
let nodeFork;

function onBuildComplete() {
  require('node-notifier').notify({
    title: 'Xong Game Server',
    message: '🚀 Build complete!',
  });

  if (DEV) {
    // Run app with node
    nodeFork?.kill();
    nodeFork = fork(path.resolve(__dirname, 'dist/index.js'));
  } else {
    process.exit();
  }
}

function build() {
  require('esbuild').build({
    entryPoints: [path.resolve(__dirname, 'src/index.ts')],
    outfile: path.resolve(__dirname, 'dist/index.js'),
    platform: 'node',
    target: 'node14',
    bundle: true,
    external: Object.keys(require('./package.json').dependencies),
    watch: DEV && {
      onRebuild(err) {
        if (err) {
          console.error('watch build failed:', err);
          process.exit(1);
        }

        console.info('🚀 Rebuild complete!\n');
        onBuildComplete();
      },
    },
  })
    .catch(() => process.exit(1));

  console.info('🚀 Build complete!\n');
  onBuildComplete();
}

build();
