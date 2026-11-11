/**
 * `@reharm/theory-core/testing`: the property-test generators and the engine's claims as
 * runnable proofs. Kept out of the main entry so the app never ships fast-check unless it
 * asks for it (the Proof tab loads it in a worker).
 */
export * from "./arbitraries";
export * from "./proofs";
