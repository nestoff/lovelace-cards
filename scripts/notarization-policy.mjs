export function isNotarizationRequested(environment = process.env) {
  return environment.DITBROWSE_NOTARIZE === "1";
}
