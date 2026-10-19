export function fullBrowserConfig() {
  if (process.env.GREENDEX_FULL_TEST_RUN !== "true") return {};
  const outputFile = process.env.GREENDEX_PLAYWRIGHT_REPORT;
  const outputDir = process.env.GREENDEX_PLAYWRIGHT_OUTPUT;
  if (!outputFile || !outputDir)
    throw new Error("Missing private browser evidence paths.");
  return {
    retries: 0,
    forbidOnly: true,
    workers: 1,
    outputDir,
    reporter: [["json", { outputFile }]] as [string, { outputFile: string }][],
  };
}

export function fullBrowserUse() {
  return process.env.GREENDEX_FULL_TEST_RUN === "true"
    ? { trace: "off" as const, screenshot: "off" as const, video: "off" as const }
    : {};
}
