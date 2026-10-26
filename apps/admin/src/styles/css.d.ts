// Next bundles global stylesheets imported for their side effect; noUncheckedSideEffectImports needs
// a declaration to resolve them, since TypeScript has no CSS loader of its own.
declare module "*.css"
