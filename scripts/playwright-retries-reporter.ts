export default class PlaywrightRetriesReporter {
  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: { projects: { name: string; retries: number }[] }): void {
    for (const project of config.projects) {
      console.log(
        `Playwright retries (${project.name || "default"}): ${project.retries}`,
      );
    }
  }
}
