import * as esbuild from "esbuild";

const isWatch = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
  minify: !isWatch,
  metafile: true,
};

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log("👀 Watching for changes...");
    } else {
      const result = await esbuild.build(buildOptions);
      console.log("✅ Build complete");

      // Print bundle analysis
      const outputs = Object.entries(result.metafile.outputs);
      for (const [file, info] of outputs) {
        if (file.endsWith(".js")) {
          console.log(`\n  ${file}: ${(info.bytes / 1024).toFixed(1)}kb`);
        }
      }
    }
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();

