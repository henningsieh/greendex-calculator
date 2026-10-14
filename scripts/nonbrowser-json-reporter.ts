import { JsonReporter } from "vitest/node";

/** Keep private Vitest errors in process memory, never in default .vitest artifacts. */
export default class NonbrowserJsonReporter extends JsonReporter {
  constructor() {
    super({ stdout: true });
  }
}
