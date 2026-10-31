// lib es2023 leaves these out; every host that runs core (the Claude Code
// engine, Bun, Node) supplies them.
declare global {
  var TextEncoder: new () => { readonly encode: (input: string) => Uint8Array }
  var TextDecoder: new () => {
    readonly decode: (input: Readonly<Uint8Array>) => string
  }
}

export {}
