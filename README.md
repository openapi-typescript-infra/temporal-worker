# @openapi-typescript-infra/temporal-worker

A Typescript node module to centralize some boilerplate around creating Temporal.io workers. The module will wire up Temporal logging to @openapi-typescript-infra/service logging and take care of spin up and spin down as well as a default workflow code location.