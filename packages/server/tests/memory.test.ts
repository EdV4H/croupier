import { defineContractTests } from "./contract.js";
import { createMemoryHarness } from "./memory-harness.js";

defineContractTests("memory", createMemoryHarness);
