import tsNode from "ts-node";

tsNode.register({
  esm: true,

  // project: "./src/tsconfig.json",

  // disregard typescript errors before transpilation
  transpileOnly: true,
  // swc: true,

  "compilerOptions": {
    module: "NodeNext",
    moduleResolution: "NodeNext",
    allowJs: true
  },
});

